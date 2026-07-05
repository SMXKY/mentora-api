import prisma from "../../../config/database.config";
import redis from "../../../config/redis.config";
import signToken from "./signToken.util";
import { getDeviceInfo } from "./deviceFingerprint.util";
import { JWT_EXPIRES_IN } from "../../../utils/enviromentVariablesCheck.util";

const SESSION_BLOCKLIST_PREFIX = "session:blocklist:";

/**
 * Parses a jsonwebtoken-style expiresIn string ("7d", "12h", "30m", "3600")
 * into milliseconds. Supports the subset of `ms` syntax jsonwebtoken itself
 * accepts for `expiresIn`/`jwtid` sessions in this codebase.
 */
function parseExpiryMs(value: string): number {
  const match = /^(\d+)\s*(s|m|h|d|w|y)?$/i.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000; // fallback: 7 days
  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  };
  return amount * (unitMs[unit] ?? 1000);
}

/**
 * Finds this user's device by fingerprint, creating it if unseen. Used by
 * token-issuing flows that don't already have a resolved deviceId on hand
 * (registration, Google sign-in) — login() resolves its own device first
 * (for the new-device email) and passes the id straight to createSession.
 */
export async function resolveOrCreateDevice(
  userId: string,
  ip?: string,
  userAgent?: string
): Promise<string> {
  const info = getDeviceInfo(userAgent, ip);

  const existing = await prisma.userDevice.findFirst({
    where: { userId, deviceFingerprintHash: info.fingerprintHash },
    select: { id: true },
  });
  if (existing) {
    await prisma.userDevice
      .update({
        where: { id: existing.id },
        data: { lastSeenAt: new Date(), ipAddress: info.ipAddress },
      })
      .catch(() => {});
    return existing.id;
  }

  const created = await prisma.userDevice.create({
    data: {
      userId,
      deviceFingerprintHash: info.fingerprintHash,
      ipAddress: info.ipAddress,
      os: info.os,
      browser: info.browser,
      browserVersion: info.browserVersion,
      deviceType: info.deviceType,
      lastSeenAt: new Date(),
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Creates the UserSession row a JWT's `jti` points to, then signs and
 * returns that JWT. This is the only place an auth-bearing token should be
 * minted — a token without a backing session can never be revoked before
 * it naturally expires.
 */
export async function issueSessionToken(
  userId: string,
  deviceId: string
): Promise<string> {
  const expiresAt = new Date(Date.now() + parseExpiryMs(JWT_EXPIRES_IN!));
  const session = await prisma.userSession.create({
    data: { userId, deviceId, expiresAt },
    select: { id: true },
  });
  return signToken(userId, session.id);
}

/**
 * Terminates every active session for a user (suspend, self-deactivate,
 * password-independent force-logout) and blocklists each session's JTI in
 * Redis so already-issued, not-yet-expired tokens stop working immediately
 * — the whole point of a JTI blocklist over waiting for natural expiry.
 * Blocklist keys carry a TTL equal to the session's remaining lifetime so
 * Redis never accumulates entries for tokens that would've expired anyway.
 */
export async function invalidateAllSessions(
  userId: string,
  terminatedById?: string
): Promise<number> {
  const sessions = await prisma.userSession.findMany({
    where: { userId, isActive: true },
    select: { id: true, expiresAt: true },
  });
  if (sessions.length === 0) return 0;

  await prisma.userSession.updateMany({
    where: { id: { in: sessions.map((s) => s.id) } },
    data: {
      isActive: false,
      terminatedAt: new Date(),
      terminatedById: terminatedById ?? null,
    },
  });

  await Promise.all(
    sessions.map((s) => {
      const ttlSeconds = Math.max(
        1,
        Math.floor((s.expiresAt.getTime() - Date.now()) / 1000)
      );
      return redis
        .set(`${SESSION_BLOCKLIST_PREFIX}${s.id}`, "1", { EX: ttlSeconds })
        .catch(() => {});
    })
  );

  return sessions.length;
}

export async function isSessionBlocklisted(sessionId: string): Promise<boolean> {
  const value = await redis.get(`${SESSION_BLOCKLIST_PREFIX}${sessionId}`);
  return value !== null;
}
