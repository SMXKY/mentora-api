import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

const restrictTo = (...permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as { permissions: string[] } | undefined;

    if (!user) {
      return next(
        new AppError("auth/errors:notAuthenticated", StatusCodes.UNAUTHORIZED)
      );
    }

    const userPermissions: string[] = user.permissions ?? [];

    const hasPermission = permissions.some((required) =>
      userPermissions.includes(required)
    );

    if (!hasPermission) {
      return next(
        new AppError(
          "auth/errors:insufficientPermissions",
          StatusCodes.FORBIDDEN
        )
      );
    }

    next();
  };
};

export default restrictTo;
