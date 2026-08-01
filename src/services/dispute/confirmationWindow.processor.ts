import { Queue, Worker, Job } from "bullmq";
import prisma from "../../config/database.config";
import { BookingStatus, ConfigCategory, NotificationType, NotificationResourceType } from "../../generated/prisma";
import { NotificationService } from "../notification/notification.service";
import { assertValidTransition } from "../booking/bookingStateMachine";
import { EscrowService } from "../payment/escrow.service";
import { disputeConfig } from "./disputeConfig";

const connection = { host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT) || 6379 };
const QUEUE_NAME = "lesson-confirmation-window";
const HEARTBEAT_KEY = "dispute.confirmation_window_job_heartbeat";

const queue = new Queue(QUEUE_NAME, { connection });

function reminderJobId(bookingId: string) {
  return `confirm-reminder-${bookingId}`;
}
function autoReleaseJobId(bookingId: string) {
  return `confirm-auto-release-${bookingId}`;
}

export async function scheduleConfirmationWindowJobs(bookingId: string, windowClosesAt: Date): Promise<void> {
  const { confirmationReminderHours } = await disputeConfig.getAll();
  const reminderAt = new Date(windowClosesAt.getTime() - confirmationReminderHours * 60 * 60 * 1000);
  const now = Date.now();

  if (reminderAt.getTime() > now) {
    await queue.add(
      "reminder",
      { bookingId },
      { jobId: reminderJobId(bookingId), delay: reminderAt.getTime() - now, removeOnComplete: true, removeOnFail: true }
    );
  }

  await queue.add(
    "auto-release",
    { bookingId },
    {
      jobId: autoReleaseJobId(bookingId),
      delay: Math.max(windowClosesAt.getTime() - now, 0),
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
}

/** Called when a dispute opens — the auto-release must never fire once a dispute is in play. */
export async function cancelConfirmationWindowJobs(bookingId: string): Promise<void> {
  for (const jobId of [reminderJobId(bookingId), autoReleaseJobId(bookingId)]) {
    const job = await queue.getJob(jobId);
    if (job) await job.remove().catch(() => undefined);
  }
}

async function sendReminder(bookingId: string) {
  const confirmation = await prisma.lessonConfirmation.findUnique({ where: { bookingId } });
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!confirmation || confirmation.action || !booking || booking.status !== BookingStatus.AWAITING_CONFIRMATION) return;
  if (!booking.bookerId) return;

  await NotificationService.send({
    type: NotificationType.LESSON_CONFIRMATION_REMINDER,
    target: { kind: "user", userId: booking.bookerId },
    resourceType: NotificationResourceType.BOOKING,
    resourceId: bookingId,
  });
}

async function autoRelease(bookingId: string) {
  const confirmation = await prisma.lessonConfirmation.findUnique({ where: { bookingId }, include: { dispute: true } });
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!confirmation || confirmation.action || confirmation.dispute) return;
  if (!booking || booking.status !== BookingStatus.AWAITING_CONFIRMATION) return;

  assertValidTransition(booking.status, BookingStatus.AUTO_CONFIRMED);

  await prisma.$transaction([
    prisma.lessonConfirmation.update({
      where: { id: confirmation.id },
      data: { action: "AUTO_CONFIRMED", confirmedAt: new Date() },
    }),
    prisma.booking.update({ where: { id: bookingId }, data: { status: BookingStatus.AUTO_CONFIRMED } }),
  ]);

  const escrowHold = await prisma.escrowHold.findFirst({ where: { bookingId, status: "HELD" } });
  if (escrowHold) {
    await EscrowService.releaseEscrowToTutor(escrowHold.id, { autoReleased: true });
  }

  const { openReviewWindow } = await import("../review/reviewWindow.service");
  await openReviewWindow(bookingId).catch((err) =>
    console.error({ event: "review_window_open_failed", bookingId, error: err.message })
  );

  const { MessagingService } = await import("../../modules/messaging/messaging.service");
  await MessagingService.archiveForBooking(bookingId).catch((err) =>
    console.error({ event: "conversation_archive_failed", bookingId, error: err.message })
  );

  if (booking.bookerId) {
    await NotificationService.send({
      type: NotificationType.LESSON_AUTO_CONFIRMED,
      target: { kind: "user", userId: booking.bookerId },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: bookingId,
    });
  }
}

/** Safety-net sweep for lost delayed jobs — mirrors the payment-window sweep. */
export async function sweepExpiredConfirmationWindows(): Promise<{ released: number }> {
  const overdue = await prisma.lessonConfirmation.findMany({
    where: { action: null, windowClosesAt: { lt: new Date() }, dispute: null },
    select: { bookingId: true },
  });

  for (const c of overdue) {
    await autoRelease(c.bookingId).catch((err) =>
      console.error({ event: "confirmation_auto_release_failed", bookingId: c.bookingId, error: err.message })
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
        category: ConfigCategory.DISPUTE,
        description: "Last successful run of the lesson-confirmation auto-release sweep (dead-man's-switch)",
        defaultValue: "",
        updatedById: systemActor.id,
      },
      update: { value: new Date().toISOString(), updatedById: systemActor.id },
    });
  }

  return { released: overdue.length };
}

let worker: Worker | null = null;
let sweepInterval: NodeJS.Timeout | null = null;

export function startConfirmationWindowWorker(): void {
  if (worker) return;
  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name === "reminder") await sendReminder(job.data.bookingId);
      else if (job.name === "auto-release") await autoRelease(job.data.bookingId);
    },
    { connection }
  );
  worker.on("failed", (job, err) => {
    console.error({ event: "confirmation_window_job_failed", job: job?.name, error: err.message });
  });

  sweepInterval = setInterval(() => {
    sweepExpiredConfirmationWindows().catch((err) =>
      console.error({ event: "confirmation_window_sweep_failed", error: err.message })
    );
  }, 15 * 60 * 1000);
}

export function stopConfirmationWindowWorker(): void {
  if (sweepInterval) clearInterval(sweepInterval);
  sweepInterval = null;
  worker?.close();
  worker = null;
}
