import { createClient } from "redis";
import { REDIS_URL } from "../utils/enviromentVariablesCheck.util";

const redis = createClient({
  url: REDIS_URL ?? "redis://localhost:6379",
});

redis.on("error", (err) => {
  console.error("[Redis] Client error:", err);
});

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

redis.on("reconnecting", () => {
  console.log("[Redis] Reconnecting...");
});

export const connectRedis = async (): Promise<void> => {
  await redis.connect();
};

export default redis;
