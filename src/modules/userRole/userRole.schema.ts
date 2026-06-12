import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Fields used when creating a new UserRole
// System fields (id, createdAt, updatedAt, deletedAt) are excluded
export const CreateUserRoleSchema = z
  .object({
  userId: z.string(),
  roleId: z.string(),
  isActive: z.boolean().optional(),
  expiresAt: z.string().datetime().optional(),
  createdById: z.string(),
  reason: z.string().optional(),
  })
  .openapi("CreateUserRole");

// All fields optional for partial updates
export const UpdateUserRoleSchema = CreateUserRoleSchema.partial().openapi(
  "UpdateUserRole"
);

// Full response shape returned to the client
export const UserRoleResponseSchema = z
  .object({
  id: z.string().uuid(),
  userId: z.string(),
  roleId: z.string(),
  isActive: z.boolean(),
  expiresAt: z.string().datetime().optional(),
  createdById: z.string(),
  reason: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  })
  .openapi("UserRole");
