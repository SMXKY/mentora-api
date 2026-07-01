import prisma from "../config/database.config";
import redis from "../config/redis.config";
import { PERMISSION_CACHE_TTL_SECONDS } from "./enviromentVariablesCheck.util";

const CACHE_TTL_SECONDS = parseInt(PERMISSION_CACHE_TTL_SECONDS ?? "300", 10);

const cacheKey = (userId: string) => `permissions:${userId}`;
const ALL_CODES_CACHE_KEY = "permissions:__all_codes__";
const ALL_CODES_CACHE_TTL_SECONDS = 600; // 10 min — permission list rarely changes

/**
 * Fetches every permission code that exists in the system.
 * Cached separately from per-user permission sets since this
 * list only changes when permissions are created/removed
 * (i.e. on deploy, not on role/override changes).
 */
const getAllPermissionCodes = async (): Promise<string[]> => {
  const cached = await redis.get(ALL_CODES_CACHE_KEY);
  if (cached) {
    return JSON.parse(cached) as string[];
  }

  const all = await prisma.permission.findMany({
    select: { code: true },
  });

  const codes = all.map((p) => p.code).filter((c) => c !== "*");

  await redis.set(ALL_CODES_CACHE_KEY, JSON.stringify(codes), {
    EX: ALL_CODES_CACHE_TTL_SECONDS,
  });

  return codes;
};

/**
 * Resolves the effective permission set for a user.
 *
 * Resolution order (REQ-001-006):
 *   role permissions
 *   + active direct GRANT overrides
 *   - active direct REVOKE overrides
 *
 * Wildcards ("*", "module.*") are expanded against the full
 * permission code list before implications are applied.
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

  // 3. Fetch role permissions + permission overrides + implications in parallel
  const [rolePermissions, permissionOverrides, implications, allCodes] =
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

      // Full permission code list — needed to expand wildcards
      getAllPermissionCodes(),
    ]);

  // 4. Build implication map
  const implicationMap = new Map<string, string[]>();
  for (const impl of implications) {
    const existing = implicationMap.get(impl.permission.code) ?? [];
    existing.push(impl.impliedPermission.code);
    implicationMap.set(impl.permission.code, existing);
  }

  // 5. Collect granted and revoked sets (raw codes, may include wildcards)
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

  // 6. Expand wildcards against the full permission list
  //    "*"          -> every permission code
  //    "module.*"   -> every code starting with "module."
  const expandWildcard = (code: string): string[] => {
    if (code === "*") {
      return allCodes;
    }
    if (code.endsWith(".*")) {
      const prefix = code.slice(0, -1); // "module.*" -> "module."
      return allCodes.filter((c) => c.startsWith(prefix));
    }
    return [code];
  };

  // 7. Expand implications (depth-first, cycle-safe)
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

  // 8. Build final permission set: wildcard expand -> implication expand
  const finalPermissions = new Set<string>();

  for (const rawCode of granted) {
    const wildcardExpanded = expandWildcard(rawCode);
    for (const code of wildcardExpanded) {
      for (const implied of expandImplications(code)) {
        finalPermissions.add(implied);
      }
    }
  }

  // 9. Revocations applied after expansion (also wildcard-aware)
  for (const rawCode of revoked) {
    const wildcardExpanded = expandWildcard(rawCode);
    for (const code of wildcardExpanded) {
      finalPermissions.delete(code);
    }
  }

  const permissions = Array.from(finalPermissions).sort();

  // 10. Write to Redis
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
    const keys = await redis.keys("permissions:*");
    if (keys.length > 0) {
      await redis.del(keys);
    }
  }
};

/**
 * Invalidates the cached full permission code list.
 * Call this after seeding new permissions or adding any
 * Permission record outside of the seed flow.
 */
export const invalidateAllCodesCache = async (): Promise<void> => {
  await redis.del(ALL_CODES_CACHE_KEY);
};

export default getUserPermissions;
