import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { MEDIA_ERROR_KEYS } from "./media.types";

async function resolveQuotaLimitBytes(userId: string): Promise<bigint> {
  const override = await prisma.storageQuotaOverride.findUnique({
    where: { userId },
    select: { quotaLimitBytes: true, expiresAt: true },
  });

  if (override && (!override.expiresAt || override.expiresAt > new Date())) {
    return override.quotaLimitBytes;
  }

  const userRole = await prisma.userRole.findFirst({
    where: { userId, isActive: true },
    select: { roleId: true },
  });

  if (userRole) {
    const roleDefault = await prisma.storageQuotaDefault.findUnique({
      where: { roleId: userRole.roleId },
      select: { quotaLimitBytes: true },
    });
    if (roleDefault) return roleDefault.quotaLimitBytes;
  }

  // Fallback if no role default configured.
  return BigInt(500 * 1024 * 1024); // 500MB
}

async function ensureUsageRow(userId: string): Promise<void> {
  await prisma.storageUsage.upsert({
    where: { userId },
    create: { userId, usedBytes: BigInt(0) },
    update: {},
  });
}

/**
 * Atomically reserves `incomingSizeBytes` against the user's quota.
 * The check and the increment happen in one conditional UPDATE, so two
 * concurrent uploads can never both slip under the limit.
 * Throws quotaExceeded (and reserves nothing) if it would go over.
 */
export async function reserveQuota(
  userId: string,
  incomingSizeBytes: number
): Promise<void> {
  const limitBytes = await resolveQuotaLimitBytes(userId);
  await ensureUsageRow(userId);

  const delta = BigInt(incomingSizeBytes);
  const updated = await prisma.$executeRaw`
    UPDATE storage_usage
    SET used_bytes = used_bytes + ${delta}, last_updated_at = NOW()
    WHERE user_id = ${userId}::uuid
      AND used_bytes + ${delta} <= ${limitBytes}`;

  if (updated === 0) {
    const usage = await prisma.storageUsage.findUnique({ where: { userId } });
    throw new AppError(MEDIA_ERROR_KEYS.quotaExceeded, StatusCodes.BAD_REQUEST, {
      limitBytes: limitBytes.toString(),
      currentUsed: (usage?.usedBytes ?? BigInt(0)).toString(),
    });
  }
}

/**
 * Unconditionally adjusts usage by `deltaBytes` (positive or negative),
 * atomically and floored at zero. Used to release a failed reservation,
 * reconcile to the true post-processing size, and free bytes on delete.
 */
export async function adjustUsage(
  userId: string,
  deltaBytes: bigint
): Promise<void> {
  await ensureUsageRow(userId);
  await prisma.$executeRaw`
    UPDATE storage_usage
    SET used_bytes = GREATEST(used_bytes + ${deltaBytes}, 0), last_updated_at = NOW()
    WHERE user_id = ${userId}::uuid`;
}
