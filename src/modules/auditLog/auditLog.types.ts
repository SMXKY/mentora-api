import { z } from "zod";
import {
  CreateAuditLogSchema,
  UpdateAuditLogSchema,
  AuditLogResponseSchema,
} from "./auditLog.schema";

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;
export type UpdateAuditLogInput = z.infer<typeof UpdateAuditLogSchema>;
export type AuditLogResponse = z.infer<typeof AuditLogResponseSchema>;
