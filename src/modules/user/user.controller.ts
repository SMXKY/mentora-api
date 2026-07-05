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
}

export const userController = new UserController();
