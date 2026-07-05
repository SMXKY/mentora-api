import { Queue, Worker, Job } from "bullmq";
import { dispatchAllChannels } from "./notification.dispatcher";

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
};

const QUEUE_NAME = "notification-delivery";

const notificationQueue = new Queue(QUEUE_NAME, { connection });

const DELIVERY_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 }, // 5s, 10s, 20s
  removeOnComplete: true,
  removeOnFail: { count: 5000 }, // keep recent failures for inspection, never grow unbounded
};

export async function queueChannelDelivery(notificationId: string): Promise<void> {
  await notificationQueue.add("deliver", { notificationId }, DELIVERY_JOB_OPTS);
}

export async function queueChannelDeliveryBulk(
  notificationIds: string[]
): Promise<void> {
  if (notificationIds.length === 0) return;
  await notificationQueue.addBulk(
    notificationIds.map((notificationId) => ({
      name: "deliver",
      data: { notificationId },
      opts: DELIVERY_JOB_OPTS,
    }))
  );
}

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { notificationId } = job.data as { notificationId: string };
    await dispatchAllChannels(notificationId, job.attemptsMade + 1);
  },
  { connection }
);

worker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error({
    event: "notification_delivery_failed",
    notificationId: job?.data?.notificationId,
    attempt: job?.attemptsMade,
    error: err.message,
  });
});
