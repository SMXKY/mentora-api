import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { AdminUserService } from "./adminUser.service";

export const adminUserController = {
  suspend: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await AdminUserService.suspendUser(
      req.params.user_id,
      req.body.reason,
      ctx
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  unsuspend: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await AdminUserService.unsuspendUser(
      req.params.user_id,
      ctx
    );
    appResponder(StatusCodes.OK, result, res);
  }),
};

export default adminUserController;
