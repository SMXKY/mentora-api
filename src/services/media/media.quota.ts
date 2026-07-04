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

/**
 * Checks the pessimistic (pre-processing) size against remaining quota.
 * Throws before any upload work begins if it would exceed the limit.
 */
export async function assertWithinQuota(
  userId: string,
  incomingSizeBytes: number
): Promise<void> {
  const [usage, limitBytes] = await Promise.all([
    prisma.storageUsage.findUnique({ where: { userId } }),
    resolveQuotaLimitBytes(userId),
  ]);

  const currentUsed = usage?.usedBytes ?? BigInt(0);

  if (currentUsed + BigInt(incomingSizeBytes) > limitBytes) {
    throw new AppError(
      MEDIA_ERROR_KEYS.quotaExceeded,
      StatusCodes.BAD_REQUEST,
      {
        limitBytes: limitBytes.toString(),
        currentUsed: currentUsed.toString(),
      }
    );
  }
}

/**
 * Called twice per upload: once optimistically with the raw incoming size,
 * once again after processing completes with the true final size (delta-adjusted).
 */
export async function adjustUsage(
  userId: string,
  deltaBytes: bigint
): Promise<void> {
  await prisma.storageUsage.upsert({
    where: { userId },
    create: {
      userId,
      usedBytes: deltaBytes < BigInt(0) ? BigInt(0) : deltaBytes,
    },
    update: { usedBytes: { increment: deltaBytes }, lastUpdatedAt: new Date() },
  });
}
