import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import prisma from "../config/database.config";
import { KycStatus } from "../generated/prisma";
import { catchAsync } from "../utils/catchAsync.util";

/**
 * Gates a route behind an approved KYC application. Must run after
 * `protect` (needs `res.locals.user.id`) — for Module 8.5 Learning
 * Materials it also runs after `checkAccountCompletion`, since a tutor
 * can't have started/finished KYC without a complete profile in the
 * first place (see kyc.service.ts:assertProfileComplete).
 *
 * "Approved" mirrors the threshold already used elsewhere in the
 * codebase (tutor.service.ts, kyc.service.ts) — KycStatus.ACTIVE, not
 * IDENTITY_APPROVED (which still allows credential review to be
 * pending) and not PENDING_REVERIFICATION/SUSPENDED/BANNED.
 *
 * On success, stashes the resolved tutorProfileId on res.locals so
 * every downstream handler in the gated module can skip re-resolving
 * it from the user id.
 */
const checkKyc = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = res.locals.user?.id;

    const profile = await prisma.tutorProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, kycStatus: true },
    });

    if (!profile) {
      return next(
        new AppError(
          "materials/errors:tutorProfileRequired",
          StatusCodes.NOT_FOUND
        )
      );
    }

    if (profile.kycStatus !== KycStatus.ACTIVE) {
      return next(
        new AppError("materials/errors:kycNotApproved", StatusCodes.FORBIDDEN, {
          kycStatus: profile.kycStatus,
          redirect: "kyc",
        })
      );
    }

    res.locals.tutorProfileId = profile.id;

    next();
  }
);

export default checkKyc;
