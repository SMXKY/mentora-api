import prisma from "../../config/database.config";
import { ServiceContext } from "../../base/base.types";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { Languages, WalletType } from "../../generated/prisma";
import { CompleteRegistrationInput, SessionStatusResponse } from "./auth.types";

export type ClerkSessionClaims = {
  email?: string;
  email_verified?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
  phone_number?: string | null;
};

const ROLE_TO_WALLET_TYPE: Record<string, WalletType> = {
  Parent: WalletType.PARENT,
  Student: WalletType.STUDENT,
  Tutor: WalletType.TUTOR,
};

const ALLOWED_SELF_REGISTRATION_ROLES = ["Parent", "Student", "Tutor"];

export class AuthService {
  static async completeRegistration(
    input: CompleteRegistrationInput,
    ctx: ServiceContext,
    claims: ClerkSessionClaims,
    langHeader?: string
  ) {
    const { role } = input;

    if (!ALLOWED_SELF_REGISTRATION_ROLES.includes(role)) {
      throw new AppError("auth/errors:invalidRole", StatusCodes.FORBIDDEN);
    }

    const clerkUserId = ctx.userId;

    const existing = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (existing) {
      throw new AppError("auth/errors:alreadyRegistered", StatusCodes.CONFLICT);
    }

    if (!claims.email) {
      throw new AppError(
        "auth/errors:noEmailOnClerkAccount",
        StatusCodes.BAD_REQUEST
      );
    }

    const role_ = await prisma.role.findUnique({
      where: { name: role },
    });

    if (!role_) {
      throw new AppError(
        "auth/errors:roleNotFound",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    const walletType = ROLE_TO_WALLET_TYPE[role];

    const preferredLanguage =
      langHeader?.toUpperCase() === "FR" ? Languages.FR : Languages.EN;

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          clerkId: String(clerkUserId),
          email: claims.email!,
          isEmailVerified: claims.email_verified ?? false,
          firstName: claims.first_name ?? undefined,
          lastName: claims.last_name ?? undefined,
          username: claims.username ?? undefined,
          profilePictureUrl: claims.image_url ?? undefined,
          phoneNumber: claims.phone_number ?? undefined,
          preferredLanguage,
        },
      });

      await tx.wallet.create({
        data: {
          userId: newUser.id,
          walletType,
          balanceXaf: 0,
        },
      });

      await tx.userRole.create({
        data: {
          userId: newUser.id,
          roleId: role_.id,
          createdById: newUser.id,
        },
      });

      return newUser;
    });

    return user;
  }

  static async getSessionStatus(
    ctx: ServiceContext
  ): Promise<SessionStatusResponse> {
    const user = await prisma.user.findUnique({
      where: { clerkId: ctx.userId },
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
