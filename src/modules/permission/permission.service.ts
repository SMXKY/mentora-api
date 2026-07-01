import { BaseService } from "../../base/BaseService";
import { PermissionRepository } from "./permission.repository";

// ============================================================
// PERMISSION SERVICE — READONLY
// No create, update, or delete operations.
// Extend with custom read methods as needed.
// ============================================================

export class PermissionService extends BaseService<any, never, never> {
  protected repository = new PermissionRepository();
  protected tableName = "permission";

  // Override create/update/delete to prevent accidental use
  async create(): Promise<never> {
    throw new Error("Permission is read-only");
  }

  async update(): Promise<never> {
    throw new Error("Permission is read-only");
  }

  async delete(): Promise<never> {
    throw new Error("Permission is read-only");
  }

  // TODO: add custom read methods
}
