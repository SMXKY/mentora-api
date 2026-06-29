import { registry } from "../../docs/openapi.registry";
import {
  CompleteRegistrationSchema,
  SessionStatusResponseSchema,
  RequestPhoneOtpSchema,
  VerifyPhoneOtpSchema,
  RequestEmailOtpSchema,
  VerifyEmailOtpSchema,
  GoogleAuthSchema,
  CreateAdminSchema,
  LoginSchema,
  ChangePasswordSchema,
  ForgotPasswordSchema,
  VerifyResetOtpSchema,
  ResetPasswordSchema,
} from "./auth.types";
import { z } from "zod";

const tags = ["Auth"];
const basePath = "/api/v1/auth";

const LoginResponseSchema = z
  .object({
    token: z.string(),
    user: z.object({
      id: z.string().uuid(),
      email: z.string().nullable(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
      username: z.string().nullable(),
      phoneNumber: z.string().nullable(),
      profilePictureUrl: z.string().nullable(),
      preferredLanguage: z.enum(["EN", "FR"]),
      isEmailVerified: z.boolean(),
      isAccountComplete: z.boolean(),
      roles: z.array(z.string()),
      permissions: z.array(z.string()),
    }),
  })
  .openapi("LoginResponse");

// ── Phone registration ────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: `${basePath}/register/phone/request-otp`,
  tags,
  summary: "Request phone OTP for registration",
  description:
    "Validates the phone number format (+237 prefix), checks it is not already " +
    "registered, then sends a 6-digit OTP via SMS. Rate limited to 3 requests " +
    "per phone number per hour.",
  request: {
    body: {
      content: { "application/json": { schema: RequestPhoneOtpSchema } },
    },
  },
  responses: {
    200: { description: "OTP sent successfully" },
    400: { description: "Invalid phone number format" },
    409: { description: "Phone number already registered" },
    429: { description: "Rate limit exceeded" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/register/phone/verify-otp`,
  tags,
  summary: "Verify phone OTP and receive registration token",
  description:
    "Verifies the OTP sent to the phone number. On success returns a short-lived " +
    "registration token (15 minutes) to be used with the complete registration endpoint.",
  request: {
    body: {
      content: { "application/json": { schema: VerifyPhoneOtpSchema } },
    },
  },
  responses: {
    200: {
      description: "OTP verified — registration token issued",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ registrationToken: z.string() }),
          }),
        },
      },
    },
    400: { description: "Invalid or expired OTP" },
  },
});

// ── Email registration ────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: `${basePath}/register/email/request-otp`,
  tags,
  summary: "Request email OTP for registration",
  description:
    "Validates the email format, checks it is not already registered, then sends " +
    "a 6-digit OTP via email. Rate limited to 3 requests per email per hour.",
  request: {
    body: {
      content: { "application/json": { schema: RequestEmailOtpSchema } },
    },
  },
  responses: {
    200: { description: "OTP sent successfully" },
    400: { description: "Invalid email format" },
    409: { description: "Email already registered" },
    429: { description: "Rate limit exceeded" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/register/email/verify-otp`,
  tags,
  summary: "Verify email OTP and receive registration token",
  description:
    "Verifies the OTP sent to the email address. On success returns a short-lived " +
    "registration token (15 minutes) to be used with the complete registration endpoint.",
  request: {
    body: {
      content: { "application/json": { schema: VerifyEmailOtpSchema } },
    },
  },
  responses: {
    200: {
      description: "OTP verified — registration token issued",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ registrationToken: z.string() }),
          }),
        },
      },
    },
    400: { description: "Invalid or expired OTP" },
  },
});

// ── Complete registration ─────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: `${basePath}/register/complete`,
  tags,
  summary: "Complete registration — select role and set password",
  description:
    "Final step of the registration flow for phone, email, and Google accounts. " +
    "Accepts the registration token from the verify OTP step, the desired role, " +
    "and (for phone/email) a password and confirmation. Creates the User, Wallet, " +
    "and UserRole in a single transaction and returns a session JWT. " +
    "Google accounts must not include password fields.",
  request: {
    body: {
      content: { "application/json": { schema: CompleteRegistrationSchema } },
    },
  },
  responses: {
    201: {
      description: "Account created — session JWT issued",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ token: z.string() }),
          }),
        },
      },
    },
    400: {
      description:
        "Invalid role, password mismatch, or token missing required fields",
    },
    401: { description: "Registration token expired or invalid" },
    409: { description: "Identity already registered" },
    500: { description: "Role not found in database — seed roles first" },
  },
});

