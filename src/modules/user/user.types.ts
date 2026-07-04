import { z } from "zod";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UpdateMeSchema,
  UserResponseSchema,
} from "./user.schema";

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UpdateMeInput = z.infer<typeof UpdateMeSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
