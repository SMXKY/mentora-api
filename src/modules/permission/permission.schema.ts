import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Fields used when creating a new Permission
// System fields (id, createdAt, updatedAt, deletedAt) are excluded
export const CreatePermissionSchema = z
  .object({
  code: z.string(),
  nameLocaleCode: z.string(),
  descriptionLocaleCode: z.string().optional(),
  isSystem: z.boolean(),
  permissionModuleId: z.string(),
  permissionSubmoduleId: z.string().optional(),
  riskLevel: z.string().optional(),
  })
  .openapi("CreatePermission");

// All fields optional for partial updates
export const UpdatePermissionSchema = CreatePermissionSchema.partial().openapi(
  "UpdatePermission"
);

// Full response shape returned to the client
export const PermissionResponseSchema = z
  .object({
  id: z.string().uuid(),
  code: z.string(),
  nameLocaleCode: z.string(),
  descriptionLocaleCode: z.string().optional(),
  isSystem: z.boolean(),
  permissionModuleId: z.string(),
  permissionSubmoduleId: z.string().optional(),
  riskLevel: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  })
  .openapi("Permission");
