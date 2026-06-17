import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import prisma from "../config/database.config";
import { AppError } from "../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../utils/catchAsync.util";

export const protect = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = getAuth(req);

    if (!userId) {
      return next(
        new AppError("auth/errors:noToken", StatusCodes.UNAUTHORIZED)
      );
    }

    res.locals.clerkUserId = userId;

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        userRoles: {
          where: { isActive: true },
          include: { role: true },
        },
      },
    });

    if (!user) {
      return next(
        new AppError("auth/errors:userNotFound", StatusCodes.UNAUTHORIZED)
      );
    }

    if (user.deletedAt) {
      return next(
        new AppError("auth/errors:userNotFound", StatusCodes.UNAUTHORIZED)
      );
    }

    res.locals.user = user;
    res.locals.lang = user.preferredLanguage;

    next();
  }
);

export default protect;
