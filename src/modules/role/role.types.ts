import { z } from "zod";
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  RoleResponseSchema,
  AssignRoleSchema,
  UserRoleResponseSchema,
  UpdateRolePermissionsSchema,
} from "./role.schema";

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type RoleResponse = z.infer<typeof RoleResponseSchema>;
export type AssignRoleInput = z.infer<typeof AssignRoleSchema>;
export type UserRoleResponse = z.infer<typeof UserRoleResponseSchema>;
export type UpdateRolePermissionsInput = z.infer<
  typeof UpdateRolePermissionsSchema
>;
