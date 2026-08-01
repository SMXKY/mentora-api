import { Queue, Worker, Job } from "bullmq";
import prisma from "../../config/database.config";
import {
  ConfigCategory,
  TicketCategory,
  TicketCreationSource,
  NotificationType,
  NotificationResourceType,
} from "../../generated/prisma";
import { NotificationService } from "../notification/notification.service";
import { FapshiService } from "./fapshi.service";
import { paymentConfig } from "./paymentConfig";

const connection = { host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT) || 6379 };
const QUEUE_NAME = "payment-reconciliation";
const HEARTBEAT_KEY = "payment.reconciliation_job_heartbeat";
const MAX_ATTEMPTS = 3;

const queue = new Queue(QUEUE_NAME, { connection });

function jobId(reconciliationId: string) {
  return `reconcile-${reconciliationId}`;
}

export async function scheduleReconciliationCheck(reconciliationId: string): Promise<void> {
  const { reconciliationDelayMinutes } = await paymentConfig.getAll();
  await queue.add(
    "check",
    { reconciliationId },
    {
      jobId: jobId(reconciliationId),
      delay: reconciliationDelayMinutes * 60 * 1000,
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
}

async function escalateToSupport(reconciliationId: string) {
  const reconciliation = await prisma.paymentReconciliation.findUniqueOrThrow({ where: { id: reconciliationId } });

  const { ticket } = await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: {
        submittedById: reconciliation.userId,
        category: TicketCategory.RECONCILIATION_PENDING,
        subject: "Payment status could not be confirmed",
        creationSource: TicketCreationSource.SYSTEM_RECONCILIATION,
        reconciliationId: reconciliation.id,
      },
    });

    const wallet = await tx.wallet.findUnique({ where: { userId: reconciliation.userId } });

    await tx.reconciliationContext.create({
      data: {
        ticketId: ticket.id,
        reconciliationId: reconciliation.id,
        providerTransactionId: reconciliation.providerTransactionId,
        paymentAmountXaf: 0,
        providerQueryResult: reconciliation.providerStatus,
        providerQuerySnapshot: (reconciliation.providerQueryResponse ?? {}) as any,
        parentWalletBalanceAtTicket: wallet?.balanceXaf ?? 0,
      },
    });

    await tx.paymentReconciliation.update({
      where: { id: reconciliation.id },
      data: { supportTicketId: ticket.id },
    });

    return { ticket };
  });

  await NotificationService.send({
    type: NotificationType.PAYMENT_RECONCILIATION_PENDING,
    target: { kind: "user", userId: reconciliation.userId },
    resourceType: NotificationResourceType.PAYMENT,
    resourceId: ticket.id,
  });
}

async function processReconciliation(reconciliationId: string, attempt: number) {
  const reconciliation = await prisma.paymentReconciliation.findUnique({ where: { id: reconciliationId } });
  if (!reconciliation || reconciliation.resolved) return;

  const statusResult = await FapshiService.paymentStatus(reconciliation.providerTransactionId);

  await prisma.paymentReconciliation.update({
    where: { id: reconciliationId },
    data: {
      providerStatus: statusResult.status,
      providerQueryResponse: statusResult as any,
      queriedAt: new Date(),
    },
  });

  if (statusResult.status === "SUCCESSFUL") {
    try {
      if (reconciliation.bookingId) {
        // Dynamic import avoids a hard circular dependency with modules/payment/payment.service.
        const { PaymentService } = await import("../../modules/payment/payment.service");
        await PaymentService.finalizeReconciledPayment(reconciliation.bookingId, reconciliation.userId, statusResult);
      }
      await prisma.paymentReconciliation.update({
        where: { id: reconciliationId },
        data: { resolved: true, resolvedAt: new Date(), resolutionAction: "confirmed_successful" },
      });
    } catch (err: any) {
      // The provider confirmed success but our own booking state no longer
      // accepts it (e.g. the payment window already expired) — this needs
      // a human, not another retry.
      console.error({ event: "reconciliation_finalize_failed", reconciliationId, error: err.message });
      await escalateToSupport(reconciliationId);
    }
    return;
  }

  if (statusResult.status === "FAILED" || statusResult.status === "EXPIRED") {
    await prisma.paymentReconciliation.update({
      where: { id: reconciliationId },
      data: { resolved: true, resolvedAt: new Date(), resolutionAction: "confirmed_failed" },
    });
    return;
  }

  // Still pending — retry up to MAX_ATTEMPTS, then hand off to support.
  if (attempt >= MAX_ATTEMPTS) {
    await escalateToSupport(reconciliationId);
    return;
  }
  await queue.add(
    "check",
    { reconciliationId, attempt: attempt + 1 },
    { delay: 10 * 60 * 1000, removeOnComplete: true, removeOnFail: true }
  );
}

let worker: Worker | null = null;
let sweepInterval: NodeJS.Timeout | null = null;

export function startReconciliationWorker(): void {
  if (worker) return;
  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      await processReconciliation(job.data.reconciliationId, job.data.attempt ?? 1);
    },
    { connection }
  );
  worker.on("failed", (job, err) => {
    console.error({ event: "reconciliation_job_failed", job: job?.name, error: err.message });
  });

  // Safety-net sweep for unresolved reconciliations whose delayed job was lost.
  sweepInterval = setInterval(async () => {
    try {
      const stale = await prisma.paymentReconciliation.findMany({
        where: { resolved: false, queriedAt: { lt: new Date(Date.now() - 20 * 60 * 1000) } },
        select: { id: true },
      });
      for (const r of stale) {
        await processReconciliation(r.id, MAX_ATTEMPTS).catch((err) =>
          console.error({ event: "reconciliation_sweep_failed", reconciliationId: r.id, error: err.message })
        );
      }

      const systemActor = await prisma.user.findFirst({
        where: { email: process.env.SUPER_ADMIN_EMAIL },
        select: { id: true },
      });
      if (systemActor) {
        await prisma.platformConfig.upsert({
          where: { key: HEARTBEAT_KEY },
          create: {
            key: HEARTBEAT_KEY,
            value: new Date().toISOString(),
            category: ConfigCategory.PAYMENT,
            description: "Last successful run of the payment reconciliation sweep (dead-man's-switch)",
            defaultValue: "",
            updatedById: systemActor.id,
          },
          update: { value: new Date().toISOString(), updatedById: systemActor.id },
        });
      }
    } catch (err: any) {
      console.error({ event: "reconciliation_sweep_error", error: err.message });
    }
  }, 15 * 60 * 1000);
}

export function stopReconciliationWorker(): void {
  if (sweepInterval) clearInterval(sweepInterval);
  sweepInterval = null;
  worker?.close();
  worker = null;
}
