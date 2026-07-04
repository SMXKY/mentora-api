import { Queue, Worker, Job } from "bullmq";
import { dispatchAllChannels } from "./notification.dispatcher";

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
};

const QUEUE_NAME = "notification-delivery";

const notificationQueue = new Queue(QUEUE_NAME, { connection });

export async function queueChannelDelivery(notificationId: string): Promise<void> {
  await notificationQueue.add(
    "deliver",
    { notificationId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 }, // 5s, 10s, 20s
      removeOnComplete: true,
      removeOnFail: false,
    }
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
