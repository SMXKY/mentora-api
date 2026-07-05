import redisClient from "../config/redis.config";

const IP_LIMIT = 5;
const IP_LOCK_MS = 15 * 60 * 1000;

const ACCOUNT_LIMIT = 10;
const ACCOUNT_LOCK_MS = 30 * 60 * 1000;

const ipKey = (ip: string) => `bruteforce:ip:${ip}`;
const accountKey = (userId: string) => `bruteforce:account:${userId}`;

export const isIpLocked = async (ip: string): Promise<boolean> => {
  const count = await redisClient.get(ipKey(ip));
  return count !== null && Number(count) >= IP_LIMIT;
};

export const isAccountLocked = async (userId: string): Promise<boolean> => {
  const count = await redisClient.get(accountKey(userId));
  return count !== null && Number(count) >= ACCOUNT_LIMIT;
};

export const recordFailedIpAttempt = async (ip: string): Promise<void> => {
  const count = await redisClient.incr(ipKey(ip));
  if (count === 1) {
    await redisClient.pExpire(ipKey(ip), IP_LOCK_MS);
  }
};

export const recordFailedAccountAttempt = async (
  userId: string
): Promise<boolean> => {
  const count = await redisClient.incr(accountKey(userId));
  if (count === 1) {
    await redisClient.pExpire(accountKey(userId), ACCOUNT_LOCK_MS);
  }
  return count === ACCOUNT_LIMIT;
};

export const clearBruteForceCounters = async (
  ip: string,
  userId: string
): Promise<void> => {
  await Promise.all([
    redisClient.del(ipKey(ip)),
    redisClient.del(accountKey(userId)),
  ]);
};
