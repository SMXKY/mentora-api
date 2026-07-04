import { BaseController } from "../../base/BaseController";
import { AuditLogService } from "./auditLog.service";

// ============================================================
// AUDITLOG CONTROLLER
// Inherits: create, findById, findMany, search, update,
//           delete, restore, findDeleted, findDeletedById
//
// Override any method to customise behaviour for this module.
// Add custom handlers below for non-standard operations.
// ============================================================

export class AuditLogController extends BaseController<any> {
  protected service = new AuditLogService();

  // Example override:
  // create = catchAsync(async (req, res) => {
  //   const ctx = buildContext(req, res)
  //   const result = await this.service.createWithCustomLogic(req.body, ctx)
  //   appResponder(201, result, res)
  // })
}

export const auditLogController = new AuditLogController();
