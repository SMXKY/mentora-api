import { BaseController } from "../../base/BaseController";
import { buildContext } from "../../utils/buildContext.util";
import { RoleService } from "./role.service";
import { catchAsync } from "../../utils/catchAsync.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";

export class RoleController extends BaseController<any> {
  protected service = new RoleService();

  assignRole = catchAsync(async (req, res) => {
    const ctx = buildContext(req, res);
    const { userId } = req.params;
    const result = await this.service.assignRole(userId, req.body, ctx);
    appResponder(
      StatusCodes.CREATED,
      { message: "roles/success:assigned" },
      result,
      res
    );
  });

  unassignRole = catchAsync(async (req, res) => {
    const ctx = buildContext(req, res);
    const { userId, userRoleId } = req.params;
    const result = await this.service.unassignRole(userId, userRoleId, ctx);
    appResponder(
      StatusCodes.OK,
      { message: "roles/success:unassigned" },
      result,
      res
    );
  });

  getPermissionCatalog = catchAsync(async (req, res) => {
    const ctx = buildContext(req, res);
    const { id } = req.params;
    const result = await this.service.getPermissionCatalogForRole(id, ctx);
    appResponder(
      StatusCodes.OK,
      { message: "roles/success:permission_catalog_retrieved", result },
      res
    );
  });

  updatePermissions = catchAsync(async (req, res) => {
    const ctx = buildContext(req, res);
    const { id } = req.params;
    const result = await this.service.updatePermissions(id, req.body, ctx);
    appResponder(
      StatusCodes.OK,
      { message: "roles/success:permissions_updated", result },
      res
    );
  });

  roleHistory = catchAsync(async (req, res) => {
    const ctx = buildContext(req, res);
    const { userId } = req.params;
    const result = await this.service.getRoleHistory(userId, ctx);
    appResponder(
      StatusCodes.OK,
      { message: "roles/success:history_retrieved" },
      result,
      res
    );
  });
}

export const roleController = new RoleController();
