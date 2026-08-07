import { roomServiceClient } from "../../config/livekit.config";
import { liveSessionConfig } from "./liveSessionConfig";

// Self-hosted LiveKit (single node, no Redis-backed room persistence) holds
// room state in memory only — a container restart (crash, `docker compose
// restart`, a deploy) silently wipes every live room with no room_finished
// webhook fired, while our LiveRoom DB row is left saying CREATED/ACTIVE.
// Observed directly in dev testing: a token was issued for a room our DB
// considered ACTIVE, but the LiveKit server reported zero rooms — the
// client's `room.connect()` then fails with "requested room does not
// exist". No dependency on liveSession.service.ts or
// roomLifecycle.processor.ts here on purpose — both of those import from
// each other already, and this needs to be callable from both without
// creating a cycle. liveSessionConfig has no such dependency, so it's safe
// to pull the (admin-configurable) empty-room grace period from there.
const DEPARTURE_TIMEOUT_MINUTES = 15;

export interface RoomProvisioningInput {
  roomName: string;
  bookingId: string;
  isGroupSession: boolean;
  maxStudents: number | null;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
}

/** Recreates the LiveKit room with the same name/params the original creation used. */
export async function recreateLiveKitRoom(input: RoomProvisioningInput): Promise<void> {
  const maxParticipants = input.isGroupSession ? (input.maxStudents ?? 20) + 1 : 2;
  const { emptyTimeoutMinutes } = await liveSessionConfig.getAll();
  await roomServiceClient.createRoom({
    name: input.roomName,
    emptyTimeout: emptyTimeoutMinutes * 60,
    departureTimeout: DEPARTURE_TIMEOUT_MINUTES * 60,
    maxParticipants,
    metadata: JSON.stringify({
      bookingId: input.bookingId,
      isGroupSession: input.isGroupSession,
      scheduledStartAt: input.scheduledStartAt.toISOString(),
      scheduledEndAt: input.scheduledEndAt.toISOString(),
    }),
  });
}

/**
 * Verifies the room our DB thinks is CREATED/ACTIVE actually exists on the
 * LiveKit server right now, recreating it if not. Called on the hot path
 * (token issuance) rather than only from the periodic sweep, because a
 * user hitting "join" is exactly the moment this needs to already be true
 * — waiting for the next sweep tick means a broken join for however long
 * that takes.
 */
export async function ensureLiveKitRoomExists(input: RoomProvisioningInput): Promise<boolean> {
  const existing = await roomServiceClient.listRooms([input.roomName]).catch(() => null);
  if (existing && existing.length > 0) return false;

  console.warn({ event: "live_session_room_missing_on_livekit_server", bookingId: input.bookingId, roomName: input.roomName });
  await recreateLiveKitRoom(input);
  return true;
}
