import prisma from "../../config/database.config";
import { ServiceContext } from "../../base/base.types";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { UserStatus, WalletType } from "../../generated/prisma";
import {
  SessionStatusResponse,
  CompleteRegistrationInput,
  CreateAdminInput,
} from "./auth.types";
import { OtpService } from "../../services/otp";
import {
  signRegistrationToken,
  verifyRegistrationToken,
} from "./utils/signRegistrationToken.util";
import { deliverEmailOtp } from "../../services/otp/dliverEmail";
import { buildAdminWelcomeEmailTemplate } from "../../emailTemplates/welcomeEmail.template";
import { sendEmail } from "../../utils/sendEmail.util";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { GOOGLE_CLIENT_ID } from "../../utils/enviromentVariablesCheck.util";
import signToken from "./utils/signToken.util";
import argon2 from "argon2";

const CAMEROON_PHONE_REGEX = /^\+237[6-9][0-9]{8}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELF_REGISTRATION_ROLES = ["Parent", "Student", "Tutor"] as const;
type SelfRegistrationRole = (typeof SELF_REGISTRATION_ROLES)[number];

const ADMIN_ASSIGNABLE_ROLES = ["Admin", "Moderator", "Support Agent"] as const;

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
  // ── Phone registration ────────────────────────────────────────────────────

  static async requestPhoneOtp(phone: string): Promise<void> {
    if (!CAMEROON_PHONE_REGEX.test(phone)) {
      throw new AppError(
        "auth/errors:invalidPhoneFormat",
        StatusCodes.BAD_REQUEST
      );
    }

    const existing = await prisma.user.findFirst({
      where: { phoneNumber: phone, deletedAt: null },
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

  // ── Email registration ────────────────────────────────────────────────────

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

  // ── Google auth ───────────────────────────────────────────────────────────

  static async googleAuth(
    idToken: string
  ): Promise<{ token: string } | { registrationToken: string }> {
    if (!GOOGLE_CLIENT_ID) {
      throw new Error(
        "GOOGLE_CLIENT_ID is not defined in environment variables."
      );
    }

    let payload: TokenPayload;

    try {
      const client = new OAuth2Client(GOOGLE_CLIENT_ID);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID,
      });

      const result = ticket.getPayload();

      if (!result) {
        throw new AppError(
          "auth/errors:invalidGoogleToken",
          StatusCodes.UNAUTHORIZED
        );
      }

      payload = result;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(
        "auth/errors:invalidGoogleToken",
        StatusCodes.UNAUTHORIZED
      );
    }

    const {
      sub: googleAuthId,
      email,
      given_name: firstName,
      family_name: lastName,
    } = payload;

    if (!googleAuthId || !email) {
      throw new AppError(
        "auth/errors:googleTokenMissingFields",
        StatusCodes.UNAUTHORIZED
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ googleAuthId }, { email }],
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        googleAuthId: true,
      },
    });

    if (existingUser) {
      if (existingUser.status === UserStatus.SUSPENDED) {
        throw new AppError(
          "auth/errors:accountSuspended",
          StatusCodes.FORBIDDEN
        );
      }

      if (existingUser.status === UserStatus.BANNED) {
        throw new AppError("auth/errors:accountBanned", StatusCodes.FORBIDDEN);
      }

      // Link googleAuthId if user previously registered via email
      if (!existingUser.googleAuthId) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { googleAuthId },
        });
      }

      prisma.user
        .update({
          where: { id: existingUser.id },
          data: { lastLoggedInAt: new Date() },
        })
        .catch(() => {});

      return { token: signToken(existingUser.id) };
    }

    // New user — needs to select a role before account is created
    return {
      registrationToken: signRegistrationToken({
        identity: email,
        identityType: "google",
        googleAuthId,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
      }),
    };
  }

  // ── Complete registration ─────────────────────────────────────────────────

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
          ...(identityType === "phone" && { phoneNumber: identity }),
          ...(identityType === "email" && {
            email: identity,
            isEmailVerified: true,
          }),
          ...(identityType === "google" && {
            email: identity,
            googleAuthId,
            isEmailVerified: true,
            ...(tokenPayload.firstName && {
              firstName: tokenPayload.firstName,
            }),
            ...(tokenPayload.lastName && { lastName: tokenPayload.lastName }),
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

  // ── Admin account creation ────────────────────────────────────────────────

  static async createAdminUser(
    input: CreateAdminInput,
    ctx: ServiceContext
  ): Promise<{ message: string }> {
    const { email, firstName, lastName, roles, password } = input;

    const invalidRoles = roles.filter(
      (r) => !ADMIN_ASSIGNABLE_ROLES.includes(r as any)
    );

    if (invalidRoles.length > 0) {
      throw new AppError(
        "auth/errors:invalidAdminRole",
        StatusCodes.BAD_REQUEST
      );
    }

    validatePassword(password);

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      throw new AppError(
        "auth/errors:emailAlreadyRegistered",
        StatusCodes.CONFLICT
      );
    }

    const roleRows = await prisma.role.findMany({
      where: { name: { in: roles } },
      select: { id: true, name: true },
    });

    if (roleRows.length !== roles.length) {
      throw new AppError(
        "auth/errors:roleNotFound",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    const passwordHash = await argon2.hash(password);

    try {
      await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            firstName,
            lastName,
            password: passwordHash,
            passwordChangedAt: new Date(),
            isEmailVerified: true,
          },
          select: { id: true },
        });

        console.log("[Debug] roleRows:", roleRows);

        for (const role of roleRows) {
          await tx.userRole.create({
            data: {
              userId: newUser.id,
              roleId: role.id,
              createdById: ctx.userId!,
            },
          });
        }
      });
    } catch (err) {
      console.log(err);
      throw err;
    }

    const html = buildAdminWelcomeEmailTemplate({
      firstName,
      email,
      password,
      roles,
    });

    await sendEmail(
      email,
      "Welcome to Mentora — Your admin account is ready",
      `Welcome ${firstName}! Your Mentora admin account has been created. Email: ${email} Password: ${password} Please change your password immediately after logging in.`,
      html
    );

    return { message: "auth/success:adminCreated" };
  }

  // ── Session status ────────────────────────────────────────────────────────

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
        email: String(user.email),
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
