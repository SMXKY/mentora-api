import { z } from "zod";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserResponseSchema,
} from "./user.schema";

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
