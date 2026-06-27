import redis from "../../config/redis.config";
import generateOtp from "../../utils/generateOTP.util";
import { deliverOtp } from "./dilivery";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

const OTP_TTL_SECONDS = 10 * 60;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

const otpKey = (phone: string) => `otp:${phone}`;
const rateLimitKey = (phone: string) => `otp:ratelimit:${phone}`;

export class OtpService {
  static async requestOtp(phone: string): Promise<void> {
    // Rate limit check
    const rateLimitKeyStr = rateLimitKey(phone);
    const attempts = await redis.get(rateLimitKeyStr);
    const attemptCount = attempts ? parseInt(attempts, 10) : 0;

    if (attemptCount >= RATE_LIMIT_MAX) {
      throw new AppError(
        "otp/errors:rateLimitExceeded",
        StatusCodes.TOO_MANY_REQUESTS
      );
    }

    // Generate and store OTP — replaces any existing one
    const code = generateOtp();
    await redis.set(otpKey(phone), code, { EX: OTP_TTL_SECONDS });

    // Increment rate limit counter; set TTL only on first attempt
    if (attemptCount === 0) {
      await redis.set(rateLimitKeyStr, "1", {
        EX: RATE_LIMIT_WINDOW_SECONDS,
      });
    } else {
      await redis.incr(rateLimitKeyStr);
    }

    // Deliver
    const result = await deliverOtp(phone, code);

    if (!result.success) {
      throw new AppError(
        "otp/errors:deliveryFailed",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  static async verifyOtp(phone: string, code: string): Promise<void> {
    const key = otpKey(phone);
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

    // Consume immediately — single use
    await redis.del(key);
  }
}
