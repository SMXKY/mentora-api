import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import prisma from "../config/database.config";
import { AppError } from "../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../utils/catchAsync.util";
import getUserPermissions from "../utils/getUserPermissions.util";
import { UserStatus as Status } from "../generated/prisma";

export const protect = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId: clerkUserId } = getAuth(req);

    if (!clerkUserId) {
      return next(
        new AppError("auth.errors.no_token", StatusCodes.UNAUTHORIZED)
      );
    }

    res.locals.clerkUserId = clerkUserId;

    const user = await prisma.user.findUnique({
      where: { clerkId: clerkUserId },
    });

    if (!user || user.deletedAt) {
      return next(
        new AppError("auth.errors.user_not_found", StatusCodes.UNAUTHORIZED)
      );
    }

    if (user.status === Status.SUSPENDED || user.status === Status.BANNED) {
      return next(
        new AppError("auth.errors.account_suspended", StatusCodes.FORBIDDEN)
      );
    }

    // Resolve permissions — served from Redis cache when available
    const permissions = await getUserPermissions(user.id);

    res.locals.user = { ...user, permissions };
    res.locals.lang = user.preferredLanguage;

    next();
  }
);

export default protect;
