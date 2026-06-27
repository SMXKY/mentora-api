import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import prisma from "../config/database.config";
import getUserPermissions from "../utils/getUserPermissions.util";
import { catchAsync } from "../utils/catchAsync.util";
import { JWT_SECRET } from "../utils/enviromentVariablesCheck.util";
import { UserStatus } from "../generated/prisma";

const protect = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(
        new AppError("auth/errors:noToken", StatusCodes.UNAUTHORIZED)
      );
    }

    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return next(
          new AppError("auth/errors:tokenExpired", StatusCodes.UNAUTHORIZED)
        );
      }
      return next(
        new AppError("auth/errors:invalidToken", StatusCodes.UNAUTHORIZED)
      );
    }

    if (!decoded.id || !decoded.iat) {
      return next(
        new AppError("auth/errors:invalidToken", StatusCodes.UNAUTHORIZED)
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        phoneNumber: true,
        profilePictureUrl: true,
        preferredLanguage: true,
        isEmailVerified: true,
        isAccountComplete: true,
        status: true,
        passwordChangedAt: true,
        deletedAt: true,
        lastLoggedInAt: true,
        userRoles: {
          where: { isActive: true },
          select: {
            id: true,
            role: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
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
        new AppError("auth/errors:accountDeactivated", StatusCodes.FORBIDDEN)
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      return next(
        new AppError("auth/errors:accountSuspended", StatusCodes.FORBIDDEN)
      );
    }

    if (user.status === UserStatus.BANNED) {
      return next(
        new AppError("auth/errors:accountBanned", StatusCodes.FORBIDDEN)
      );
    }

    if (
      user.passwordChangedAt &&
      Math.floor(user.passwordChangedAt.getTime() / 1000) > decoded.iat
    ) {
      return next(
        new AppError("auth/errors:passwordChanged", StatusCodes.UNAUTHORIZED)
      );
    }

    const { passwordChangedAt, deletedAt, ...safeUser } = user;

    res.locals.user = {
      ...safeUser,
      roles: user.userRoles.map((ur) => ur.role),
      permissions: await getUserPermissions(user.id),
    };

    next();
  }
);

export default protect;
