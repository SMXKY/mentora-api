import { BaseService } from "../../base/BaseService";
import { AuditLogRepository } from "./auditLog.repository";

// ============================================================
// AUDITLOG SERVICE — READONLY
// No create, update, or delete operations.
// Extend with custom read methods as needed.
// ============================================================

export class AuditLogService extends BaseService<any, never, never> {
  protected repository = new AuditLogRepository();
  protected tableName = "auditLog";

  // Override create/update/delete to prevent accidental use
  async create(): Promise<never> {
    throw new Error("AuditLog is read-only");
  }

  async update(): Promise<never> {
    throw new Error("AuditLog is read-only");
  }

  async delete(): Promise<never> {
    throw new Error("AuditLog is read-only");
  }

  // TODO: add custom read methods
}
