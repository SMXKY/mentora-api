import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Fields used when creating a new User
// System fields (id, createdAt, updatedAt, deletedAt) are excluded
export const CreateUserSchema = z
  .object({
  clerkId: z.string(),
  googleAuthId: z.string().optional(),
  facebookAuthId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  username: z.string().optional(),
  email: z.string(),
  isEmailVerified: z.boolean(),
  phoneNumber: z.string().optional(),
  whatsappNumber: z.string().optional(),
  whatsappOptIn: z.boolean(),
  whatsappOptInAt: z.string().datetime().optional(),
  dob: z.string().datetime().optional(),
  gender: z.string().optional(),
  profilePictureUrl: z.string().optional(),
  address: z.string().optional(),
  preferredLanguage: z.string().optional(),
  notificationsMuted: z.boolean(),
  status: z.string().optional(),
  isSystem: z.boolean(),
  isAccountComplete: z.boolean(),
  lastLoggedInAt: z.string().datetime().optional(),
  })
  .openapi("CreateUser");

// All fields optional for partial updates
export const UpdateUserSchema = CreateUserSchema.partial().openapi(
  "UpdateUser"
);

// Full response shape returned to the client
export const UserResponseSchema = z
  .object({
  id: z.string().uuid(),
  clerkId: z.string(),
  googleAuthId: z.string().optional(),
  facebookAuthId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  username: z.string().optional(),
  email: z.string(),
  isEmailVerified: z.boolean(),
  phoneNumber: z.string().optional(),
  whatsappNumber: z.string().optional(),
  whatsappOptIn: z.boolean(),
  whatsappOptInAt: z.string().datetime().optional(),
  dob: z.string().datetime().optional(),
  gender: z.string(),
  profilePictureUrl: z.string().optional(),
  address: z.string().optional(),
  preferredLanguage: z.string(),
  notificationsMuted: z.boolean(),
  status: z.string(),
  isSystem: z.boolean(),
  isAccountComplete: z.boolean(),
  lastLoggedInAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  })
  .openapi("User");
