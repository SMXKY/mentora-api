import { Queue, Worker, Job } from "bullmq";
import prisma from "../../config/database.config";
import { GroupSessionStatus, ParticipantPaymentStatus, ConfigCategory } from "../../generated/prisma";
import { EscrowService } from "../payment/escrow.service";

const connection = { host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT) || 6379 };
const QUEUE_NAME = "group-session-cutoff";
const HEARTBEAT_KEY = "booking.group_session_cutoff_heartbeat";

const queue = new Queue(QUEUE_NAME, { connection });

function jobId(groupSessionId: string) {
  return `cutoff-${groupSessionId}`;
}

export async function scheduleGroupSessionCutoffJob(groupSessionId: string, cutoffAt: Date): Promise<void> {
  const delay = Math.max(cutoffAt.getTime() - Date.now(), 0);
  await queue.add(
    "cutoff",
    { groupSessionId },
    { jobId: jobId(groupSessionId), delay, removeOnComplete: true, removeOnFail: true }
  );
}

export async function resolveGroupSessionCutoff(groupSessionId: string): Promise<void> {
  const groupSession = await prisma.groupSession.findUnique({ where: { id: groupSessionId } });
  if (!groupSession || groupSession.status !== GroupSessionStatus.PUBLISHED) return;

  const paidParticipants = await prisma.groupSessionParticipant.findMany({
    where: { bookingId: groupSession.bookingId, paymentStatus: ParticipantPaymentStatus.PAID },
  });

  if (paidParticipants.length >= groupSession.minStudents) {
    await prisma.groupSession.update({ where: { id: groupSessionId }, data: { status: GroupSessionStatus.CONFIRMED } });
    return;
  }

  // Didn't meet the minimum — cancel and refund everyone who already paid.
  await prisma.groupSession.update({ where: { id: groupSessionId }, data: { status: GroupSessionStatus.CANCELLED } });
  for (const participant of paidParticipants) {
    const escrowHold = await prisma.escrowHold.findFirst({
      where: { groupParticipantId: participant.id, status: "HELD" },
    });
    if (escrowHold) {
      await EscrowService.refundEscrowToPayer(escrowHold.id).catch((err) =>
        console.error({ event: "group_session_refund_failed", participantId: participant.id, error: err.message })
      );
    }
  }
}

let worker: Worker | null = null;

export function startGroupSessionCutoffWorker(): void {
  if (worker) return;
  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      await resolveGroupSessionCutoff(job.data.groupSessionId);

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
            description: "Last successful group-session cutoff resolution",
            defaultValue: "",
            updatedById: systemActor.id,
          },
          update: { value: new Date().toISOString(), updatedById: systemActor.id },
        });
      }
    },
    { connection }
  );
  worker.on("failed", (job, err) => {
    console.error({ event: "group_session_cutoff_job_failed", job: job?.name, error: err.message });
  });
}

export function stopGroupSessionCutoffWorker(): void {
  worker?.close();
  worker = null;
}
