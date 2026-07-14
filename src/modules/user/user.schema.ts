import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Fields used when creating a new User
// System-managed fields (id, createdAt, updatedAt, deletedAt, isSystem,
// lastLoggedInAt) are excluded — those are never client-settable.
// `password` is intentionally excluded too: password creation/hashing
// only happens through the auth module (register/complete,
// admin/create), never through this generic admin CRUD endpoint.
export const CreateUserSchema = z
  .object({
    googleAuthId: z.string().optional(),
    facebookAuthId: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    username: z.string().optional(),
    email: z.string().email().optional(),
    isEmailVerified: z.boolean().optional(),
    phoneNumber: z.string().optional(),
    whatsappNumber: z.string().optional(),
    whatsappOptIn: z.boolean().optional(),
    whatsappOptInAt: z.string().datetime().optional(),
    dob: z.string().datetime().optional(),
    gender: z.enum(["MALE", "FEMALE", "PREFER_NOT_TO_SAY"]).optional(),
    profilePictureUrl: z.string().optional(),
    address: z.string().optional(),
    preferredLanguage: z.enum(["EN", "FR"]).optional(),
    notificationsMuted: z.boolean().optional(),
    status: z
      .enum(["ACTIVE", "INACTIVE", "SUSPENDED", "DEACTIVATED", "BANNED"])
      .optional(),
    isAccountComplete: z.boolean().optional(),
  })
  .openapi("CreateUser");

// All fields optional for partial updates
export const UpdateUserSchema = CreateUserSchema.partial().openapi(
  "UpdateUser"
);

// Self-service subset — deliberately excludes fields only an admin may
// change (email, isEmailVerified, username, status, isAccountComplete,
// googleAuthId, facebookAuthId, whatsapp opt-in bookkeeping, profilePictureUrl
// — that one has its own dedicated multipart endpoint).
export const UpdateMeSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phoneNumber: z.string().optional(),
    dob: z.string().datetime().optional(),
    gender: z.enum(["MALE", "FEMALE", "PREFER_NOT_TO_SAY"]).optional(),
    address: z.string().optional(),
    preferredLanguage: z.enum(["EN", "FR"]).optional(),
    notificationsMuted: z.boolean().optional(),
  })
  .openapi("UpdateMe");

// Full response shape returned to the client — password is never
// included here (see user.repository.ts, which strips it from every
// record before it reaches this layer).
export const UserResponseSchema = z
  .object({
    id: z.string().uuid(),
    googleAuthId: z.string().nullable().optional(),
    facebookAuthId: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    isEmailVerified: z.boolean(),
    phoneNumber: z.string().nullable().optional(),
    whatsappNumber: z.string().nullable().optional(),
    whatsappOptIn: z.boolean(),
    whatsappOptInAt: z.string().datetime().nullable().optional(),
    dob: z.string().datetime().nullable().optional(),
    gender: z.string(),
    profilePictureUrl: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    preferredLanguage: z.string(),
    notificationsMuted: z.boolean(),
    status: z.string(),
    isSystem: z.boolean(),
    isAccountComplete: z.boolean(),
    lastLoggedInAt: z.string().datetime().nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("User");

// Lightweight self-view of a tutor/student profile — deliberately not the
// full profile shape. Excludes matching/search internals (compositeScore,
// responseRate, newTutorBoostExpiresAt, rate bounds) and admin-facing
// fields (isPaymentOverdue, KYC timestamps/rejection reason) for tutors;
// excludes guardian-managed children for students (see MeResponseSchema).
const MeTutorProfileSchema = z
  .object({
    id: z.string().uuid(),
    bio: z.string(),
    yearsOfExperience: z.number().int(),
    teachingMode: z.string(),
    languages: z.array(z.string()),
    kycStatus: z.string(),
    completedSessionsCount: z.number().int(),
    cityId: z.string().uuid(),
    neighbourhood: z.string().nullable(),
  })
  .openapi("MeTutorProfile");

const MeStudentProfileSchema = z
  .object({
    id: z.string().uuid(),
    firstName: z.string(),
    levelId: z.string().uuid().nullable(),
    schoolType: z.string().nullable(),
    preferredLanguage: z.string().nullable(),
  })
  .openapi("MeStudentProfile");

// GET /users/me — cheap, cacheable self-profile. Not a full data dump:
// bookings, wallet, disputes, KYC history, risk scores, and support
// tickets each have their own dedicated routes.
export const MeResponseSchema = z
  .object({
    id: z.string().uuid(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    username: z.string().nullable(),
    email: z.string().nullable(),
    isEmailVerified: z.boolean(),
    phoneNumber: z.string().nullable(),
    whatsappNumber: z.string().nullable(),
    whatsappOptIn: z.boolean(),
    dob: z.string().datetime().nullable(),
    gender: z.string(),
    profilePictureUrl: z.string().nullable(),
    address: z.string().nullable(),
    preferredLanguage: z.string(),
    notificationsMuted: z.boolean(),
    status: z.string(),
    isAccountComplete: z.boolean(),
    lastLoggedInAt: z.string().datetime().nullable(),
    roles: z.array(z.string()),
    tutorProfile: MeTutorProfileSchema.nullable(),
    studentProfile: MeStudentProfileSchema.nullable(),
  })
  .openapi("MeResponse");
