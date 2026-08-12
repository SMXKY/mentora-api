import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { TrackSource, TrackType, ParticipantInfo, TrackInfo } from "livekit-server-sdk";
import prisma from "../../config/database.config";
import redis from "../../config/redis.config";
import { AppError } from "../../utils/AppError.util";
import { ServiceContext } from "../../base/base.types";
import { AuditService } from "../../utils/logUserActivity.util";
import { NotificationService } from "../../services/notification/notification.service";
import { assertValidTransition } from "../../services/booking/bookingStateMachine";
import { sessionStartAt, sessionEndAt } from "../availability/availability.logic";
import { liveSessionConfig } from "../../services/liveSession/liveSessionConfig";
import { LessonConfirmationService } from "../../services/dispute/lessonConfirmation.service";
import {
  computeAutoResolutionRecommendation,
  SessionAttendanceInput,
} from "../../services/dispute/autoResolution.util";
import { roomServiceClient, createAccessToken, VideoGrant } from "../../config/livekit.config";
import { ensureLiveKitRoomExists } from "../../services/liveSession/roomProvisioning";
import { LIVEKIT_PUBLIC_URL } from "../../utils/enviromentVariablesCheck.util";
import { permissions } from "../../data/permission.data";
import { emitToUser } from "../../socket/index";
import {
  BookingStatus,
  SessionType,
  ParticipantPaymentStatus,
  ParticipantRole,
  LiveRoomStatus,
  SessionEndReason,
  ParticipantEventType,
  ConnectionQuality,
  NotificationType,
  NotificationResourceType,
} from "../../generated/prisma";

const TOKEN_EXPIRY_BUFFER_SECONDS = 30 * 60;
const OBSERVER_TOKEN_TTL_SECONDS = 4 * 60 * 60;
const ONE_ON_ONE_JOINABLE_STATUSES: BookingStatus[] = [
  BookingStatus.PAID,
  BookingStatus.IN_PROGRESS,
  BookingStatus.AWAITING_CONFIRMATION,
];

function deny(): AppError {
  return new AppError("liveSession/errors:accessDenied", StatusCodes.FORBIDDEN);
}

// Re-exported for callers (e.g. roomLifecycle.processor.ts) that already
// import these from here — the actual, WAT-correct implementation lives in
// availability.logic.ts, the single source of truth for this conversion.
export { sessionStartAt, sessionEndAt };

const bookingAccessInclude = {
  tutorProfile: { select: { userId: true } },
  studentProfile: { select: { userId: true } },
  groupSession: { select: { id: true, status: true, maxStudents: true } },
} as const;

type BookingWithAccessRelations = NonNullable<
  Awaited<ReturnType<typeof prisma.booking.findFirst<{ where: any; include: typeof bookingAccessInclude }>>>
>;

export type AccessRole = "TUTOR" | "STUDENT" | "PARENT";

export interface SessionAccess {
  booking: BookingWithAccessRelations;
  role: AccessRole;
  participantRole: ParticipantRole;
}

/**
 * The single gate for "may this user be in this room" — booking (and, for
 * group sessions, per-student payment) is the only source of truth. Every
 * denial path throws the same generic 403 so a non-participant can't tell
 * a real booking from a made-up id, or an unpaid booking from a paid one.
 */
async function resolveSessionAccess(bookingId: string, userId: string): Promise<SessionAccess> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, deletedAt: null },
    include: bookingAccessInclude,
  });

  if (!booking) throw deny();
  if (booking.sessionType !== SessionType.ONLINE) throw deny();

  const isTutor = booking.tutorProfile.userId === userId;

  if (booking.isGroupSession) {
    const { groupSessionsEnabled } = await liveSessionConfig.getAll();
    if (!groupSessionsEnabled) {
      throw new AppError("liveSession/errors:groupSessionsDisabled", StatusCodes.NOT_FOUND);
    }

    if (isTutor) return { booking, role: "TUTOR", participantRole: ParticipantRole.TUTOR };

    const participant = await prisma.groupSessionParticipant.findFirst({
      where: { bookingId, studentId: userId, paymentStatus: ParticipantPaymentStatus.PAID },
    });
    if (!participant) throw deny();
    return { booking, role: "STUDENT", participantRole: ParticipantRole.STUDENT };
  }

  if (!ONE_ON_ONE_JOINABLE_STATUSES.includes(booking.status)) throw deny();
  if (isTutor) return { booking, role: "TUTOR", participantRole: ParticipantRole.TUTOR };
  if (booking.bookerId !== userId) throw deny();

  const isStudentBooker = booking.studentProfile?.userId === userId;
  return {
    booking,
    role: isStudentBooker ? "STUDENT" : "PARENT",
    participantRole: isStudentBooker ? ParticipantRole.STUDENT : ParticipantRole.PARENT,
  };
}

