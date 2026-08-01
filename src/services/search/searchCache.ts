import crypto from "crypto";
import redis from "../../config/redis.config";

const CACHE_TTL_SECONDS = 60;
const VERSION_KEY_PREFIX = "search:version:";
const RESULT_KEY_PREFIX = "search:results:";

/** Bumped whenever a tutor's availability/rating/KYC-status/profile changes
 * in this city — every cache key for that city embeds the current version,
 * so a single INCR instantly invalidates every previously cached query for
 * the city (coarse-grained but cheap; the TTL is the backstop either way). */
export async function bumpSearchCacheVersion(cityId: string | null): Promise<void> {
  if (!cityId) return;
  await redis.incr(`${VERSION_KEY_PREFIX}${cityId}`).catch(() => {});
}

async function getSearchCacheVersion(cityId: string | null): Promise<string> {
  if (!cityId) return "global";
  const version = await redis.get(`${VERSION_KEY_PREFIX}${cityId}`).catch(() => null);
  return version ?? "0";
}

function hashParams(params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      if (params[key] !== undefined) acc[key] = params[key];
      return acc;
    }, {} as Record<string, unknown>);
  return crypto.createHash("sha1").update(JSON.stringify(sorted)).digest("hex");
}

export async function buildSearchCacheKey(
  cityId: string | null,
  params: Record<string, unknown>
): Promise<string> {
  const version = await getSearchCacheVersion(cityId);
  return `${RESULT_KEY_PREFIX}${cityId ?? "global"}:${version}:${hashParams(params)}`;
}

export async function getCachedSearchResult<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedSearchResult(key: string, value: unknown): Promise<void> {
  await redis
    .set(key, JSON.stringify(value), { EX: CACHE_TTL_SECONDS })
    .catch(() => {});
}
