import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Fields used when creating a new Notification
// System fields (id, createdAt, updatedAt, deletedAt) are excluded
export const CreateNotificationSchema = z
  .object({
    recipientId: z.string(),
    type: z.string(),
    titleCode: z.string(),
    bodyCode: z.string(),
    data: z.record(z.string(), z.unknown()).optional(),
    isTransactional: z.boolean(),
    readAt: z.string().datetime().optional(),
    resourceType: z.string().optional(),
    resourceId: z.string().optional(),
  })
  .openapi("CreateNotification");

// All fields optional for partial updates
export const UpdateNotificationSchema =
  CreateNotificationSchema.partial().openapi("UpdateNotification");

export const DismissManySchema = z.object({
  ids: z
    .array(z.string().uuid("common/errors:validation.invalidFormat"))
    .min(1),
});

// Full response shape returned to the client
export const NotificationResponseSchema = z
  .object({
    id: z.string().uuid(),
    recipientId: z.string(),
    type: z.string(),
    titleCode: z.string(),
    bodyCode: z.string(),
    data: z.record(z.string(), z.unknown()).optional(),
    isTransactional: z.boolean(),
    readAt: z.string().datetime().optional(),
    resourceType: z.string().optional(),
    resourceId: z.string().nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Notification");