/**
 * Backs the persistent app-wide "session live" banner (Epic 4): every ACTIVE
 * 1:1 room the user is a party to, regardless of whether this device is the
 * one currently inside LiveSessionScreen — so it's correct even on a device
 * that never received the original call/room_live push (cold start, a
 * second device, a missed socket event).
 */
async function listActiveSessionsForUser(userId: string) {
  const rooms = await prisma.liveRoom.findMany({
    where: {
      status: LiveRoomStatus.ACTIVE,
      booking: {
        deletedAt: null,
        isGroupSession: false,
        OR: [{ bookerId: userId }, { tutorProfile: { userId } }],
      },
    },
    include: {
      booking: {
        select: {
          bookerId: true,
          tutorProfile: {
            select: { userId: true, profilePictureUrl: true, user: { select: { firstName: true, lastName: true } } },
          },
          booker: { select: { firstName: true, lastName: true, profilePictureUrl: true } },
        },
      },
    },
  });

  return rooms.map((room) => {
    const isTutor = room.booking.tutorProfile.userId === userId;
    const counterpart = isTutor
      ? room.booking.booker
        ? { firstName: room.booking.booker.firstName, lastName: room.booking.booker.lastName, profilePictureUrl: room.booking.booker.profilePictureUrl }
        : null
      : {
          firstName: room.booking.tutorProfile.user.firstName,
          lastName: room.booking.tutorProfile.user.lastName,
          profilePictureUrl: room.booking.tutorProfile.profilePictureUrl,
        };

    return {
      bookingId: room.bookingId,
      scheduledStartAt: room.scheduledStartAt,
      scheduledEndAt: room.scheduledEndAt,
      actualStartAt: room.actualStartAt,
      counterpartName: counterpart ? [counterpart.firstName, counterpart.lastName].filter(Boolean).join(" ") : null,
      counterpartPhotoUrl: counterpart?.profilePictureUrl ?? null,
    };
  });
}

async function getRoomOrThrow(bookingId: string) {
  const liveRoom = await prisma.liveRoom.findUnique({ where: { bookingId } });
  if (!liveRoom) throw new AppError("liveSession/errors:roomNotReady", StatusCodes.NOT_FOUND);
  return liveRoom;
}

function buildGrant(role: AccessRole, roomName: string, isGroup: boolean): VideoGrant {
  const base: VideoGrant = { room: roomName, roomJoin: true, canSubscribe: true, canPublishData: true };

  if (role === "TUTOR") {
    // No roomAdmin here — every admin action (mute/remove/lock/end) is
    // proxied through our backend's roomServiceClient (server API key), the
    // tutor's own client token never calls LiveKit admin APIs directly. A
    // leaked tutor token with roomAdmin could otherwise call LiveKit's HTTP
    // Twirp API directly, bypassing our own auth/audit trail entirely.
    return { ...base, canPublish: true };
  }
  if (isGroup) {
    // Screen share off by default in group sessions — the tutor grants it
    // per student via grantScreenShare(), which widens canPublishSources
    // directly on the live LiveKit participant.
    return { ...base, canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE] };
  }
  return { ...base, canPublish: true };
}

async function isRoomLocked(roomName: string): Promise<boolean> {
  const [room] = await roomServiceClient.listRooms([roomName]).catch(() => []);
  if (!room?.metadata) return false;
  try {
    return JSON.parse(room.metadata)?.locked === true;
  } catch {
    return false;
  }
}

