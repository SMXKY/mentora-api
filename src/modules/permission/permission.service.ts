import { BaseService } from "../../base/BaseService";
import { PermissionRepository } from "./permission.repository";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

// ============================================================
// PERMISSION SERVICE — READONLY
// No create, update, or delete operations.
// ============================================================

export class PermissionService extends BaseService<any, never, never> {
  protected repository = new PermissionRepository();
  protected tableName = "permission";

  // Override create/update/delete to prevent accidental use
  async create(): Promise<never> {
    throw new AppError(
      "permission/errors:readOnly",
      StatusCodes.METHOD_NOT_ALLOWED
    );
  }

  async update(): Promise<never> {
    throw new AppError(
      "permission/errors:readOnly",
      StatusCodes.METHOD_NOT_ALLOWED
    );
  }

  async delete(): Promise<never> {
    throw new AppError(
      "permission/errors:readOnly",
      StatusCodes.METHOD_NOT_ALLOWED
    );
  }
}
