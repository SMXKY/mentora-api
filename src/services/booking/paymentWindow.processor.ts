import { Queue, Worker, Job } from "bullmq";
import prisma from "../../config/database.config";
import { BookingStatus, ConfigCategory, NotificationType, NotificationResourceType } from "../../generated/prisma";
import { NotificationService } from "../notification/notification.service";
import { assertValidTransition } from "./bookingStateMachine";
import { bookingConfig } from "./bookingConfig";

const connection = { host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT) || 6379 };

const QUEUE_NAME = "booking-payment-window";
const HEARTBEAT_KEY = "booking.payment_window_job_heartbeat";

const queue = new Queue(QUEUE_NAME, { connection });

function reminderJobId(bookingId: string) {
  return `reminder-${bookingId}`;
}
function expireJobId(bookingId: string) {
  return `expire-${bookingId}`;
}

export async function schedulePaymentWindowJobs(bookingId: string, expiresAt: Date): Promise<void> {
  const { paymentWindowReminderHours } = await bookingConfig.getAll();
  const reminderAt = new Date(expiresAt.getTime() - paymentWindowReminderHours * 60 * 60 * 1000);
  const now = Date.now();

  if (reminderAt.getTime() > now) {
    await queue.add(
      "reminder",
      { bookingId },
      {
        jobId: reminderJobId(bookingId),
        delay: reminderAt.getTime() - now,
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
  }

  await queue.add(
    "expire",
    { bookingId },
    {
      jobId: expireJobId(bookingId),
      delay: Math.max(expiresAt.getTime() - now, 0),
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
}

export async function cancelScheduledJobsForBooking(bookingId: string): Promise<void> {
  for (const jobId of [reminderJobId(bookingId), expireJobId(bookingId)]) {
    const job = await queue.getJob(jobId);
    if (job) await job.remove().catch(() => undefined);
  }
}

async function sendReminder(bookingId: string) {
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, deletedAt: null } });
  if (!booking || booking.status !== BookingStatus.ACCEPTED || !booking.bookerId) return;

  await NotificationService.send({
    type: NotificationType.PAYMENT_WINDOW_REMINDER,
    target: { kind: "user", userId: booking.bookerId },
    resourceType: NotificationResourceType.BOOKING,
    resourceId: booking.id,
  });
}

async function expireUnpaidBooking(bookingId: string) {
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, deletedAt: null } });
  if (!booking || booking.status !== BookingStatus.ACCEPTED) return;

  assertValidTransition(booking.status, BookingStatus.CANCELLED_UNPAID);
  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: BookingStatus.CANCELLED_UNPAID,
      cancelledAt: new Date(),
      cancellationReason: "Payment window expired without payment",
    },
  });

  if (booking.bookerId) {
    await NotificationService.send({
      type: NotificationType.BOOKING_CANCELLED_UNPAID,
      target: { kind: "user", userId: booking.bookerId },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: booking.id,
    });
  }
}

/** Safety-net sweep — catches any booking whose delayed job was lost (redis restart, etc). */
export async function sweepExpiredPaymentWindows(): Promise<{ expired: number }> {
  const overdue = await prisma.booking.findMany({
    where: {
      status: BookingStatus.ACCEPTED,
      paymentWindowExpiresAt: { lt: new Date() },
      deletedAt: null,
    },
    select: { id: true },
  });

  for (const b of overdue) {
    await expireUnpaidBooking(b.id).catch((err) =>
      console.error({ event: "payment_window_expire_failed", bookingId: b.id, error: err.message })
    );
  }

  // Dead man's switch: an admin dashboard (or external monitor) can alert
  // if this heartbeat hasn't advanced recently — mirrors the pattern used
  // by the search-score sweep job.
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
        category: ConfigCategory.BOOKING,
        description: "Last successful run of the payment-window sweep job (dead-man's-switch)",
        defaultValue: "",
        updatedById: systemActor.id,
      },
      update: { value: new Date().toISOString(), updatedById: systemActor.id },
    });
  }

  return { expired: overdue.length };
}

let worker: Worker | null = null;
let sweepInterval: NodeJS.Timeout | null = null;

export function startPaymentWindowWorker(): void {
  if (worker) return;
  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name === "reminder") await sendReminder(job.data.bookingId);
      else if (job.name === "expire") await expireUnpaidBooking(job.data.bookingId);
    },
    { connection }
  );
  worker.on("failed", (job, err) => {
    console.error({ event: "payment_window_job_failed", job: job?.name, error: err.message });
  });

  // Every 15 minutes — the dead-man's-switch safety net for lost delayed jobs.
  sweepInterval = setInterval(() => {
    sweepExpiredPaymentWindows().catch((err) =>
      console.error({ event: "payment_window_sweep_failed", error: err.message })
    );
  }, 15 * 60 * 1000);
}

export function stopPaymentWindowWorker(): void {
  if (sweepInterval) clearInterval(sweepInterval);
  sweepInterval = null;
  worker?.close();
  worker = null;
}
