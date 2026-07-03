import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.util";
import { catchAsync } from "../utils/catchAsync.util";
import redisClient from "../config/redis.config"; // adjust to your actual Redis client export

type KeyBy = "ip" | "user";

interface RateLimiterOptions {
  windowMs: number; // e.g. 60_000 for a 1 minute window
  max: number; // max requests allowed within the window
  keyBy: KeyBy;
}

const rateLimiter = ({ windowMs, max, keyBy }: RateLimiterOptions) => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const identifier = keyBy === "user" ? res.locals.user?.id : req.ip;

    if (!identifier) {
      return next(
        new AppError(
          "rateLimit/errors:missingIdentifier",
          StatusCodes.UNAUTHORIZED
        )
      );
    }

    const route = `${req.method}:${req.baseUrl}${req.path}`;
    const redisKey = `ratelimit:${route}:${identifier}`;

    let count: number;
    let ttl: number;

    try {
      count = await redisClient.incr(redisKey);

      if (count === 1) {
        await redisClient.pExpire(redisKey, windowMs);
      }

      ttl = await redisClient.pTTL(redisKey);
    } catch (err) {
      // Redis is unreachable — fail closed, not open.
      return next(
        new AppError(
          "rateLimit/errors:serviceUnavailable",
          StatusCodes.SERVICE_UNAVAILABLE
        )
      );
    }

    const remaining = Math.max(max - count, 0);
    const resetSeconds = Math.ceil(ttl / 1000);

    res.set({
      "X-RateLimit-Limit": String(max),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(resetSeconds),
    });

    if (count > max) {
      res.set("Retry-After", String(resetSeconds));
      return next(
        new AppError(
          "rateLimit/errors:tooManyRequests",
          StatusCodes.TOO_MANY_REQUESTS
        )
      );
    }

    next();
  });
};

export default rateLimiter;
