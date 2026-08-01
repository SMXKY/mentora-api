import { Queue, Worker, Job } from "bullmq";
import prisma from "../../config/database.config";
import {
  KycStatus,
  ConfigCategory,
  LedgerOperation,
  LedgerStatus,
  PaymentDirection,
  NotificationType,
  NotificationResourceType,
} from "../../generated/prisma";
import { NotificationService } from "../notification/notification.service";
import { paymentConfig } from "./paymentConfig";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

const connection = { host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT) || 6379 };
const QUEUE_NAME = "monthly-fee";
const CHARGE_JOB = "charge-all-tutors";
const HEARTBEAT_KEY = "payment.monthly_fee_job_heartbeat";

const queue = new Queue(QUEUE_NAME, { connection });

function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** REQ-013-016 — first-of-month charge attempt for every active tutor. */
export async function chargeAllActiveTutors(): Promise<{ charged: number; failed: number }> {
  const { monthlyFeeAmountXaf, monthlyFeeGracePeriodDays } = await paymentConfig.getAll();
  const periodStart = currentPeriodStart();

  const tutors = await prisma.tutorProfile.findMany({
    where: { kycStatus: KycStatus.ACTIVE, deletedAt: null },
    select: { id: true, userId: true },
  });

  let charged = 0;
  let failed = 0;

  for (const tutor of tutors) {
    const existing = await prisma.monthlyFeeCharge.findUnique({
      where: { tutorProfileId_periodStart: { tutorProfileId: tutor.id, periodStart } },
    });
    if (existing) continue;

    const wallet = await prisma.wallet.findUnique({ where: { userId: tutor.userId } });
    const canPay = !!wallet && wallet.balanceXaf >= monthlyFeeAmountXaf;

    const charge = await prisma.monthlyFeeCharge.create({
      data: {
        tutorProfileId: tutor.id,
        userId: tutor.userId,
        periodStart,
        amountXaf: monthlyFeeAmountXaf,
        isPaid: canPay,
        paidAt: canPay ? new Date() : null,
        gracePeriodEndsAt: canPay ? null : new Date(Date.now() + monthlyFeeGracePeriodDays * 24 * 60 * 60 * 1000),
      },
    });

    if (canPay) {
      await prisma.$transaction([
        prisma.wallet.update({ where: { userId: tutor.userId }, data: { balanceXaf: { decrement: monthlyFeeAmountXaf } } }),
        prisma.transactionLedger.create({
          data: {
            fromUserId: tutor.userId,
            operation: LedgerOperation.MONTHLY_FEE,
            direction: PaymentDirection.USER_TO_PLATFORM,
            status: LedgerStatus.SUCCESS,
            amountXaf: monthlyFeeAmountXaf,
            isPlatformReceiver: true,
          },
        }),
      ]);
      await NotificationService.send({
        type: NotificationType.MONTHLY_FEE_DEDUCTED,
        target: { kind: "user", userId: tutor.userId },
        resourceType: NotificationResourceType.PAYMENT,
        resourceId: charge.id,
      });
      charged++;
    } else {
      await NotificationService.send({
        type: NotificationType.MONTHLY_FEE_FAILED,
        target: { kind: "user", userId: tutor.userId },
        resourceType: NotificationResourceType.PAYMENT,
        resourceId: charge.id,
      });
      failed++;
    }
  }

  return { charged, failed };
}

/** Daily: charges that never got paid within the grace period hide the tutor from search. */
export async function sweepOverdueGracePeriods(): Promise<{ flagged: number }> {
  const overdue = await prisma.monthlyFeeCharge.findMany({
    where: { isPaid: false, isOverdue: false, gracePeriodEndsAt: { lt: new Date() } },
  });

  for (const charge of overdue) {
    await prisma.$transaction([
      prisma.monthlyFeeCharge.update({ where: { id: charge.id }, data: { isOverdue: true } }),
      prisma.tutorProfile.update({ where: { id: charge.tutorProfileId }, data: { isPaymentOverdue: true } }),
    ]);
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
        description: "Last successful run of the monthly-fee grace-period sweep (dead-man's-switch)",
        defaultValue: "",
        updatedById: systemActor.id,
      },
      update: { value: new Date().toISOString(), updatedById: systemActor.id },
    });
  }

  return { flagged: overdue.length };
}

/** Tutor pays an overdue fee themselves once their wallet has funds — clears the search-visibility block. */
export async function payOverdueFee(tutorUserId: string, chargeId: string): Promise<void> {
  const charge = await prisma.monthlyFeeCharge.findFirstOrThrow({ where: { id: chargeId, userId: tutorUserId } });
  if (charge.isPaid) return;

  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: tutorUserId } });
  if (wallet.balanceXaf < charge.amountXaf) {
    throw new AppError("payment/errors:insufficientBalance", StatusCodes.BAD_REQUEST);
  }

  await prisma.$transaction([
    prisma.wallet.update({ where: { userId: tutorUserId }, data: { balanceXaf: { decrement: charge.amountXaf } } }),
    prisma.monthlyFeeCharge.update({ where: { id: chargeId }, data: { isPaid: true, paidAt: new Date(), isOverdue: false } }),
    prisma.tutorProfile.update({ where: { id: charge.tutorProfileId }, data: { isPaymentOverdue: false } }),
    prisma.transactionLedger.create({
      data: {
        fromUserId: tutorUserId,
        operation: LedgerOperation.MONTHLY_FEE,
        direction: PaymentDirection.USER_TO_PLATFORM,
        status: LedgerStatus.SUCCESS,
        amountXaf: charge.amountXaf,
        isPlatformReceiver: true,
      },
    }),
  ]);

  await NotificationService.send({
    type: NotificationType.MONTHLY_FEE_DEDUCTED,
    target: { kind: "user", userId: tutorUserId },
    resourceType: NotificationResourceType.PAYMENT,
    resourceId: chargeId,
  });
}

let worker: Worker | null = null;
let dailySweepInterval: NodeJS.Timeout | null = null;

export function startMonthlyFeeWorker(): void {
  if (worker) return;
  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name === CHARGE_JOB) await chargeAllActiveTutors();
    },
    { connection }
  );
  worker.on("failed", (job, err) => {
    console.error({ event: "monthly_fee_job_failed", job: job?.name, error: err.message });
  });

  queue
    .add(CHARGE_JOB, {}, { repeat: { pattern: "0 3 1 * *" }, removeOnComplete: true, removeOnFail: { count: 50 } })
    .catch((err) => console.error({ event: "monthly_fee_schedule_failed", error: err.message }));

  // Daily grace-period sweep — not itself a BullMQ repeat job since it
  // needs to run more often than the once-a-month charge job.
  dailySweepInterval = setInterval(() => {
    sweepOverdueGracePeriods().catch((err) =>
      console.error({ event: "monthly_fee_grace_sweep_failed", error: err.message })
    );
  }, 24 * 60 * 60 * 1000);
}

export function stopMonthlyFeeWorker(): void {
  if (dailySweepInterval) clearInterval(dailySweepInterval);
  dailySweepInterval = null;
  worker?.close();
  worker = null;
}
