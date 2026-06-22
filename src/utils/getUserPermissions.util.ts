import prisma from "../config/database.config";
import redis from "../config/redis.config";
import { PERMISSION_CACHE_TTL_SECONDS } from "./enviromentVariablesCheck.util";

const CACHE_TTL_SECONDS = parseInt(PERMISSION_CACHE_TTL_SECONDS ?? "300", 10);

const cacheKey = (userId: string) => `permissions:${userId}`;

/**
 * Resolves the effective permission set for a user.
 *
 * Resolution order (REQ-001-006):
 *   role permissions
 *   + active direct GRANT overrides
 *   - active direct REVOKE overrides
 *
 * Results are cached in Redis with a TTL read from
 * PERMISSION_CACHE_TTL_SECONDS (default 300 s / 5 min).
 */
const getUserPermissions = async (userId: string): Promise<string[]> => {
  // 1. Try Redis cache
  const cached = await redis.get(cacheKey(userId));
  if (cached) {
    return JSON.parse(cached) as string[];
  }

  // 2. Fetch user's active roles
  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { roleId: true },
  });

  const roleIds = userRoles.map((ur) => ur.roleId);

  // 3. Fetch role permissions + permission overrides in parallel
  const [rolePermissions, permissionOverrides, implications] =
    await Promise.all([
      // All permissions granted through active roles
      prisma.rolePermission.findMany({
        where: {
          roleId: { in: roleIds },
          role: { isActive: true, deletedAt: null },
        },
        select: { permission: { select: { code: true } } },
      }),

      // Direct per-user grants and revocations
      prisma.permissionOverride.findMany({
        where: {
          userId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          grantType: true,
          permission: { select: { code: true } },
        },
      }),

      // Implication chains (e.g. kyc.manage implies kyc.read)
      prisma.permissionImplication.findMany({
        select: {
          permission: { select: { code: true } },
          impliedPermission: { select: { code: true } },
        },
      }),
    ]);

  // 4. Build implication map
  const implicationMap = new Map<string, string[]>();
  for (const impl of implications) {
    const existing = implicationMap.get(impl.permission.code) ?? [];
    existing.push(impl.impliedPermission.code);
    implicationMap.set(impl.permission.code, existing);
  }

  // 5. Collect granted and revoked sets
  const granted = new Set<string>();
  const revoked = new Set<string>();

  for (const rp of rolePermissions) {
    granted.add(rp.permission.code);
  }

  for (const override of permissionOverrides) {
    if (override.grantType === "GRANT") {
      granted.add(override.permission.code);
    } else {
      revoked.add(override.permission.code);
    }
  }

  // 6. Expand implications (depth-first, cycle-safe)
  const expandImplications = (
    code: string,
    visited = new Set<string>()
  ): string[] => {
    if (visited.has(code)) return [];
    visited.add(code);

    const result: string[] = [code];
    for (const implied of implicationMap.get(code) ?? []) {
      result.push(...expandImplications(implied, visited));
    }
    return result;
  };

  // 7. Build final permission set
  const finalPermissions = new Set<string>();

  for (const code of granted) {
    for (const expanded of expandImplications(code)) {
      finalPermissions.add(expanded);
    }
  }

  // Revocations applied after expansion
  for (const code of revoked) {
    finalPermissions.delete(code);
  }

  const permissions = Array.from(finalPermissions).sort();

  // 8. Write to Redis
  await redis.set(cacheKey(userId), JSON.stringify(permissions), {
    EX: CACHE_TTL_SECONDS,
  });

  return permissions;
};

/**
 * Invalidates the permission cache for one user or all users.
 * Call this whenever a role assignment or permission override changes.
 */
export const invalidatePermissionCache = async (
  userId?: string
): Promise<void> => {
  if (userId) {
    await redis.del(cacheKey(userId));
  } else {
    // Scan and delete all permission keys — only used for bulk invalidation
    const keys = await redis.keys("permissions:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }
  }
};

export default getUserPermissions;
