import { z } from "zod";
import {
  CreatePermissionOverrideSchema,
  UpdatePermissionOverrideSchema,
  PermissionOverrideResponseSchema,
  GrantPermissionOverrideSchema,
  RevokePermissionOverrideSchema,
} from "./permissionOverride.schema";

export type CreatePermissionOverrideInput = z.infer<
  typeof CreatePermissionOverrideSchema
>;
export type UpdatePermissionOverrideInput = z.infer<
  typeof UpdatePermissionOverrideSchema
>;
export type PermissionOverrideResponse = z.infer<
  typeof PermissionOverrideResponseSchema
>;
export type GrantPermissionOverrideInput = z.infer<
  typeof GrantPermissionOverrideSchema
>;
export type RevokePermissionOverrideInput = z.infer<
  typeof RevokePermissionOverrideSchema
>;
