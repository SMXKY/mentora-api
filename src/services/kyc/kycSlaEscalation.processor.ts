import { Queue, Worker, Job } from "bullmq";
import prisma from "../../config/database.config";
import redis from "../../config/redis.config";
import { KycStatus, NotificationType, NotificationResourceType } from "../../generated/prisma";
import NotificationService from "../notification/notification.service";
import { KycAdminService } from "../../modules/kyc/kycAdmin.service";
import { permissions } from "../../data/permission.data";

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
};

const QUEUE_NAME = "kyc-sla-escalation";
const CHECK_JOB = "check-sla";
const SLA_48H_NOTIFIED_PREFIX = "kyc:sla48h:";
const SLA_ESCALATED_PREFIX = "kyc:sla_escalated:";
// One-week TTL is generous headroom past the longest SLA window this
// checks against — just needs to outlive the application's review time.
const DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;

const slaQueue = new Queue(QUEUE_NAME, { connection });

// Hourly — the 48-hour and 5-business-day thresholds both need to be
// caught reasonably close to the moment they're crossed, not once a day.
slaQueue
  .add(CHECK_JOB, {}, { repeat: { pattern: "0 * * * *" }, removeOnComplete: true, removeOnFail: { count: 200 } })
  .catch((err) => {
    console.error({
      event: "kyc_sla_schedule_failed",
      error: err instanceof Error ? err.message : String(err),
    });
  });

function addBusinessDays(from: Date, days: number): Date {
  const result = new Date(from);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}

export async function checkKycSlaBreaches(): Promise<{ notified48h: number; escalated: number }> {
  const { targetHours, maxBusinessDays } = await KycAdminService.getSlaConfig();

  const pending = await prisma.kycApplication.findMany({
    where: { deletedAt: null, currentStep: "SUBMITTED", tutorProfile: { kycStatus: KycStatus.PENDING } },
    include: { tutorProfile: { select: { id: true, userId: true, kycSubmittedAt: true } } },
  });

  let notified48h = 0;
  let escalated = 0;
  const now = new Date();

  for (const app of pending) {
    const submittedAt = app.tutorProfile.kycSubmittedAt ?? app.updatedAt;
    const targetDeadline = new Date(submittedAt.getTime() + targetHours * 60 * 60 * 1000);
    const escalationDeadline = addBusinessDays(submittedAt, maxBusinessDays);

    if (now >= targetDeadline) {
      const key = `${SLA_48H_NOTIFIED_PREFIX}${app.id}`;
      const alreadyNotified = await redis.get(key);
      if (!alreadyNotified) {
        await redis.set(key, "1", { EX: DEDUPE_TTL_SECONDS });
        await NotificationService.send({
          type: NotificationType.KYC_SLA_BREACH,
          target: { kind: "user", userId: app.tutorProfile.userId },
          resourceType: NotificationResourceType.KYC,
          resourceId: app.id,
        }).catch(() => {});
        notified48h++;
      }
    }

    if (now >= escalationDeadline) {
      const key = `${SLA_ESCALATED_PREFIX}${app.id}`;
      const alreadyEscalated = await redis.get(key);
      if (!alreadyEscalated) {
        await redis.set(key, "1", { EX: DEDUPE_TTL_SECONDS });
        await NotificationService.send({
          type: NotificationType.ADMIN_REVIEW_REQUIRED,
          target: { kind: "permission", permissionCode: permissions.kyc.manage },
          resourceType: NotificationResourceType.KYC,
          resourceId: app.id,
          data: { reviewReason: "kyc_escalated", tutorProfileId: app.tutorProfileId },
        }).catch(() => {});
        escalated++;
      }
    }
  }

  return { notified48h, escalated };
}

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    if (job.name === CHECK_JOB) return checkKycSlaBreaches();
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error({ event: "kyc_sla_check_failed", job: job?.name, error: err.message });
});