// ── Google auth ───────────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: `${basePath}/google`,
  tags,
  summary: "Sign in or register with Google",
  description:
    "Accepts a Google ID token issued by the Google Identity SDK on the client. " +
    "If the account exists, returns a session JWT and full user payload. " +
    "If the account does not exist, returns a registration token for the complete " +
    "registration endpoint where the user selects a role.",
  request: {
    body: {
      content: { "application/json": { schema: GoogleAuthSchema } },
    },
  },
  responses: {
    200: {
      description:
        "Existing user authenticated or new user registration token issued",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.union([
              z.object({ token: z.string(), user: LoginResponseSchema }),
              z.object({ registrationToken: z.string() }),
            ]),
          }),
        },
      },
    },
    401: { description: "Invalid or expired Google ID token" },
    403: { description: "Account suspended or banned" },
  },
});

// ── Login ─────────────────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: `${basePath}/login`,
  tags,
  summary: "Log in with email, phone, or username and password",
  description:
    "Accepts an identifier (email address, phone number, or username) and password. " +
    "On success returns a session JWT and the full user payload including permissions. " +
    "Logs a new device alert email if the login originates from an unrecognised device.",
  request: {
    body: {
      content: { "application/json": { schema: LoginSchema } },
    },
  },
  responses: {
    200: {
      description: "Login successful",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: LoginResponseSchema,
          }),
        },
      },
    },
    401: { description: "Invalid credentials or account has no password set" },
    403: { description: "Account suspended or banned" },
  },
});

// ── Admin account creation ────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: `${basePath}/admin/create`,
  tags,
  summary: "Create an admin account (Super Admin only)",
  description:
    "Creates an Admin, Moderator, or Support Agent account. Multiple roles can be " +
    "assigned in a single request. The creating Super Admin's ID is recorded as the " +
    "role creator. A welcome email with credentials is sent immediately. " +
    "Requires a valid Super Admin session token.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: CreateAdminSchema } },
    },
  },
  responses: {
    201: { description: "Admin account created and welcome email sent" },
    400: {
      description:
        "Invalid role or password does not meet complexity requirements",
    },
    401: { description: "No valid session token" },
    403: { description: "Insufficient permissions — Super Admin required" },
    409: { description: "Email already registered" },
    500: { description: "Role not found in database — seed roles first" },
  },
});

// ── Change password ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: `${basePath}/change-password`,
  tags,
  summary: "Change password (authenticated)",
  description:
    "Allows an authenticated user to change their password by providing their current " +
    "password, a new password, and a confirmation. Invalidates all existing sessions " +
    "via passwordChangedAt and sends a confirmation email.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: ChangePasswordSchema } },
    },
  },
  responses: {
    200: { description: "Password changed successfully" },
    400: { description: "Account has no password set (Google-only account)" },
    401: { description: "Current password incorrect or no valid session" },
  },
});

// ── Forgot password ───────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: `${basePath}/forgot-password`,
  tags,
  summary: "Request a password reset OTP",
  description:
    "Accepts an email address or Cameroonian phone number. If an account exists, " +
    "sends a 6-digit OTP valid for 30 minutes via email or SMS respectively. " +
    "Always returns 200 to prevent account enumeration.",
  request: {
    body: {
      content: { "application/json": { schema: ForgotPasswordSchema } },
    },
  },
  responses: {
    200: { description: "OTP sent if account exists" },
    400: {
      description:
        "Identity is neither a valid email nor a valid Cameroonian phone number",
    },
    429: { description: "Rate limit exceeded" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/forgot-password/verify-otp`,
  tags,
  summary: "Verify password reset OTP",
  description:
    "Verifies the OTP sent during the forgot password flow. On success returns a " +
    "short-lived reset token (30 minutes) to be used with the reset password endpoint.",
  request: {
    body: {
      content: { "application/json": { schema: VerifyResetOtpSchema } },
    },
  },
  responses: {
    200: {
      description: "OTP verified — reset token issued",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ resetToken: z.string() }),
          }),
        },
      },
    },
    400: { description: "Invalid or expired OTP" },
  },
});

// ── Reset password ────────────────────────────────────────────────────────────

registry.registerPath({
  method: "post",
  path: `${basePath}/reset-password`,
  tags,
  summary: "Reset password using reset token",
  description:
    "Accepts the reset token from the verify OTP step and a new password with " +
    "confirmation. Updates the password and invalidates all existing sessions via " +
    "passwordChangedAt. Sends a password changed confirmation email.",
  request: {
    body: {
      content: { "application/json": { schema: ResetPasswordSchema } },
    },
  },
  responses: {
    200: { description: "Password reset successfully" },
    400: {
      description: "Passwords do not match or complexity requirements not met",
    },
    401: { description: "Reset token expired or invalid" },
    404: { description: "No account found for this identity" },
    403: { description: "Account is banned" },
  },
});

// ── Session status ────────────────────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: `${basePath}/me`,
  tags,
  summary: "Get current session status",
  description:
    "Called on every app cold start after a session token is confirmed. Returns " +
    "whether the user needs to complete registration or is ready to use the app.",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Session status",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: SessionStatusResponseSchema,
          }),
        },
      },
    },
    401: { description: "No valid session token" },
  },
});
