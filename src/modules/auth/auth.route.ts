import { Router, Request, Response, NextFunction } from "express";
import { authController } from "./auth.controller";
import protect from "../../middlewares/protect.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  RequestPhoneOtpSchema,
  VerifyPhoneOtpSchema,
  RequestEmailOtpSchema,
  VerifyEmailOtpSchema,
  GoogleAuthSchema,
  GoogleCallbackQuerySchema,
  CompleteRegistrationSchema,
  CreateAdminSchema,
  ForgotPasswordSchema,
  LoginSchema,
  VerifyResetOtpSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  DeactivateAccountSchema,
  ReactivateAccountSchema,
  RequestEmailVerificationSchema,
  ConfirmEmailVerificationSchema,
  StagingCreateUserSchema,
} from "./auth.types";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

const router = Router();

router.post(
  "/register/phone/request-otp",
  validate(RequestPhoneOtpSchema),
  authController.requestPhoneOtp
);

router.post(
  "/register/phone/verify-otp",
  validate(VerifyPhoneOtpSchema),
  authController.verifyPhoneOtp
);

router.post(
  "/register/email/request-otp",
  validate(RequestEmailOtpSchema),
  authController.requestEmailOtp
);

router.post(
  "/register/email/verify-otp",
  validate(VerifyEmailOtpSchema),
  authController.verifyEmailOtp
);

router.post(
  "/email-verification/request",
  protect,
  validate(RequestEmailVerificationSchema),
  authController.requestEmailVerification
);

router.post(
  "/email-verification/confirm",
  protect,
  validate(ConfirmEmailVerificationSchema),
  authController.confirmEmailVerification
);

router.post("/google", validate(GoogleAuthSchema), authController.googleAuth);

// Mobile OAuth redirect bridge: Google's server-side redirect target after
// the user consents in-browser. Public (Google, not our own client, calls
// this), and query-validated rather than body-validated since it's a GET.
router.get(
  "/google/callback",
  validate(GoogleCallbackQuerySchema, "query"),
  authController.googleCallback
);

router.post(
  "/register/complete",
  validate(CompleteRegistrationSchema),
  authController.completeRegistration
);

router.post(
  "/admin/create",
  protect,
  restrictTo(permissions.users.manage),
  validate(CreateAdminSchema),
  authController.createAdminUser
);

router.get("/me", protect, authController.me);

router.get("/me/completion", protect, authController.getCompletion);

router.post(
  "/me/deactivate/request-otp",
  protect,
  authController.requestDeactivationOtp
);

router.post(
  "/me/deactivate",
  protect,
  validate(DeactivateAccountSchema),
  authController.deactivateMe
);

// Not behind `protect` — a deactivated account's own token no longer
// works (session invalidated, deletedAt set), so reactivation re-verifies
// identity from scratch, same as login.
router.post(
  "/me/reactivate",
  validate(ReactivateAccountSchema),
  authController.reactivateMe
);

router.post("/user/login", validate(LoginSchema), authController.login);
router.post("/admin/login", validate(LoginSchema), authController.loginAdmin);

router.post(
  "/forgot-password",
  validate(ForgotPasswordSchema),
  authController.forgotPassword
);

router.post(
  "/forgot-password/verify-otp",
  validate(VerifyResetOtpSchema),
  authController.verifyResetOtp
);

router.post(
  "/reset-password",
  validate(ResetPasswordSchema),
  authController.resetPassword
);

router.post(
  "/change-password",
  protect,
  validate(ChangePasswordSchema),
  authController.changePassword
);

// Dev/staging-only debug route — never registered in production.
if (process.env.NODE_ENV !== "production") {
  router.get("/dev/otp", authController.devPeekOtp);
}

// Staging-only account factory — not registered at all unless STAGING_AUTH
// is explicitly "true" (default off, same conditional-registration pattern
// as /dev/otp above, deliberately stronger than a runtime env check since
// the route path itself doesn't exist otherwise). Gated to the "Super
// Admin" role specifically (checked via res.locals.user.roles, already
// populated by protect below — see protect.middleware.ts) rather than any
// lower admin tier. See auth.service.ts's stagingCreateUser for why this
// sends no email/OTP.
if (process.env.STAGING_AUTH === "true") {
  const requireStagingAuthAdmin = (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user as { roles?: { name: string }[] } | undefined;
    const isSuperAdmin = user?.roles?.some((r) => r.name === "Super Admin") ?? false;
    if (!isSuperAdmin) {
      return next(new AppError("auth/errors:insufficientPermissions", StatusCodes.FORBIDDEN));
    }
    next();
  };

  router.post(
    "/staging/create",
    protect,
    requireStagingAuthAdmin,
    validate(StagingCreateUserSchema),
    authController.stagingCreateUser
  );
}

export default router;
