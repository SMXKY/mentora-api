import { Queue, Worker, Job } from "bullmq";
import prisma from "../../config/database.config";
import { DisputeStatus, ConfigCategory, NotificationType, NotificationResourceType } from "../../generated/prisma";
import { NotificationService } from "../notification/notification.service";
import { assertValidTransition } from "./disputeStateMachine";
import { addBusinessDays } from "./businessDays.util";
import { disputeConfig } from "./disputeConfig";

const connection = { host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT) || 6379 };
const QUEUE_NAME = "dispute-sla";
const HEARTBEAT_KEY = "dispute.sla_sweep_heartbeat";

const queue = new Queue(QUEUE_NAME, { connection });

function reminderJobId(disputeId: string) {
  return `dispute-response-reminder-${disputeId}`;
}
function dueJobId(disputeId: string) {
  return `dispute-response-due-${disputeId}`;
}

export async function scheduleDisputeResponseJobs(disputeId: string, tutorResponseDueAt: Date): Promise<void> {
  const { tutorResponseReminderHours } = await disputeConfig.getAll();
  const reminderAt = new Date(tutorResponseDueAt.getTime() - tutorResponseReminderHours * 60 * 60 * 1000);
  const now = Date.now();

  if (reminderAt.getTime() > now) {
    await queue.add(
      "response-reminder",
      { disputeId },
      { jobId: reminderJobId(disputeId), delay: reminderAt.getTime() - now, removeOnComplete: true, removeOnFail: true }
    );
  }

  await queue.add(
    "response-due",
    { disputeId },
    {
      jobId: dueJobId(disputeId),
      delay: Math.max(tutorResponseDueAt.getTime() - now, 0),
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
}

export async function cancelDisputeResponseJobs(disputeId: string): Promise<void> {
  for (const jobId of [reminderJobId(disputeId), dueJobId(disputeId)]) {
    const job = await queue.getJob(jobId);
    if (job) await job.remove().catch(() => undefined);
  }
}

async function sendResponseReminder(disputeId: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { booking: { include: { tutorProfile: { select: { userId: true } } } } },
  });
  if (!dispute || dispute.status !== DisputeStatus.OPEN || dispute.tutorRespondedAt) return;

  await NotificationService.send({
    type: NotificationType.DISPUTE_TUTOR_RESPONSE_REMINDER,
    target: { kind: "user", userId: dispute.booking.tutorProfile.userId },
    resourceType: NotificationResourceType.DISPUTE,
    resourceId: dispute.id,
  });
  await prisma.dispute.update({ where: { id: disputeId }, data: { tutorResponseReminderSent: true } });
}

/** The response deadline passing doesn't escalate by itself — it just nudges the dispute into the admin queue even without the tutor's statement. */
async function nudgeIntoAdminQueue(disputeId: string) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute || dispute.status !== DisputeStatus.OPEN) return;
  assertValidTransition(dispute.status, DisputeStatus.AWAITING_ADMIN);
  await prisma.dispute.update({ where: { id: disputeId }, data: { status: DisputeStatus.AWAITING_ADMIN } });
}

/** SLA sweep: disputes unresolved past the configured business-day SLA escalate to Super Admin. */
export async function sweepSlaEscalations(): Promise<{ escalated: number }> {
  const { slaBusinessDays } = await disputeConfig.getAll();
  const unresolvedStatuses: DisputeStatus[] = [
    DisputeStatus.OPEN,
    DisputeStatus.AWAITING_ADMIN,
    DisputeStatus.UNDER_REVIEW,
  ];

  const candidates = await prisma.dispute.findMany({
    where: { status: { in: unresolvedStatuses }, escalationNotified: false },
  });

  let escalated = 0;
  for (const dispute of candidates) {
    const slaDeadline = addBusinessDays(dispute.openedAt, slaBusinessDays);
    if (slaDeadline > new Date()) continue;

    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { status: DisputeStatus.ESCALATED, escalatedAt: new Date(), escalationNotified: true },
    });

    await NotificationService.send({
      type: NotificationType.DISPUTE_ESCALATED,
      target: { kind: "permission", permissionCode: "disputes.resolve" },
      resourceType: NotificationResourceType.DISPUTE,
      resourceId: dispute.id,
    });
    escalated++;
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
        category: ConfigCategory.DISPUTE,
        description: "Last successful run of the dispute SLA escalation sweep (dead-man's-switch)",
        defaultValue: "",
        updatedById: systemActor.id,
      },
      update: { value: new Date().toISOString(), updatedById: systemActor.id },
    });
  }

  return { escalated };
}

let worker: Worker | null = null;
let sweepInterval: NodeJS.Timeout | null = null;

export function startDisputeSlaWorker(): void {
  if (worker) return;
  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name === "response-reminder") await sendResponseReminder(job.data.disputeId);
      else if (job.name === "response-due") await nudgeIntoAdminQueue(job.data.disputeId);
    },
    { connection }
  );
  worker.on("failed", (job, err) => {
    console.error({ event: "dispute_sla_job_failed", job: job?.name, error: err.message });
  });

  sweepInterval = setInterval(() => {
    sweepSlaEscalations().catch((err) =>
      console.error({ event: "dispute_sla_sweep_failed", error: err.message })
    );
  }, 15 * 60 * 1000);
}

export function stopDisputeSlaWorker(): void {
  if (sweepInterval) clearInterval(sweepInterval);
  sweepInterval = null;
  worker?.close();
  worker = null;
}
