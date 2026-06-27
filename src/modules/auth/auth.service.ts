import prisma from "../../config/database.config";
import { ServiceContext } from "../../base/base.types";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { UserStatus } from "../../generated/prisma";
import { SessionStatusResponse } from "./auth.types";
import { OtpService } from "../../services/otp";
import { signRegistrationToken } from "./utils/signRegistrationToken.util";

const CAMEROON_PHONE_REGEX = /^\+237[6-9][0-9]{7}$/;

export class AuthService {
  static async requestPhoneOtp(phone: string): Promise<void> {
    if (!CAMEROON_PHONE_REGEX.test(phone)) {
      throw new AppError(
        "auth/errors:invalidPhoneFormat",
        StatusCodes.BAD_REQUEST
      );
    }

    const existing = await prisma.user.findFirst({
      where: {
        phoneNumber: phone,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existing) {
      throw new AppError(
        "auth/errors:phoneAlreadyRegistered",
        StatusCodes.CONFLICT
      );
    }

    await OtpService.requestOtp(phone);
  }

  static async verifyPhoneOtp(
    phone: string,
    code: string
  ): Promise<{ registrationToken: string }> {
    if (!CAMEROON_PHONE_REGEX.test(phone)) {
      throw new AppError(
        "auth/errors:invalidPhoneFormat",
        StatusCodes.BAD_REQUEST
      );
    }

    await OtpService.verifyOtp(phone, code);

    return {
      registrationToken: signRegistrationToken({
        identity: phone,
        identityType: "phone",
      }),
    };
  }

  static async getSessionStatus(
    ctx: ServiceContext
  ): Promise<SessionStatusResponse> {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      include: {
        userRoles: {
          where: { isActive: true },
          include: { role: true },
        },
      },
    });

    if (!user || user.deletedAt) {
      return { status: "needs_registration" };
    }

    if (user.userRoles.length === 0) {
      return { status: "needs_registration" };
    }

    return {
      status: "ready",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
        isAccountComplete: user.isAccountComplete,
        preferredLanguage: user.preferredLanguage,
        role: user.userRoles[0].role.name,
      },
    };
  }
}