async function generateToken(
  userId: string,
  bookingId: string,
  input: { deviceType?: string },
  req: { userAgent?: string }
) {
  const access = await resolveSessionAccess(bookingId, userId);
  const liveRoom = await getRoomOrThrow(bookingId);
  if (liveRoom.status !== LiveRoomStatus.CREATED && liveRoom.status !== LiveRoomStatus.ACTIVE) {
    throw new AppError("liveSession/errors:roomNotReady", StatusCodes.NOT_FOUND);
  }

  // Self-hosted LiveKit holds room state in memory only — a server
  // restart silently drops every room with no webhook fired, leaving this
  // row saying CREATED/ACTIVE while the room itself is gone. Checked here,
  // on the join hot path, rather than only in the periodic sweep, so a
  // user hitting "join" doesn't get "room does not exist" and have to wait
  // for the next sweep tick to self-heal.
  await ensureLiveKitRoomExists({
    roomName: liveRoom.roomName,
    bookingId,
    isGroupSession: access.booking.isGroupSession,
    maxStudents: access.booking.groupSession?.maxStudents ?? null,
    scheduledStartAt: liveRoom.scheduledStartAt,
    scheduledEndAt: liveRoom.scheduledEndAt,
  });

  const existingParticipant = await prisma.sessionParticipant.findUnique({
    where: { liveRoomId_userId: { liveRoomId: liveRoom.id, userId } },
  });

  if (access.role !== "TUTOR" && !existingParticipant && (await isRoomLocked(liveRoom.roomName))) {
    throw new AppError("liveSession/errors:roomNotReady", StatusCodes.CONFLICT);
  }

  const scheduledEnd = sessionEndAt(access.booking);
  const secondsUntilEnd = Math.floor((scheduledEnd.getTime() - Date.now()) / 1000);
  const ttlSeconds = Math.max(60, secondsUntilEnd) + TOKEN_EXPIRY_BUFFER_SECONDS;

  const grant = buildGrant(access.role, liveRoom.roomName, access.booking.isGroupSession);
  const token = await createAccessToken({ identity: userId, ttlSeconds, grant });

  await prisma.sessionParticipant.upsert({
    where: { liveRoomId_userId: { liveRoomId: liveRoom.id, userId } },
    create: {
      liveRoomId: liveRoom.id,
      userId,
      participantRole: access.participantRole,
      livekitParticipantIdentity: userId,
      deviceType: input.deviceType,
      browser: req.userAgent?.slice(0, 100),
    },
    update: {
      deviceType: input.deviceType ?? undefined,
      browser: req.userAgent?.slice(0, 100),
    },
  });

  if (access.role === "TUTOR" && access.booking.isGroupSession) {
    await notifyGroupRoomLive(bookingId).catch(() => undefined);
  }

  return {
    token,
    url: LIVEKIT_PUBLIC_URL,
    roomName: liveRoom.roomName,
    identity: userId,
    role: access.role,
    expiresInSeconds: ttlSeconds,
    // Server-authoritative timer inputs — the client derives its countdown
    // from these plus its own request/response round trip rather than
    // trusting its local clock, which can be skewed or drift during a call.
    serverNow: new Date().toISOString(),
    scheduledStartAt: liveRoom.scheduledStartAt.toISOString(),
    scheduledEndAt: liveRoom.scheduledEndAt.toISOString(),
    actualStartAt: liveRoom.actualStartAt ? liveRoom.actualStartAt.toISOString() : null,
  };
}

async function notifyGroupRoomLive(bookingId: string): Promise<void> {
  const dedupeKey = `live-session:group-live-notified:${bookingId}`;
  if (await redis.get(dedupeKey)) return;
  await redis.set(dedupeKey, "1", { EX: 6 * 60 * 60 });

  const participants = await prisma.groupSessionParticipant.findMany({
    where: { bookingId, paymentStatus: ParticipantPaymentStatus.PAID },
    select: { studentId: true },
  });
  if (participants.length === 0) return;

  for (const p of participants) {
    emitToUser(p.studentId, "session:room_live", { bookingId });
  }

  await NotificationService.send({
    type: NotificationType.SESSION_REMINDER_1HR,
    target: { kind: "users", userIds: participants.map((p) => p.studentId) },
    resourceType: NotificationResourceType.BOOKING,
    resourceId: bookingId,
  }).catch(() => undefined);
}

// ============================================================
// WhatsApp-style call signaling (one-on-one only) — booking
// access is re-checked on every initiate so a stale/unpaid
// booking can never ring the other party.
// ============================================================

const RING_TIMEOUT_MS = 30_000;
const pendingRings = new Map<string, NodeJS.Timeout>();

function ringKey(bookingId: string, calleeId: string): string {
  return `${bookingId}:${calleeId}`;
}

