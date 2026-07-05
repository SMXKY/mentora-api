import { Queue, Worker, Job } from "bullmq";
import prisma from "../../config/database.config";
import { UserStatus, LogOperation, LogCategory } from "../../generated/prisma";

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
};

const QUEUE_NAME = "account-anonymisation";
const ANONYMISE_JOB = "anonymise";
const GRACE_PERIOD_DAYS = 30;
const BATCH_SIZE = 500;

const anonymisationQueue = new Queue(QUEUE_NAME, { connection });

// Nightly, after the media purge job (3am) so both housekeeping jobs never
// contend for the same DB connections at once. Repeatable-job registration
// is idempotent — safe to re-run on every boot.
anonymisationQueue
  .add(
    ANONYMISE_JOB,
    {},
    {
      repeat: { pattern: "0 4 * * *" },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  )
  .catch((err) => {
    console.error({
      event: "account_anonymisation_schedule_failed",
      error: err instanceof Error ? err.message : String(err),
    });
  });

/**
 * Scrubs PII from accounts that have been in self-deactivation's 30-day
 * grace period without reactivating. The User row itself is never
 * deleted — TransactionLedger and other tables keep referencing the same
 * (now-anonymised) userId, satisfying the compliance retention
 * requirement without any extra bookkeeping.
 */
export async function anonymiseDeactivatedAccounts(): Promise<number> {
  const cutoff = new Date(Date.now() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: {
      status: UserStatus.DEACTIVATED,
      deletedAt: { lt: cutoff },
      anonymisedAt: null,
    },
    select: { id: true },
    take: BATCH_SIZE,
  });

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: "Deleted",
        lastName: "User",
        email: `deleted-${user.id}@anonymised.mentora.internal`,
        username: null,
        phoneNumber: null,
        whatsappNumber: null,
        googleAuthId: null,
        facebookAuthId: null,
        password: null,
        profilePictureUrl: null,
        address: null,
        anonymisedAt: new Date(),
      },
    });
  }

  if (users.length > 0) {
    await prisma.auditLog.create({
      data: {
        actorId: null,
        eventType: "accounts.anonymised",
        operation: LogOperation.ANONYMISE,
        category: LogCategory.WRITE,
        tableName: "users",
        targetType: "batch",
        newState: { count: users.length },
        changedFields: [],
      },
    });
    console.log({ event: "account_anonymisation_completed", count: users.length });
  }

  return users.length;
}

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    if (job.name === ANONYMISE_JOB) {
      return anonymiseDeactivatedAccounts();
    }
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error({
    event: "account_anonymisation_failed",
    job: job?.name,
    error: err.message,
  });
});
