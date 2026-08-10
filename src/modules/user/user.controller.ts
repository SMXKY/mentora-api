import { Request, Response } from "express";
import { BaseController } from "../../base/BaseController";
import { UserService } from "./user.service";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

// ============================================================
// USER CONTROLLER
// Inherits: create, findById, findMany, search, update,
//           delete, restore, findDeleted, findDeletedById
//
// Override any method to customise behaviour for this module.
// Add custom handlers below for non-standard operations.
// ============================================================

export class UserController extends BaseController<any> {
  protected service = new UserService();

  getMe = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await this.service.getMe(ctx.userId!);
    appResponder(StatusCodes.OK, result, res);
  });

  updateMe = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const record = await this.service.update(ctx.userId!, req.body, ctx);
    appResponder(StatusCodes.OK, record as object, res);
  });

  updateMyProfilePicture = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      if (!req.file) {
        throw new AppError(
          "media/errors:noFileProvided",
          StatusCodes.BAD_REQUEST
        );
      }
      const result = await this.service.updateProfilePicture(
        ctx.userId!,
        req.file,
        ctx
      );
      appResponder(StatusCodes.OK, result, res);
    }
  );

  getBookerProfile = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const result = await this.service.getBookerProfile(ctx.userId!, req.params.id);
      appResponder(StatusCodes.OK, result, res);
    }
  );

  previewMyBookerProfile = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const result = await this.service.previewMyBookerProfile(ctx.userId!);
      appResponder(StatusCodes.OK, result, res);
    }
  );

  previewMyBookerProfileReviews = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const { cursor, limit, sort, rating, wouldRebook } = req.query as any;
      const result = await this.service.previewMyBookerProfileReviews(ctx.userId!, {
        cursor,
        limit: Number(limit) || 20,
        sort,
        rating: rating !== undefined ? Number(rating) : undefined,
        wouldRebook: wouldRebook !== undefined ? wouldRebook === "true" || wouldRebook === true : undefined,
      });
      appResponder(StatusCodes.OK, result.data, res, result.meta);
    }
  );

  getBookerProfileReviews = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const { cursor, limit, sort, rating, wouldRebook } = req.query as any;
      const result = await this.service.getBookerProfileReviews(ctx.userId!, req.params.id, {
        cursor,
        limit: Number(limit) || 20,
        sort,
        rating: rating !== undefined ? Number(rating) : undefined,
        wouldRebook: wouldRebook !== undefined ? wouldRebook === "true" || wouldRebook === true : undefined,
      });
      appResponder(StatusCodes.OK, result.data, res, result.meta);
    }
  );

  blockUser = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await this.service.blockUser(ctx.userId!, req.params.id);
    appResponder(StatusCodes.OK, result, res);
  });

  unblockUser = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await this.service.unblockUser(ctx.userId!, req.params.id);
    appResponder(StatusCodes.OK, result, res);
  });
}

export const userController = new UserController();
