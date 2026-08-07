import { Queue, Worker, Job } from "bullmq";
import { randomUUID } from "crypto";
import prisma from "../../config/database.config";
import redis from "../../config/redis.config";
import { roomServiceClient } from "../../config/livekit.config";
import { LiveSessionService, sessionStartAt, sessionEndAt } from "../../modules/liveSession/liveSession.service";
import { NotificationService } from "../notification/notification.service";
import { liveSessionConfig } from "./liveSessionConfig";
import {
  BookingStatus,
  SessionType,
  GroupSessionStatus,
  ParticipantPaymentStatus,
  ParticipantRole,
  LiveRoomStatus,
  SessionEndReason,
  ConfigCategory,
  NotificationType,
  NotificationResourceType,
} from "../../generated/prisma";

const connection = { host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT) || 6379 };
const QUEUE_NAME = "live-session-room-lifecycle";
const SWEEP_JOB = "sweep";
const HEARTBEAT_KEY = "live_sessions.room_lifecycle_job_heartbeat";
const ROOM_CREATE_LOCK_PREFIX = "live-session:room-create-lock:";
const TUTOR_NOT_JOINED_NOTIFIED_PREFIX = "live-session:tutor-not-joined-notified:";

const DEPARTURE_TIMEOUT_MINUTES = 15;
const TUTOR_GRACE_MINUTES = 10;
const MAX_ROOM_CREATION_ATTEMPTS = 8;
const ROOM_CREATE_WINDOW_MINUTES = 15;
// Grace after scheduledEndAt before we even consider polling — the real
// room_finished webhook normally arrives within seconds of the room closing,
// so this only fires once that window has clearly passed.
const STALE_ACTIVE_GRACE_MINUTES = 15;

const queue = new Queue(QUEUE_NAME, { connection });

async function getSessionPartyUserIds(bookingId: string): Promise<string[]> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { tutorProfile: { select: { userId: true } } },
  });
  if (!booking) return [];

  if (booking.isGroupSession) {
    const participants = await prisma.groupSessionParticipant.findMany({
      where: { bookingId, paymentStatus: ParticipantPaymentStatus.PAID },
      select: { studentId: true },
    });
    return [booking.tutorProfile.userId, ...participants.map((p) => p.studentId)];
  }

  return [booking.tutorProfile.userId, booking.bookerId].filter((id): id is string => !!id);
}

async function findUpcomingCandidates() {
  const now = new Date();
  const rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return prisma.booking.findMany({
    where: {
      deletedAt: null,
      sessionType: SessionType.ONLINE,
      liveRoom: null,
      sessionDate: { gte: rangeStart, lte: rangeEnd },
      OR: [
        { isGroupSession: false, status: { in: [BookingStatus.PAID, BookingStatus.IN_PROGRESS] } },
        { isGroupSession: true, groupSession: { status: GroupSessionStatus.CONFIRMED } },
      ],
    },
    include: { groupSession: { select: { maxStudents: true } } },
  });
}

async function notifyRoomCreationFailed(bookingId: string): Promise<void> {
  const targets = await getSessionPartyUserIds(bookingId);
  if (targets.length === 0) return;
  await NotificationService.send({
    type: NotificationType.SESSION_ROOM_CREATION_FAILED,
    target: { kind: "users", userIds: targets },
    resourceType: NotificationResourceType.BOOKING,
    resourceId: bookingId,
  }).catch(() => undefined);
}

