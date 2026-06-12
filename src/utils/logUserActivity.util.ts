import prisma from "../config/database.config";
import { ServiceContext, AuditLogOptions } from "../base/base.types";
import { LogOperation, LogCategory, LogStatus } from "../generated/prisma";

export class AuditService {
  static record(
    ctx: ServiceContext,
    tableName: string,
    options: AuditLogOptions & {
      eventType?: string;
      targetType?: string;
      actorRole?: string;
    }
  ): void {
    Promise.resolve().then(async () => {
      try {
        await prisma.auditLog.create({
          data: {
            actorId: ctx.userId,
            actorEmail: ctx.userEmail,
            actorRole: options.actorRole,
            eventType:
              options.eventType ??
              `${tableName}.${options.operation.toLowerCase()}`,
            operation: options.operation as LogOperation,
            category: options.category as LogCategory,
            status: LogStatus.SUCCESS,
            tableName,
            targetId: options.recordId,
            targetType: options.targetType ?? tableName,
            previousState: options.previousState ?? undefined,
            newState: options.newState ?? undefined,
            changedFields: options.changedFields ?? [],
            ipAddress: ctx.ipAddress ?? "0.0.0.0",
            userAgent: ctx.userAgent ?? "Unknown",
            requestId: ctx.requestId,
          },
        });
      } catch (err) {
        console.error({
          event: "audit_log_failed",
          tableName,
          recordId: options.recordId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }
}