async function initiateCall(callerId: string, bookingId: string): Promise<void> {
  const access = await resolveSessionAccess(bookingId, callerId);
  if (access.booking.isGroupSession) return; // group sessions never ring — join only

  const calleeId = access.role === "TUTOR" ? access.booking.bookerId : access.booking.tutorProfile.userId;
  if (!calleeId) return;

  // A callee who has already joined this room before (i.e. this is a
  // reconnect/rejoin, not their first time being called for this session)
  // never gets the full-screen incoming-call UI again — LiveKit's own
  // reconnect flow handles a transient drop, and the persistent "session
  // live" banner (see LiveSessionBanner) covers the case where they need a
  // way back in.
  const liveRoom = await prisma.liveRoom.findUnique({ where: { bookingId } });
  if (liveRoom) {
    const existingCalleeParticipant = await prisma.sessionParticipant.findUnique({
      where: { liveRoomId_userId: { liveRoomId: liveRoom.id, userId: calleeId } },
    });
    if (existingCalleeParticipant?.firstJoinedAt) return;
  }

  const key = ringKey(bookingId, calleeId);
  if (pendingRings.has(key)) return; // already ringing this callee for this booking

  const caller = await prisma.user.findUnique({
    where: { id: callerId },
    select: { firstName: true, lastName: true, profilePictureUrl: true },
  });
  const callerName = caller ? `${caller.firstName} ${caller.lastName}`.trim() : "";

  emitToUser(calleeId, "session:call:incoming", {
    bookingId,
    callerId,
    callerName,
    callerPhotoUrl: caller?.profilePictureUrl ?? null,
    ringSeconds: RING_TIMEOUT_MS / 1000,
  });

  // The socket emit above only reaches a foregrounded, connected client —
  // it produces no sound/vibration on a locked or backgrounded device.
  // This push (OS default sound/ringtone, nothing overridden — see
  // push.channel.ts) is what actually makes the device ring, so it has to
  // fire now, at call start, not only after the ring is already missed.
  NotificationService.send({
    type: NotificationType.SESSION_INCOMING_CALL,
    target: { kind: "user", userId: calleeId },
    resourceType: NotificationResourceType.BOOKING,
    resourceId: bookingId,
    data: { callerName },
  }).catch(() => undefined);

  const timeout = setTimeout(() => {
    pendingRings.delete(key);
    emitToUser(callerId, "session:call:missed", { bookingId, calleeId });
  }, RING_TIMEOUT_MS);

  pendingRings.set(key, timeout);
}

function clearRing(bookingId: string, calleeId: string): void {
  const key = ringKey(bookingId, calleeId);
  const timeout = pendingRings.get(key);
  if (timeout) {
    clearTimeout(timeout);
    pendingRings.delete(key);
  }
}

/**
 * Distinguishes "left on purpose" from a network drop for the other party's
 * UI (a network drop leaves the LiveKit room's participant list looking the
 * same either way — LiveKit itself doesn't tell the other side why someone
 * disappeared). Fired from the client's unmount/leave path, not from a
 * button click specifically, so it fires the same way whether the user hit
 * Leave, hit End Session, or just navigated away.
 */
async function notifyPeerLeft(leavingUserId: string, bookingId: string): Promise<void> {
  const access = await resolveSessionAccess(bookingId, leavingUserId).catch(() => null);
  if (!access || access.booking.isGroupSession) return;

  const peerId = access.role === "TUTOR" ? access.booking.bookerId : access.booking.tutorProfile.userId;
  if (!peerId) return;

  emitToUser(peerId, "session:peer_left", { bookingId, userId: leavingUserId });
}

// "Ignore" (the only other choice on the incoming prompt) is intentionally
// not a server call at all — it never tells the caller anything, the ring
// just stops locally. There's nothing to "reject": Epic 1 dropped the
// accept/decline gate entirely, the session already exists the moment
// either party starts it.
function acceptCall(calleeId: string, bookingId: string, callerId: string): void {
  clearRing(bookingId, calleeId);
  emitToUser(callerId, "session:call:accepted", { bookingId, calleeId });
}

async function generateObserverToken(ctx: ServiceContext, bookingId: string) {
  const { adminObserveEnabled } = await liveSessionConfig.getAll();
  if (!adminObserveEnabled) {
    throw new AppError("liveSession/errors:observerModeDisabled", StatusCodes.FORBIDDEN);
  }

  const liveRoom = await getRoomOrThrow(bookingId);
  const grant: VideoGrant = {
    room: liveRoom.roomName,
    roomJoin: true,
    canSubscribe: true,
    canPublish: false,
    canPublishData: false,
    hidden: true,
  };
  const identity = `observer-${ctx.userId}-${randomUUID().slice(0, 8)}`;
  const token = await createAccessToken({ identity, ttlSeconds: OBSERVER_TOKEN_TTL_SECONDS, grant });

  AuditService.record(ctx, "live_rooms", {
    operation: "READ" as any,
    category: "READ" as any,
    recordId: liveRoom.id,
    eventType: "live_session_observer_token_issued",
  });

  return { token, url: LIVEKIT_PUBLIC_URL, roomName: liveRoom.roomName };
}

