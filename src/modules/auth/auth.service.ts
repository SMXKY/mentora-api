import prisma from "../../config/database.config";
import { ServiceContext } from "../../base/base.types";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { UserStatus, WalletType } from "../../generated/prisma";
import { SessionStatusResponse, CompleteRegistrationInput } from "./auth.types";
import { OtpService } from "../../services/otp";
import {
  signRegistrationToken,
  verifyRegistrationToken,
} from "./utils/signRegistrationToken.util";
import { deliverEmailOtp } from "../../services/otp/dliverEmail";
import argon2 from "argon2";
import signToken from "./utils/signToken.util";

const CAMEROON_PHONE_REGEX = /^\+237[6-9][0-9]{7}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELF_REGISTRATION_ROLES = ["Parent", "Student", "Tutor"] as const;
type SelfRegistrationRole = (typeof SELF_REGISTRATION_ROLES)[number];

const ROLE_TO_WALLET_TYPE: Record<SelfRegistrationRole, WalletType> = {
  Parent: WalletType.PARENT,
  Student: WalletType.STUDENT,
  Tutor: WalletType.TUTOR,
};

const validatePassword = (password: string): void => {
  if (password.length < 8) {
    throw new AppError("auth/errors:passwordTooShort", StatusCodes.BAD_REQUEST);
  }
  if (!/[A-Z]/.test(password)) {
    throw new AppError(
      "auth/errors:passwordMissingUppercase",
      StatusCodes.BAD_REQUEST
    );
  }
  if (!/[a-z]/.test(password)) {
    throw new AppError(
      "auth/errors:passwordMissingLowercase",
      StatusCodes.BAD_REQUEST
    );
  }
  if (!/[0-9]/.test(password)) {
    throw new AppError(
      "auth/errors:passwordMissingNumber",
      StatusCodes.BAD_REQUEST
    );
  }
};

export class AuthService {
  // ── Phone registration ────────────────────────────────────────────────

  static async requestPhoneOtp(phone: string): Promise<void> {
    if (!CAMEROON_PHONE_REGEX.test(phone)) {
      throw new AppError(
        "auth/errors:invalidPhoneFormat",
        StatusCodes.BAD_REQUEST
      );
    }

    const existing = await prisma.user.findFirst({
      where: { phoneNumber: phone, status: UserStatus.ACTIVE, deletedAt: null },
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

  // ── Email registration ────────────────────────────────────────────────

  static async requestEmailOtp(email: string): Promise<void> {
    if (!EMAIL_REGEX.test(email)) {
      throw new AppError(
        "auth/errors:invalidEmailFormat",
        StatusCodes.BAD_REQUEST
      );
    }

    const existing = await prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true },
    });

    if (existing) {
      throw new AppError(
        "auth/errors:emailAlreadyRegistered",
        StatusCodes.CONFLICT
      );
    }

    const code = await OtpService.generateAndStoreOtp(email);
    await deliverEmailOtp(email, code);
  }

  static async verifyEmailOtp(
    email: string,
    code: string
  ): Promise<{ registrationToken: string }> {
    if (!EMAIL_REGEX.test(email)) {
      throw new AppError(
        "auth/errors:invalidEmailFormat",
        StatusCodes.BAD_REQUEST
      );
    }

    await OtpService.verifyOtp(email, code);

    return {
      registrationToken: signRegistrationToken({
        identity: email,
        identityType: "email",
      }),
    };
  }

  // ── Complete registration ─────────────────────────────────────────────

  static async completeRegistration(
    input: CompleteRegistrationInput
  ): Promise<{ token: string }> {
    const { registrationToken, role, password, confirmPassword } = input;

    if (!SELF_REGISTRATION_ROLES.includes(role as SelfRegistrationRole)) {
      throw new AppError("auth/errors:invalidRole", StatusCodes.BAD_REQUEST);
    }

    const tokenPayload = verifyRegistrationToken(registrationToken);
    const { identity, identityType, googleAuthId } = tokenPayload;

    if (identityType === "google") {
      if (password || confirmPassword) {
        throw new AppError(
          "auth/errors:googleAccountNoPassword",
          StatusCodes.BAD_REQUEST
        );
      }
    } else {
      if (!password || !confirmPassword) {
        throw new AppError(
          "auth/errors:passwordRequired",
          StatusCodes.BAD_REQUEST
        );
      }
      if (password !== confirmPassword) {
        throw new AppError(
          "auth/errors:passwordsDoNotMatch",
          StatusCodes.BAD_REQUEST
        );
      }
      validatePassword(password);
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          identityType === "phone" ? { phoneNumber: identity } : {},
          identityType === "email" ? { email: identity } : {},
          identityType === "google" && googleAuthId ? { googleAuthId } : {},
        ],
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new AppError(
        "auth/errors:identityAlreadyRegistered",
        StatusCodes.CONFLICT
      );
    }

    const roleRow = await prisma.role.findUnique({
      where: { name: role },
      select: { id: true },
    });

    if (!roleRow) {
      throw new AppError(
        "auth/errors:roleNotFound",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    const walletType = ROLE_TO_WALLET_TYPE[role as SelfRegistrationRole];
    const passwordHash = password ? await argon2.hash(password) : null;

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: identityType === "email" ? identity : "",
          ...(identityType === "phone" && { phoneNumber: identity }),
          ...(identityType === "email" && { isEmailVerified: true }),
          ...(identityType === "google" && {
            googleAuthId,
            isEmailVerified: true,
          }),
          ...(passwordHash && { password: passwordHash }),
        },
        select: { id: true },
      });

      await tx.wallet.create({
        data: { userId: newUser.id, walletType, balanceXaf: 0 },
      });

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: roleRow.id,
          createdById: newUser.id,
        },
      });

      return newUser;
    });

    return { token: signToken(user.id) };
  }

  // ── Session ───────────────────────────────────────────────────────────

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
