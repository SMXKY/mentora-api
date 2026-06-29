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
import { buildNewDeviceEmailTemplate } from "../../emailTemplates/newDevice.template";
import { buildPasswordChangedEmailTemplate } from "../../emailTemplates/passwordChanged.template";
import { buildPasswordResetOtpEmailTemplate } from "../../emailTemplates/passwordResetOTP.template";
import { sendEmail } from "../../utils/sendEmail.util";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { GOOGLE_CLIENT_ID } from "../../utils/enviromentVariablesCheck.util";
import signToken from "./utils/signToken.util";
import argon2 from "argon2";
import { getDeviceInfo } from "./utils/deviceFingerprint.util";
import { signResetToken, verifyResetToken } from "./utils/signResetToken";
import { deliverOtp } from "../../services/otp/dilivery";
import getUserPermissions from "../../utils/getUserPermissions.util";
import { applyFtpUrlTransform } from "../../utils/applyFtpUrl.util";
import { AuditService } from "../../utils/logUserActivity.util";
import { LogCategory, LogOperation } from "../../generated/prisma";

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
      where: { OR: [{ googleAuthId }, { email }], deletedAt: null },
      select: { id: true, status: true, googleAuthId: true },
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

  static async completeRegistration(
    input: CompleteRegistrationInput,
    ctx: ServiceContext
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

    AuditService.record(ctx, "users", {
      operation: LogOperation.AUTH,
      category: LogCategory.AUTH,
      recordId: user.id,
      newState: { identityType, role },
      changedFields: [],
      eventType: "user.registered",
    });

    return { token: signToken(user.id) };
  }

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

    let newUserId: string;

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

      newUserId = newUser.id;

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

    AuditService.record(ctx, "users", {
      operation: LogOperation.CREATE,
      category: LogCategory.WRITE,
      recordId: newUserId!,
      newState: { email, roles },
      changedFields: [],
      eventType: "admin.created",
      targetType: "users",
    });

    const html = buildAdminWelcomeEmailTemplate({
      firstName,
      email,
      password,
      roles,
    });

    await sendEmail(
      email,
      "Welcome to Mentora — Your admin account is ready",
      `Welcome ${firstName}! Email: ${email} Password: ${password} Please change your password immediately.`,
      html
    );

    return { message: "auth/success:adminCreated" };
  }

  static async login(
    identifier: string,
    password: string,
    userAgent: string | undefined,
    ip: string | undefined
  ): Promise<{ user: any; token: string }> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phoneNumber: identifier },
          { username: identifier },
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        phoneNumber: true,
        profilePictureUrl: true,
        preferredLanguage: true,
        isEmailVerified: true,
        isAccountComplete: true,
        password: true,
        status: true,
        passwordChangedAt: true,
        userRoles: {
          where: { isActive: true },
          select: { role: { select: { name: true } } },
        },
      },
    });

    if (!user) {
      throw new AppError(
        "auth/errors:invalidCredentials",
        StatusCodes.UNAUTHORIZED
      );
    }

    if (!user.password) {
      throw new AppError(
        "auth/errors:noPasswordAccount",
        StatusCodes.UNAUTHORIZED
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new AppError("auth/errors:accountSuspended", StatusCodes.FORBIDDEN);
    }

    if (user.status === UserStatus.BANNED) {
      throw new AppError("auth/errors:accountBanned", StatusCodes.FORBIDDEN);
    }

    const isValid = await argon2.verify(user.password, password);
    if (!isValid) {
      throw new AppError(
        "auth/errors:invalidCredentials",
        StatusCodes.UNAUTHORIZED
      );
    }

    const deviceInfo = getDeviceInfo(userAgent, ip);

    const existingDevice = await prisma.userDevice.findFirst({
      where: {
        userId: user.id,
        deviceFingerprintHash: deviceInfo.fingerprintHash,
      },
      select: { id: true },
    });

    if (!existingDevice) {
      prisma.userDevice
        .create({
          data: {
            userId: user.id,
            deviceFingerprintHash: deviceInfo.fingerprintHash,
            ipAddress: deviceInfo.ipAddress,
            os: deviceInfo.os,
            browser: deviceInfo.browser,
            browserVersion: deviceInfo.browserVersion,
            deviceType: deviceInfo.deviceType,
            lastSeenAt: new Date(),
          },
        })
        .catch(() => {});

      if (user.email) {
        const html = buildNewDeviceEmailTemplate({
          firstName: user.firstName,
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          ipAddress: deviceInfo.ipAddress,
          timestamp: new Date().toLocaleString("en-GB", {
            dateStyle: "long",
            timeStyle: "short",
          }),
        });

        sendEmail(
          user.email,
          "New device login detected — Mentora",
          `A new device logged into your Mentora account from ${deviceInfo.ipAddress}.`,
          html
        ).catch(() => {});
      }
    } else {
      prisma.userDevice
        .update({
          where: { id: existingDevice.id },
          data: { lastSeenAt: new Date(), ipAddress: deviceInfo.ipAddress },
        })
        .catch(() => {});
    }

    prisma.user
      .update({ where: { id: user.id }, data: { lastLoggedInAt: new Date() } })
      .catch(() => {});

    const permissions = await getUserPermissions(user.id);
    const { password: _pw, passwordChangedAt: _pc, ...safeUser } = user;

    const ctx: ServiceContext = {
      userId: user.id,
      userEmail: user.email ?? undefined,
      ipAddress: ip,
      userAgent,
    };

    AuditService.record(ctx, "users", {
      operation: LogOperation.AUTH,
      category: LogCategory.AUTH,
      recordId: user.id,
      changedFields: [],
      eventType: "user.login",
    });

    return {
      user: {
        ...safeUser,
        roles: user.userRoles.map((ur) => ur.role.name),
        profilePictureUrl: user.profilePictureUrl
          ? applyFtpUrlTransform(user.profilePictureUrl)
          : null,
        permissions,
      },
      token: signToken(user.id),
    };
  }

  static async changePassword(
    ctx: ServiceContext,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        password: true,
        status: true,
      },
    });

    if (!user) {
      throw new AppError("auth/errors:userNotFound", StatusCodes.UNAUTHORIZED);
    }

    if (!user.password) {
      throw new AppError(
        "auth/errors:noPasswordAccount",
        StatusCodes.BAD_REQUEST
      );
    }

    const isValid = await argon2.verify(user.password, currentPassword);
    if (!isValid) {
      throw new AppError(
        "auth/errors:invalidCurrentPassword",
        StatusCodes.UNAUTHORIZED
      );
    }

    validatePassword(newPassword);

    const passwordHash = await argon2.hash(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, passwordChangedAt: new Date() },
    });

    AuditService.record(ctx, "users", {
      operation: LogOperation.CHANGE_PASSWORD,
      category: LogCategory.AUTH,
      recordId: user.id,
      changedFields: ["password"],
      eventType: "user.password_changed",
    });

    if (user.email) {
      const html = buildPasswordChangedEmailTemplate({
        firstName: user.firstName,
        timestamp: new Date().toLocaleString("en-GB", {
          dateStyle: "long",
          timeStyle: "short",
        }),
      });

      sendEmail(
        user.email,
        "Your Mentora password has been changed",
        `Your Mentora account password was changed successfully.`,
        html
      ).catch(() => {});
    }

    return { message: "auth/success:passwordChanged" };
  }

  static async forgotPassword(identity: string): Promise<void> {
    const isEmail = EMAIL_REGEX.test(identity);
    const isPhone = CAMEROON_PHONE_REGEX.test(identity);

    if (!isEmail && !isPhone) {
      throw new AppError(
        "auth/errors:invalidIdentityFormat",
        StatusCodes.BAD_REQUEST
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          isEmail ? { email: identity } : {},
          isPhone ? { phoneNumber: identity } : {},
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        phoneNumber: true,
        status: true,
      },
    });

    if (!user || user.status === UserStatus.BANNED) return;

    const code = await OtpService.generateAndStoreOtpWithTTL(identity, 30 * 60);

    if (isEmail && user.email) {
      const html = buildPasswordResetOtpEmailTemplate({
        firstName: user.firstName,
        code,
      });

      await sendEmail(
        user.email,
        "Reset your Mentora password",
        `Your Mentora password reset code is ${code}. It expires in 30 minutes.`,
        html
      );
    } else if (isPhone) {
      await deliverOtp(identity, code);
    }
  }

  static async verifyResetOtp(
    identity: string,
    code: string
  ): Promise<{ resetToken: string }> {
    const isEmail = EMAIL_REGEX.test(identity);
    const isPhone = CAMEROON_PHONE_REGEX.test(identity);

    if (!isEmail && !isPhone) {
      throw new AppError(
        "auth/errors:invalidIdentityFormat",
        StatusCodes.BAD_REQUEST
      );
    }

    await OtpService.verifyOtp(identity, code);

    return {
      resetToken: signResetToken(identity, isEmail ? "email" : "phone"),
    };
  }

  static async resetPassword(
    resetToken: string,
    newPassword: string,
    confirmPassword: string,
    ctx: ServiceContext
  ): Promise<{ message: string }> {
    if (newPassword !== confirmPassword) {
      throw new AppError(
        "auth/errors:passwordsDoNotMatch",
        StatusCodes.BAD_REQUEST
      );
    }

    validatePassword(newPassword);

    const payload = verifyResetToken(resetToken);
    const { identity, identityType } = payload;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          identityType === "email" ? { email: identity } : {},
          identityType === "phone" ? { phoneNumber: identity } : {},
        ],
        deletedAt: null,
      },
      select: { id: true, email: true, firstName: true, status: true },
    });

    if (!user) {
      throw new AppError("auth/errors:userNotFound", StatusCodes.NOT_FOUND);
    }

    if (user.status === UserStatus.BANNED) {
      throw new AppError("auth/errors:accountBanned", StatusCodes.FORBIDDEN);
    }

    const passwordHash = await argon2.hash(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash, passwordChangedAt: new Date() },
    });

    AuditService.record(
      { ...ctx, userId: user.id, userEmail: user.email ?? undefined },
      "users",
      {
        operation: LogOperation.RESET_PASSWORD,
        category: LogCategory.AUTH,
        recordId: user.id,
        changedFields: ["password"],
        eventType: "user.password_reset",
      }
    );

    if (user.email) {
      const html = buildPasswordChangedEmailTemplate({
        firstName: user.firstName,
        timestamp: new Date().toLocaleString("en-GB", {
          dateStyle: "long",
          timeStyle: "short",
        }),
      });

      sendEmail(
        user.email,
        "Your Mentora password has been changed",
        `Your Mentora account password was reset successfully.`,
        html
      ).catch(() => {});
    }

    return { message: "auth/success:passwordReset" };
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