async function requireTutorRoom(bookingId: string, userId: string) {
  const access = await resolveSessionAccess(bookingId, userId);
  if (access.role !== "TUTOR") throw new AppError("liveSession/errors:notTutor", StatusCodes.FORBIDDEN);
  const liveRoom = await getRoomOrThrow(bookingId);
  return { access, liveRoom };
}

async function getSessionParticipantOrThrow(liveRoomId: string, userId: string) {
  const participant = await prisma.sessionParticipant.findUnique({
    where: { liveRoomId_userId: { liveRoomId, userId } },
  });
  if (!participant) throw new AppError("liveSession/errors:targetNotInRoom", StatusCodes.NOT_FOUND);
  return participant;
}

async function muteAudioTracks(roomName: string, identity: string): Promise<void> {
  const participants = await roomServiceClient.listParticipants(roomName).catch(() => [] as ParticipantInfo[]);
  const target = participants.find((p: ParticipantInfo) => p.identity === identity);
  const audioTracks = target?.tracks.filter((t: TrackInfo) => t.type === TrackType.AUDIO) ?? [];
  await Promise.all(
    audioTracks.map((t: TrackInfo) => roomServiceClient.mutePublishedTrack(roomName, identity, t.sid, true).catch(() => undefined))
  );
}

async function muteParticipant(tutorUserId: string, bookingId: string, targetUserId: string, ctx: ServiceContext) {
  const { liveRoom } = await requireTutorRoom(bookingId, tutorUserId);
  const target = await getSessionParticipantOrThrow(liveRoom.id, targetUserId);

  await muteAudioTracks(liveRoom.roomName, targetUserId);

  await prisma.participantEvent.create({
    data: {
      liveRoomId: liveRoom.id,
      sessionParticipantId: target.id,
      userId: targetUserId,
      eventType: ParticipantEventType.MUTED,
      actionedById: tutorUserId,
      source: "tutor_action",
    },
  });

  return { muted: true };
}

async function removeParticipant(tutorUserId: string, bookingId: string, targetUserId: string, ctx: ServiceContext) {
  const { liveRoom } = await requireTutorRoom(bookingId, tutorUserId);
  const target = await getSessionParticipantOrThrow(liveRoom.id, targetUserId);

  await roomServiceClient.removeParticipant(liveRoom.roomName, targetUserId).catch(() => undefined);

  await prisma.participantEvent.create({
    data: {
      liveRoomId: liveRoom.id,
      sessionParticipantId: target.id,
      userId: targetUserId,
      eventType: ParticipantEventType.REMOVED,
      actionedById: tutorUserId,
      source: "tutor_action",
    },
  });

  return { removed: true };
}

async function lockRoom(tutorUserId: string, bookingId: string, ctx: ServiceContext) {
  const { liveRoom } = await requireTutorRoom(bookingId, tutorUserId);
  await roomServiceClient.updateRoomMetadata(liveRoom.roomName, JSON.stringify({ bookingId, locked: true }));

  AuditService.record(ctx, "live_rooms", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: liveRoom.id,
    newState: { locked: true },
    eventType: "live_session_locked",
  });

  return { locked: true };
}

async function endSession(tutorUserId: string, bookingId: string, ctx: ServiceContext) {
  const { liveRoom } = await requireTutorRoom(bookingId, tutorUserId);

  await prisma.liveRoom.update({ where: { id: liveRoom.id }, data: { endReason: SessionEndReason.TUTOR_ENDED } });

  AuditService.record(ctx, "live_rooms", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: liveRoom.id,
    newState: { endReason: "TUTOR_ENDED" },
    eventType: "live_session_ended_by_tutor",
  });

  // Graceful leave, not a hard delete: the tutor's own client disconnects
  // itself after this call succeeds (see endCall in LiveSessionScreen), but
  // the room itself stays up for the other party to keep talking or wrap up
  // — deleteRoom() used to disconnect everyone immediately, which meant
  // "End Session" from the tutor's side cut the student off mid-sentence.
  // The room only actually closes once occupancy hits 0 and LiveKit's own
  // emptyTimeout elapses, firing room_finished -> handleRoomFinished ->
  // finalizeSession, which will use the endReason set above (TUTOR_ENDED)
  // rather than falling back to ALL_LEFT.
  return { ended: true };
}

