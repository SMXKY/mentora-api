import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Fields used when creating a new PermissionOverride
// System fields (id, createdAt, updatedAt, deletedAt) are excluded
export const CreatePermissionOverrideSchema = z
  .object({
    userId: z.string(),
    permissionId: z.string(),
    grantType: z.string(),
    expiresAt: z.string().datetime().optional(),
    createdById: z.string(),
    reason: z.string().optional(),
  })
  .openapi("CreatePermissionOverride");

// All fields optional for partial updates
export const UpdatePermissionOverrideSchema =
  CreatePermissionOverrideSchema.partial().openapi("UpdatePermissionOverride");

// Full response shape returned to the client
export const PermissionOverrideResponseSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string(),
    permissionId: z.string(),
    grantType: z.string(),
    expiresAt: z.string().datetime().optional(),
    createdById: z.string(),
    reason: z.string().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("PermissionOverride");

const baseOverrideFields = {
  userId: z.string().uuid(),
  permissionCode: z.string().min(1),
  reason: z.string().max(255).optional(),
  expiresAt: z.coerce
    .date()
    .refine((date) => date > new Date(), {
      message: "permissionOverrides/errors:expiresAtMustBeFuture",
    })
    .optional(),
};

export const GrantPermissionOverrideSchema = z.object(baseOverrideFields);

export const RevokePermissionOverrideSchema = z.object(baseOverrideFields);

export type GrantPermissionOverrideInput = z.infer<
  typeof GrantPermissionOverrideSchema
>;

export type RevokePermissionOverrideInput = z.infer<
  typeof RevokePermissionOverrideSchema
>;
