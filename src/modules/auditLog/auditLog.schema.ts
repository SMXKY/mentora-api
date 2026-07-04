import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Fields used when creating a new AuditLog
// System fields (id, createdAt, updatedAt, deletedAt) are excluded
export const CreateAuditLogSchema = z
  .object({
  actorId: z.string().optional(),
  actorEmail: z.string().optional(),
  actorRole: z.string().optional(),
  eventType: z.string(),
  operation: z.string(),
  category: z.string(),
  status: z.string().optional(),
  failureReason: z.string().optional(),
  tableName: z.string(),
  targetId: z.string().optional(),
  targetType: z.string().optional(),
  previousState: z.record(z.unknown()).optional(),
  newState: z.record(z.unknown()).optional(),
  changedFields: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  requestId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  })
  .openapi("CreateAuditLog");

// All fields optional for partial updates
export const UpdateAuditLogSchema = CreateAuditLogSchema.partial().openapi(
  "UpdateAuditLog"
);

// Full response shape returned to the client
export const AuditLogResponseSchema = z
  .object({
  id: z.string().uuid(),
  actorId: z.string().optional(),
  actorEmail: z.string().optional(),
  actorRole: z.string().optional(),
  eventType: z.string(),
  operation: z.string(),
  category: z.string(),
  status: z.string(),
  failureReason: z.string().optional(),
  tableName: z.string(),
  targetId: z.string().optional(),
  targetType: z.string().optional(),
  previousState: z.record(z.unknown()).optional(),
  newState: z.record(z.unknown()).optional(),
  changedFields: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  requestId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  })
  .openapi("AuditLog");