async function muteAll(tutorUserId: string, bookingId: string, ctx: ServiceContext) {
  const { access, liveRoom } = await requireTutorRoom(bookingId, tutorUserId);
  if (!access.booking.isGroupSession) {
    throw new AppError("liveSession/errors:groupSessionsDisabled", StatusCodes.BAD_REQUEST);
  }

  const participants = await roomServiceClient.listParticipants(liveRoom.roomName).catch(() => [] as ParticipantInfo[]);
  for (const p of participants) {
    if (p.identity === tutorUserId) continue;
    const audioTracks = p.tracks.filter((t: TrackInfo) => t.type === TrackType.AUDIO);
    await Promise.all(
      audioTracks.map((t: TrackInfo) =>
        roomServiceClient.mutePublishedTrack(liveRoom.roomName, p.identity, t.sid, true).catch(() => undefined)
      )
    );
  }

  AuditService.record(ctx, "live_rooms", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: liveRoom.id,
    eventType: "live_session_mute_all",
  });

  return { muted: true };
}

async function grantScreenShare(tutorUserId: string, bookingId: string, targetUserId: string, ctx: ServiceContext) {
  const { access, liveRoom } = await requireTutorRoom(bookingId, tutorUserId);
  if (!access.booking.isGroupSession) {
    throw new AppError("liveSession/errors:groupSessionsDisabled", StatusCodes.BAD_REQUEST);
  }
  await getSessionParticipantOrThrow(liveRoom.id, targetUserId);

  await roomServiceClient.updateParticipant(liveRoom.roomName, targetUserId, {
    permission: {
      canSubscribe: true,
      canPublish: true,
      canPublishData: true,
      canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE],
    },
  });

  AuditService.record(ctx, "live_rooms", {
    operation: "UPDATE" as any,
    category: "WRITE" as any,
    recordId: liveRoom.id,
    newState: { screenShareGrantedTo: targetUserId },
    eventType: "live_session_screen_share_granted",
  });

  return { granted: true };
}

async function recordConnectionQuality(
  userId: string,
  bookingId: string,
  quality: ConnectionQuality,
  durationSeconds?: number
) {
  await resolveSessionAccess(bookingId, userId);
  const liveRoom = await getRoomOrThrow(bookingId);
  const participant = await getSessionParticipantOrThrow(liveRoom.id, userId);

  await prisma.connectionQualityEvent.create({
    data: { liveRoomId: liveRoom.id, sessionParticipantId: participant.id, userId, quality, durationSeconds },
  });

  return { recorded: true };
}

async function listChat(userId: string, bookingId: string, options: { cursor?: string; limit: number }) {
  await resolveSessionAccess(bookingId, userId);
  const liveRoom = await getRoomOrThrow(bookingId);

  const messages = await prisma.sessionChatMessage.findMany({
    where: { liveRoomId: liveRoom.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: options.limit,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });

  return messages;
}

async function postChatMessage(userId: string, bookingId: string, content: string, replyToId?: string) {
  await resolveSessionAccess(bookingId, userId);
  const liveRoom = await getRoomOrThrow(bookingId);

  return prisma.sessionChatMessage.create({
    data: { liveRoomId: liveRoom.id, senderId: userId, content, replyToId },
  });
}

async function getAdminAudit(bookingId: string) {
  const liveRoom = await prisma.liveRoom.findUnique({
    where: { bookingId },
    include: {
      participants: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      events: { orderBy: { occurredAt: "asc" } },
      qualityEvents: { orderBy: { occurredAt: "asc" } },
      chatMessages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!liveRoom) throw new AppError("liveSession/errors:roomNotReady", StatusCodes.NOT_FOUND);
  return liveRoom;
}

// ============================================================
// LiveKit webhook processing — the single writer of session
// ground truth (LiveRoom/SessionParticipant/ParticipantEvent).
// ============================================================

async function findRoomByName(roomName: string) {
  return prisma.liveRoom.findUnique({ where: { roomName } });
}

async function handleRoomStarted(roomName: string): Promise<void> {
  const liveRoom = await findRoomByName(roomName);
  if (!liveRoom || liveRoom.status === LiveRoomStatus.ACTIVE) return;

  await prisma.liveRoom.update({
    where: { id: liveRoom.id },
    data: { status: LiveRoomStatus.ACTIVE, actualStartAt: liveRoom.actualStartAt ?? new Date() },
  });

  const booking = await prisma.booking.findUnique({
    where: { id: liveRoom.bookingId },
    include: { tutorProfile: { select: { userId: true } } },
  });
  if (booking && booking.status === BookingStatus.PAID) {
    assertValidTransition(booking.status, BookingStatus.IN_PROGRESS);
    await prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.IN_PROGRESS } });
  }

  // Feeds the persistent app-wide "session live" banner (Epic 4) for
  // whichever party isn't currently the one inside LiveSessionScreen —
  // 1:1 only, group sessions already get their own room_live push from
  // notifyGroupRoomLive at token-generation time.
  if (booking && !booking.isGroupSession) {
    const partyIds = [booking.tutorProfile.userId, booking.bookerId].filter((id): id is string => !!id);
    for (const uid of partyIds) emitToUser(uid, "session:room_live", { bookingId: liveRoom.bookingId });
  }
}

