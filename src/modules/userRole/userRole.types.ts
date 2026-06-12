import { z } from "zod";
import {
  CreateUserRoleSchema,
  UpdateUserRoleSchema,
  UserRoleResponseSchema,
} from "./userRole.schema";

export type CreateUserRoleInput = z.infer<typeof CreateUserRoleSchema>;
export type UpdateUserRoleInput = z.infer<typeof UpdateUserRoleSchema>;
export type UserRoleResponse = z.infer<typeof UserRoleResponseSchema>;
