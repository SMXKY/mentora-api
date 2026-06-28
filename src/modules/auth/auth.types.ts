import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const SelfRegisterableRole = z.enum(["Parent", "Student", "Tutor"]);

export const CompleteRegistrationSchema = z
  .object({
    registrationToken: z.string().min(1),
    role: SelfRegisterableRole,
    password: z.string().optional(),
    confirmPassword: z.string().optional(),
  })
  .openapi("CompleteRegistration");

export type CompleteRegistrationInput = z.infer<
  typeof CompleteRegistrationSchema
>;

export const SessionStatusResponseSchema = z
  .discriminatedUnion("status", [
    z.object({
      status: z.literal("needs_registration"),
    }),
    z.object({
      status: z.literal("ready"),
      user: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        firstName: z.string().nullable(),
        lastName: z.string().nullable(),
        isEmailVerified: z.boolean(),
        isAccountComplete: z.boolean(),
        preferredLanguage: z.enum(["EN", "FR"]),
        role: z.string(),
      }),
    }),
  ])
  .openapi("SessionStatus");

export const RequestPhoneOtpSchema = z
  .object({
    phone: z.string().min(1, "auth/errors:phoneRequired"),
  })
  .openapi("RequestPhoneOtp");

export const VerifyPhoneOtpSchema = z
  .object({
    phone: z.string().min(1, "auth/errors:phoneRequired"),
    code: z.string().length(6, "auth/errors:invalidOtpLength"),
  })
  .openapi("VerifyPhoneOtp");

export const AdminAssignableRole = z.enum([
  "Admin",
  "Moderator",
  "Support Agent",
]);

export const CreateAdminSchema = z
  .object({
    email: z.string().email("auth/errors:invalidEmailFormat"),
    firstName: z.string().min(1, "auth/errors:firstNameRequired"),
    lastName: z.string().min(1, "auth/errors:lastNameRequired"),
    roles: z.array(AdminAssignableRole).min(1, "auth/errors:rolesRequired"),
    password: z.string().min(1, "auth/errors:passwordRequired"),
    confirmPassword: z.string().min(1, "auth/errors:passwordRequired"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "auth/errors:passwordsDoNotMatch",
    path: ["confirmPassword"],
  })
  .openapi("CreateAdmin");

export const RequestEmailOtpSchema = z
  .object({
    email: z.string().email("auth/errors:invalidEmailFormat"),
  })
  .openapi("RequestEmailOtp");

export const VerifyEmailOtpSchema = z
  .object({
    email: z.string().email("auth/errors:invalidEmailFormat"),
    code: z.string().length(6, "auth/errors:invalidOtpLength"),
  })
  .openapi("VerifyEmailOtp");

export const GoogleAuthSchema = z
  .object({
    idToken: z.string().min(1, "auth/errors:idTokenRequired"),
  })
  .openapi("GoogleAuth");

export type RequestEmailOtpInput = z.infer<typeof RequestEmailOtpSchema>;
export type VerifyEmailOtpInput = z.infer<typeof VerifyEmailOtpSchema>;
export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>;

export type CreateAdminInput = z.infer<typeof CreateAdminSchema>;

export type RequestPhoneOtpInput = z.infer<typeof RequestPhoneOtpSchema>;
export type VerifyPhoneOtpInput = z.infer<typeof VerifyPhoneOtpSchema>;

export type SessionStatusResponse = z.infer<typeof SessionStatusResponseSchema>;