async function handleParticipantJoined(roomName: string, identity: string): Promise<void> {
  const liveRoom = await findRoomByName(roomName);
  if (!liveRoom) return;

  const participant = await prisma.sessionParticipant.findUnique({
    where: { liveRoomId_userId: { liveRoomId: liveRoom.id, userId: identity } },
  });
  if (!participant) return; // token was never issued through us — nothing to attribute this to

  await prisma.sessionParticipant.update({
    where: { id: participant.id },
    data: { firstJoinedAt: participant.firstJoinedAt ?? new Date() },
  });

  await prisma.participantEvent.create({
    data: {
      liveRoomId: liveRoom.id,
      sessionParticipantId: participant.id,
      userId: identity,
      eventType: ParticipantEventType.JOINED,
      source: "livekit_webhook",
    },
  });
}

async function handleParticipantLeft(roomName: string, identity: string): Promise<void> {
  const liveRoom = await findRoomByName(roomName);
  if (!liveRoom) return;

  const participant = await prisma.sessionParticipant.findUnique({
    where: { liveRoomId_userId: { liveRoomId: liveRoom.id, userId: identity } },
  });
  if (!participant) return;

  const lastJoinEvent = await prisma.participantEvent.findFirst({
    where: { sessionParticipantId: participant.id, eventType: ParticipantEventType.JOINED },
    orderBy: { occurredAt: "desc" },
  });

  const now = new Date();
  const sessionSeconds = lastJoinEvent
    ? Math.max(0, Math.round((now.getTime() - lastJoinEvent.occurredAt.getTime()) / 1000))
    : 0;

  await prisma.sessionParticipant.update({
    where: { id: participant.id },
    data: { lastLeftAt: now, totalTimeSeconds: (participant.totalTimeSeconds ?? 0) + sessionSeconds },
  });

  await prisma.participantEvent.create({
    data: {
      liveRoomId: liveRoom.id,
      sessionParticipantId: participant.id,
      userId: identity,
      eventType: ParticipantEventType.LEFT,
      source: "livekit_webhook",
    },
  });
}

