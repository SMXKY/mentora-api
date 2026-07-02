import { BaseController } from "../../base/BaseController";
import { buildContext } from "../../utils/buildContext.util";
import { PermissionOverrideService } from "./permissionOverride.service";
import { catchAsync } from "../../utils/catchAsync.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";

export class PermissionOverrideController extends BaseController<any> {
  protected service = new PermissionOverrideService();

  grant = catchAsync(async (req, res) => {
    const ctx = buildContext(req, res);
    const result = await this.service.grant(req.body, ctx);
    appResponder(
      StatusCodes.CREATED,
      { message: "permissionOverrides/success:granted", result },

      res
    );
  });

  revoke = catchAsync(async (req, res) => {
    const ctx = buildContext(req, res);
    const result = await this.service.revoke(req.body, ctx);
    appResponder(
      StatusCodes.CREATED,
      { message: "permissionOverrides/success:revoked", result },

      res
    );
  });

  listActiveForUser = catchAsync(async (req, res) => {
    const ctx = buildContext(req, res);
    const { userId } = req.params;
    const result = await this.service.listActiveForUser(userId, ctx);
    appResponder(
      StatusCodes.OK,
      { message: "permissionOverrides/success:retrieved", result },

      res
    );
  });

  clear = catchAsync(async (req, res) => {
    const ctx = buildContext(req, res);
    const { id } = req.params;
    const result = await this.service.clear(id, ctx);
    appResponder(
      StatusCodes.OK,
      { message: "permissionOverrides/success:cleared", result },
      res
    );
  });
}

export const permissionOverrideController = new PermissionOverrideController();
