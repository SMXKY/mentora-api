import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

/**
 * Gates a route behind account completion. Reads `res.locals.user.
 * isAccountComplete`, which `protect` already fetches on every request —
 * this middleware costs zero extra queries and must run after `protect`.
 *
 * Per REQ-006-014, restricted actions are booking, messaging, KYC
 * submission, payment initiation, and (Module 8.5) Learning Materials —
 * apply this on those specific routes as each module is built, not as a
 * blanket gate on `protect` itself (guest browsing, GET /me, etc. must
 * stay reachable regardless of completion state).
 */
const checkAccountCompletion = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!res.locals.user?.isAccountComplete) {
    return next(
      new AppError("auth/errors:accountIncomplete", StatusCodes.FORBIDDEN, {
        redirect: "onboarding",
      })
    );
  }
  next();
};

export default checkAccountCompletion;
