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

export const LoginSchema = z
  .object({
    identifier: z.string().min(1, "auth/errors:identifierRequired"),
    password: z.string().min(1, "auth/errors:passwordRequired"),
  })
  .openapi("Login");

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "auth/errors:passwordRequired"),
    newPassword: z.string().min(1, "auth/errors:passwordRequired"),
    confirmPassword: z.string().min(1, "auth/errors:passwordRequired"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "auth/errors:passwordsDoNotMatch",
    path: ["confirmPassword"],
  })
  .openapi("ChangePassword");

export const ForgotPasswordSchema = z
  .object({
    identity: z.string().min(1, "auth/errors:identifierRequired"),
  })
  .openapi("ForgotPassword");

export const VerifyResetOtpSchema = z
  .object({
    identity: z.string().min(1, "auth/errors:identifierRequired"),
    code: z.string().length(6, "auth/errors:invalidOtpLength"),
  })
  .openapi("VerifyResetOtp");

export const ResetPasswordSchema = z
  .object({
    resetToken: z.string().min(1, "auth/errors:resetTokenRequired"),
    newPassword: z.string().min(1, "auth/errors:passwordRequired"),
    confirmPassword: z.string().min(1, "auth/errors:passwordRequired"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "auth/errors:passwordsDoNotMatch",
    path: ["confirmPassword"],
  })
  .openapi("ResetPassword");

export type LoginInput = z.infer<typeof LoginSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type VerifyResetOtpInput = z.infer<typeof VerifyResetOtpSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export type RequestEmailOtpInput = z.infer<typeof RequestEmailOtpSchema>;
export type VerifyEmailOtpInput = z.infer<typeof VerifyEmailOtpSchema>;
export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>;

export type CreateAdminInput = z.infer<typeof CreateAdminSchema>;

export type RequestPhoneOtpInput = z.infer<typeof RequestPhoneOtpSchema>;
export type VerifyPhoneOtpInput = z.infer<typeof VerifyPhoneOtpSchema>;

export type SessionStatusResponse = z.infer<typeof SessionStatusResponseSchema>;

// ── Account completion ──────────────────────────────────────
export const CompletionItemSchema = z.object({
  key: z.string(),
  labelCode: z.string(),
  complete: z.boolean(),
});

export const CompletionResponseSchema = z
  .object({
    completionStatus: z.enum(["complete", "incomplete"]),
    isComplete: z.boolean(),
    role: z.string().nullable(),
    percent: z.number(),
    items: z.array(CompletionItemSchema),
    missing: z.array(z.string()),
  })
  .openapi("AccountCompletion");

// ── Self-deactivation / reactivation ────────────────────────
// Accounts with a password confirm with it; passwordless (Google) accounts
// re-verify a fresh OTP instead — exactly one of the two must be present.
export const DeactivateAccountSchema = z
  .object({
    password: z.string().optional(),
    otpCode: z.string().length(6, "auth/errors:invalidOtpLength").optional(),
  })
  .refine((d) => !!d.password !== !!d.otpCode, {
    message: "auth/errors:deactivateConfirmationRequired",
    path: ["password"],
  })
  .openapi("DeactivateAccount");

export const ReactivateAccountSchema = z
  .object({
    identifier: z.string().min(1, "auth/errors:identifierRequired"),
    password: z.string().optional(),
    otpCode: z.string().length(6, "auth/errors:invalidOtpLength").optional(),
  })
  .refine((d) => !!d.password !== !!d.otpCode, {
    message: "auth/errors:deactivateConfirmationRequired",
    path: ["password"],
  })
  .openapi("ReactivateAccount");

export type DeactivateAccountInput = z.infer<typeof DeactivateAccountSchema>;
export type ReactivateAccountInput = z.infer<typeof ReactivateAccountSchema>;
