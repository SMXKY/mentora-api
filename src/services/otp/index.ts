import redis from "../../config/redis.config";
import generateOtp from "../../utils/generateOTP.util";
import { deliverOtp } from "./dilivery";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

const OTP_TTL_SECONDS = 10 * 60;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

const otpKey = (identity: string) => `otp:${identity}`;
const rateLimitKey = (identity: string) => `otp:ratelimit:${identity}`;

export class OtpService {
  static async checkRateLimit(identity: string): Promise<void> {
    const key = rateLimitKey(identity);
    const attempts = await redis.get(key);
    const attemptCount = attempts ? parseInt(attempts, 10) : 0;

    if (attemptCount >= RATE_LIMIT_MAX) {
      throw new AppError(
        "otp/errors:rateLimitExceeded",
        StatusCodes.TOO_MANY_REQUESTS
      );
    }

    if (attemptCount === 0) {
      await redis.set(key, "1", { EX: RATE_LIMIT_WINDOW_SECONDS });
    } else {
      await redis.incr(key);
    }
  }

  // Generates, rate-limits, and stores OTP — returns the code for caller to deliver
  static async generateAndStoreOtp(identity: string): Promise<string> {
    await OtpService.checkRateLimit(identity);
    const code = generateOtp();
    await redis.set(otpKey(identity), code, { EX: OTP_TTL_SECONDS });
    return code;
  }

  // Generates, stores, and delivers via AT (phone only)
  static async requestOtp(phone: string): Promise<void> {
    const code = await OtpService.generateAndStoreOtp(phone);
    const result = await deliverOtp(phone, code);

    if (!result.success) {
      throw new AppError(
        "otp/errors:deliveryFailed",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  static async verifyOtp(identity: string, code: string): Promise<void> {
    const key = otpKey(identity);
    const stored = await redis.get(key);

    if (!stored) {
      throw new AppError(
        "otp/errors:expiredOrNotFound",
        StatusCodes.BAD_REQUEST
      );
    }

    if (stored !== code) {
      throw new AppError("otp/errors:invalidCode", StatusCodes.BAD_REQUEST);
    }

    await redis.del(key);
  }
}