async function createRoomForBooking(booking: {
  id: string;
  sessionDate: Date;
  sessionStartTime: Date;
  sessionEndTime: Date;
  isGroupSession: boolean;
  groupSession: { maxStudents: number } | null;
}): Promise<void> {
  const scheduledStartAt = sessionStartAt(booking);
  const scheduledEndAt = sessionEndAt(booking);
  const roomName = randomUUID();
  const maxParticipants = booking.isGroupSession ? (booking.groupSession?.maxStudents ?? 20) + 1 : 2;
  const { emptyTimeoutMinutes } = await liveSessionConfig.getAll();

  const liveRoom = await prisma.liveRoom.create({
    data: {
      bookingId: booking.id,
      roomName,
      status: LiveRoomStatus.PENDING,
      scheduledStartAt,
      scheduledEndAt,
      roomCreateAt: new Date(),
    },
  });

  try {
    await roomServiceClient.createRoom({
      name: roomName,
      emptyTimeout: emptyTimeoutMinutes * 60,
      departureTimeout: DEPARTURE_TIMEOUT_MINUTES * 60,
      maxParticipants,
      metadata: JSON.stringify({
        bookingId: booking.id,
        isGroupSession: booking.isGroupSession,
        scheduledStartAt: scheduledStartAt.toISOString(),
        scheduledEndAt: scheduledEndAt.toISOString(),
      }),
    });

    await prisma.liveRoom.update({
      where: { id: liveRoom.id },
      data: { status: LiveRoomStatus.CREATED, roomCreatedAt: new Date() },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await prisma.liveRoom.update({
      where: { id: liveRoom.id },
      data: {
        status: LiveRoomStatus.FAILED,
        creationFailedAt: new Date(),
        creationFailureReason: reason,
        creationAttempts: { increment: 1 },
      },
    });

    console.error({ event: "live_session_room_creation_failed", bookingId: booking.id, error: reason });
    await notifyRoomCreationFailed(booking.id);
    throw err;
  }
}

export async function createRoomsForUpcomingBookings(): Promise<{ created: number; failed: number }> {
  const candidates = await findUpcomingCandidates();
  const now = new Date();
  let created = 0;
  let failed = 0;

  for (const booking of candidates) {
    const start = sessionStartAt(booking);
    const minutesUntilStart = (start.getTime() - now.getTime()) / 60000;
    // Trigger from 15 minutes out; keep trying up to 2 hours past a missed
    // start (a delayed sweep still shouldn't leave a paid booking roomless
    // forever) but never resurrect something long over.
    if (minutesUntilStart > ROOM_CREATE_WINDOW_MINUTES || minutesUntilStart < -120) continue;

    const lockKey = `${ROOM_CREATE_LOCK_PREFIX}${booking.id}`;
    const acquired = await redis.set(lockKey, "1", { EX: 300, NX: true });
    if (!acquired) continue;

    await createRoomForBooking(booking).then(
      () => created++,
      () => failed++
    );
  }

  return { created, failed };
}

/**
 * A transient LiveKit outage (the exact scenario that happened in
 * production: the container wasn't up yet when a booking's window opened)
 * must never permanently strand a session — createRoomsForUpcomingBookings()
 * only looks at bookings with NO LiveRoom row at all, so once a row exists
 * (even FAILED) it's invisible to that sweep forever. This is the retry
 * path: re-attempt LiveKit room creation for any FAILED room whose session
 * hasn't fully closed out yet, reusing the same room name and updating the
 * existing row rather than creating a new one.
 */
async function findFailedRoomsToRetry() {
  const { emptyTimeoutMinutes } = await liveSessionConfig.getAll();
  const cutoff = new Date(Date.now() - emptyTimeoutMinutes * 60 * 1000);
  const rooms = await prisma.liveRoom.findMany({
    where: {
      status: LiveRoomStatus.FAILED,
      creationAttempts: { lt: MAX_ROOM_CREATION_ATTEMPTS },
      scheduledEndAt: { gte: cutoff },
    },
    include: {
      booking: { include: { groupSession: { select: { maxStudents: true } } } },
    },
  });
  return rooms.filter((r) => r.booking && !r.booking.deletedAt);
}

export async function retryFailedRoomCreations(): Promise<{ retried: number; recovered: number }> {
  const rooms = await findFailedRoomsToRetry();
  const { emptyTimeoutMinutes } = await liveSessionConfig.getAll();
  let recovered = 0;

  for (const room of rooms) {
    const booking = room.booking!;
    const maxParticipants = booking.isGroupSession ? (booking.groupSession?.maxStudents ?? 20) + 1 : 2;

    try {
      await roomServiceClient.createRoom({
        name: room.roomName,
        emptyTimeout: emptyTimeoutMinutes * 60,
        departureTimeout: DEPARTURE_TIMEOUT_MINUTES * 60,
        maxParticipants,
        metadata: JSON.stringify({
          bookingId: room.bookingId,
          isGroupSession: booking.isGroupSession,
          scheduledStartAt: room.scheduledStartAt.toISOString(),
          scheduledEndAt: room.scheduledEndAt.toISOString(),
        }),
      });

      await prisma.liveRoom.update({
        where: { id: room.id },
        data: { status: LiveRoomStatus.CREATED, roomCreatedAt: new Date(), creationAttempts: { increment: 1 } },
      });
      recovered++;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await prisma.liveRoom.update({
        where: { id: room.id },
        data: { creationFailedAt: new Date(), creationFailureReason: reason, creationAttempts: { increment: 1 } },
      });
      console.error({ event: "live_session_room_creation_retry_failed", bookingId: room.bookingId, error: reason });
      // No repeated notification per retry — the party was already told once
      // on the original failure; re-notifying every minute would be noise.
    }
  }

  return { retried: rooms.length, recovered };
}

async function notifyEmptyTimeout(bookingId: string): Promise<void> {
  const targets = await getSessionPartyUserIds(bookingId);
  if (targets.length === 0) return;
  await NotificationService.send({
    type: NotificationType.SESSION_EMPTY_TIMEOUT_CLOSED,
    target: { kind: "users", userIds: targets },
    resourceType: NotificationResourceType.BOOKING,
    resourceId: bookingId,
  }).catch(() => undefined);
}

export async function closeEmptyRooms(): Promise<{ closed: number }> {
  const { emptyTimeoutMinutes } = await liveSessionConfig.getAll();
  const cutoff = new Date(Date.now() - emptyTimeoutMinutes * 60 * 1000);
  const staleRooms = await prisma.liveRoom.findMany({
    where: {
      status: { in: [LiveRoomStatus.PENDING, LiveRoomStatus.CREATED] },
      scheduledStartAt: { lte: cutoff },
    },
  });

  let closed = 0;
  for (const room of staleRooms) {
    await prisma.liveRoom.update({ where: { id: room.id }, data: { endReason: SessionEndReason.EMPTY_TIMEOUT } });
    await roomServiceClient.deleteRoom(room.roomName).catch(() => undefined);
    await LiveSessionService.finalizeSession(room.id, SessionEndReason.EMPTY_TIMEOUT);
    await notifyEmptyTimeout(room.bookingId);
    closed++;
  }

  return { closed };
}

export async function flagTutorNotJoined(): Promise<{ flagged: number }> {
  const cutoff = new Date(Date.now() - TUTOR_GRACE_MINUTES * 60 * 1000);
  const activeRooms = await prisma.liveRoom.findMany({
    where: { status: LiveRoomStatus.ACTIVE, scheduledStartAt: { lte: cutoff } },
    include: { participants: true },
  });

  let flagged = 0;
  for (const room of activeRooms) {
    const tutorJoined = room.participants.some((p) => p.participantRole === ParticipantRole.TUTOR && p.firstJoinedAt);
    const someoneElseJoined = room.participants.some(
      (p) => p.participantRole !== ParticipantRole.TUTOR && p.firstJoinedAt
    );
    if (tutorJoined || !someoneElseJoined) continue;

    const dedupeKey = `${TUTOR_NOT_JOINED_NOTIFIED_PREFIX}${room.id}`;
    if (await redis.get(dedupeKey)) continue;
    await redis.set(dedupeKey, "1", { EX: 24 * 60 * 60 });

    const booking = await prisma.booking.findUnique({ where: { id: room.bookingId } });
    if (!booking) continue;

    const studentTargets = booking.isGroupSession
      ? (
          await prisma.groupSessionParticipant.findMany({
            where: { bookingId: room.bookingId, paymentStatus: ParticipantPaymentStatus.PAID },
            select: { studentId: true },
          })
        ).map((p) => p.studentId)
      : [booking.bookerId].filter((id): id is string => !!id);

    if (studentTargets.length === 0) continue;

    await NotificationService.send({
      type: NotificationType.SESSION_TUTOR_NOT_JOINED,
      target: { kind: "users", userIds: studentTargets },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: room.bookingId,
    }).catch(() => undefined);
    flagged++;
  }

  return { flagged };
}

/**
 * Fallback for a missed/delayed `room_finished` webhook (LiveKit's own docs:
 * "there are no guarantees around delivery" — a periodic poll of room state
 * is the documented mitigation). Only finalizes a room once LiveKit itself
 * confirms it no longer exists — a session legitimately running long past
 * its scheduled end is left alone, never force-closed by this sweep.
 */
export async function finalizeOrphanedActiveRooms(): Promise<{ finalized: number }> {
  const cutoff = new Date(Date.now() - STALE_ACTIVE_GRACE_MINUTES * 60 * 1000);
  const staleActiveRooms = await prisma.liveRoom.findMany({
    where: { status: LiveRoomStatus.ACTIVE, scheduledEndAt: { lte: cutoff } },
  });

  let finalized = 0;
  for (const room of staleActiveRooms) {
    const stillExists = await roomServiceClient.listRooms([room.roomName]).catch(() => null);
    if (stillExists === null || stillExists.length > 0) continue; // LiveKit unreachable, or session genuinely still live

    console.warn({
      event: "live_session_room_finished_webhook_missed",
      bookingId: room.bookingId,
      roomName: room.roomName,
    });
    await LiveSessionService.finalizeSession(room.id, SessionEndReason.TIMEOUT);
    finalized++;
  }

  return { finalized };
}

async function writeHeartbeat(): Promise<void> {
  const systemActor = await prisma.user.findFirst({
    where: { email: process.env.SUPER_ADMIN_EMAIL },
    select: { id: true },
  });
  if (!systemActor) return;

  await prisma.platformConfig.upsert({
    where: { key: HEARTBEAT_KEY },
    create: {
      key: HEARTBEAT_KEY,
      value: new Date().toISOString(),
      category: ConfigCategory.LIVE_SESSIONS,
      description: "Last successful live-session room lifecycle sweep",
      defaultValue: "",
      updatedById: systemActor.id,
    },
    update: { value: new Date().toISOString(), updatedById: systemActor.id },
  });
}

let worker: Worker | null = null;

export function startRoomLifecycleWorker(): void {
  if (worker) return;

  queue
    .add(SWEEP_JOB, {}, { repeat: { pattern: "*/1 * * * *" }, removeOnComplete: true, removeOnFail: { count: 200 } })
    .catch((err) => {
      console.error({
        event: "live_session_lifecycle_schedule_failed",
        error: err instanceof Error ? err.message : String(err),
      });
    });

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name !== SWEEP_JOB) return;
      await createRoomsForUpcomingBookings();
      await retryFailedRoomCreations();
      await closeEmptyRooms();
      await flagTutorNotJoined();
      await finalizeOrphanedActiveRooms();
      await writeHeartbeat();
    },
    { connection }
  );

  worker.on("failed", (job, err) => {
    console.error({ event: "live_session_lifecycle_job_failed", job: job?.name, error: err.message });
  });
}

export function stopRoomLifecycleWorker(): void {
  worker?.close();
  worker = null;
}
