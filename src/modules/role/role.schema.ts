import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const CreateRoleSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    isSystem: z.boolean().default(false),
    isActive: z.boolean().optional(),
  })
  .openapi("CreateRole");

export const UpdateRoleSchema =
  CreateRoleSchema.partial().openapi("UpdateRole");

export const RoleResponseSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string(),
    description: z.string().optional(),
    isSystem: z.boolean(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Role");

export const AssignRoleSchema = z
  .object({
    roleId: z.string().uuid(),
    reason: z.string().max(255).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .openapi("AssignRole");

export const UserRoleResponseSchema = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    roleId: z.string().uuid(),
    isActive: z.boolean(),
    expiresAt: z.string().datetime().nullable(),
    reason: z.string().nullable(),
    createdById: z.string().uuid(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("UserRoleResponse");

export const UpdateRolePermissionsSchema = z
  .object({
    permissionCodes: z
      .array(z.string().min(1))
      .min(0)
      .max(500)
      .refine((codes) => new Set(codes).size === codes.length, {
        message: "roles/errors:duplicate_permission_codes",
      }),
  })
  .openapi("UpdateRolePermissions");

export type UpdateRolePermissionsInput = z.infer<
  typeof UpdateRolePermissionsSchema
>;