function toAttendanceInput(
  liveRoom: { scheduledStartAt: Date; scheduledEndAt: Date },
  tutor: { firstJoinedAt: Date | null; lastLeftAt: Date | null } | undefined,
  students: { firstJoinedAt: Date | null; lastLeftAt: Date | null }[],
  severeConnectionEvents: boolean
): SessionAttendanceInput {
  const studentJoinedAt = students
    .map((s) => s.firstJoinedAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const leftDates = students.map((s) => s.lastLeftAt).filter((d): d is Date => !!d);
  const studentLeftAt =
    students.length > 0 && leftDates.length === students.length
      ? leftDates.sort((a, b) => b.getTime() - a.getTime())[0]
      : null;

  return {
    scheduledStartAt: liveRoom.scheduledStartAt,
    scheduledEndAt: liveRoom.scheduledEndAt,
    tutorJoinedAt: tutor?.firstJoinedAt ?? null,
    tutorLeftAt: tutor?.lastLeftAt ?? null,
    studentJoinedAt,
    studentLeftAt,
    severeConnectionEvents,
  };
}

async function finalizeSession(liveRoomId: string, endReason: SessionEndReason | null): Promise<void> {
  const liveRoom = await prisma.liveRoom.findUnique({
    where: { id: liveRoomId },
    include: { participants: true, qualityEvents: true },
  });
  if (!liveRoom || liveRoom.status === LiveRoomStatus.ENDED) return;

  const tutor = liveRoom.participants.find((p) => p.participantRole === ParticipantRole.TUTOR);
  const students = liveRoom.participants.filter(
    (p) => p.participantRole === ParticipantRole.STUDENT || p.participantRole === ParticipantRole.PARENT
  );
  const severeConnectionEvents = liveRoom.qualityEvents.some(
    (e) => e.quality === ConnectionQuality.POOR || e.quality === ConnectionQuality.LOST
  );

  const attendance = toAttendanceInput(liveRoom, tutor, students, severeConnectionEvents);
  const result = computeAutoResolutionRecommendation(attendance);

  const { overlapThresholdPercent } = await liveSessionConfig.getAll();
  const overlapSeconds = Math.round(((result.overlapPercentage ?? 0) / 100) * (liveRoom.scheduledEndAt.getTime() - liveRoom.scheduledStartAt.getTime()) / 1000);

  await prisma.liveRoom.update({
    where: { id: liveRoom.id },
    data: {
      status: LiveRoomStatus.ENDED,
      actualEndAt: new Date(),
      endReason: liveRoom.endReason ?? endReason ?? SessionEndReason.ALL_LEFT,
      overlapSeconds,
      overlapPercentage: result.overlapPercentage,
    },
  });

  const booking = await prisma.booking.findUnique({
    where: { id: liveRoom.bookingId },
    include: { tutorProfile: { select: { userId: true } } },
  });
  if (!booking) return;

  // Clears the persistent "session live" banner app-wide, including on a
  // device that never joined this particular room — the room can close
  // while a party is only ever getting there via the banner itself.
  if (!booking.isGroupSession) {
    const partyIds = [booking.tutorProfile.userId, booking.bookerId].filter((id): id is string => !!id);
    for (const uid of partyIds) emitToUser(uid, "session:room_ended", { bookingId: liveRoom.bookingId });
  }

  if (booking.status === BookingStatus.IN_PROGRESS) {
    assertValidTransition(booking.status, BookingStatus.AWAITING_CONFIRMATION);
    await prisma.booking.update({ where: { id: booking.id }, data: { status: BookingStatus.AWAITING_CONFIRMATION } });

    const confirmation = await LessonConfirmationService.openConfirmationWindow(booking.id, {
      sessionType: booking.sessionType,
      liveRoomId: liveRoom.id,
      overlapPercentage: result.overlapPercentage,
      tutorJoined: result.tutorJoined,
      studentJoined: result.studentJoined,
      tutorJoinDelayMinutes: result.tutorJoinDelayMinutes,
      severeConnectionEvents: result.severeConnectionEvents,
      sessionEndedEarly: result.sessionEndedEarly,
      endReason: liveRoom.endReason ?? endReason,
    });

    await prisma.autoResolutionRecommendation.create({
      data: {
        bookingId: booking.id,
        lessonConfirmationId: confirmation.id,
        recommendation: result.recommendation as any,
        overlapPercentage: result.overlapPercentage,
        tutorJoined: result.tutorJoined,
        studentJoined: result.studentJoined,
        tutorJoinDelayMinutes: result.tutorJoinDelayMinutes,
        severeConnectionEvents: result.severeConnectionEvents,
        sessionEndedEarly: result.sessionEndedEarly,
        reasoning: result.reasoning,
      },
    });

    if (
      result.overlapPercentage !== null &&
      overlapThresholdPercent > 0 &&
      result.overlapPercentage < overlapThresholdPercent
    ) {
      await NotificationService.send({
        type: NotificationType.ADMIN_REVIEW_REQUIRED,
        target: { kind: "permission", permissionCode: permissions.liveSessions.manage },
        resourceType: NotificationResourceType.BOOKING,
        resourceId: booking.id,
        data: { reviewReason: "low_session_overlap", overlapPercentage: result.overlapPercentage },
      }).catch(() => undefined);
    }
  }
}

async function handleRoomFinished(roomName: string): Promise<void> {
  const liveRoom = await findRoomByName(roomName);
  if (!liveRoom) return;
  await finalizeSession(liveRoom.id, null);
}

export const LiveSessionService = {
  resolveSessionAccess,
  getRoomOrThrow,
  listActiveSessionsForUser,
  generateToken,
  generateObserverToken,
  initiateCall,
  acceptCall,
  notifyPeerLeft,
  muteParticipant,
  removeParticipant,
  lockRoom,
  endSession,
  muteAll,
  grantScreenShare,
  recordConnectionQuality,
  listChat,
  postChatMessage,
  getAdminAudit,
  handleRoomStarted,
  handleParticipantJoined,
  handleParticipantLeft,
  handleRoomFinished,
  finalizeSession,
};

export default LiveSessionService;
