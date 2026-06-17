import { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { AppError } from "../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

export const requireClerkAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return next(new AppError("error.auth.no_token", StatusCodes.UNAUTHORIZED));
  }

  res.locals.clerkUserId = userId;

  next();
};

export default requireClerkAuth;
