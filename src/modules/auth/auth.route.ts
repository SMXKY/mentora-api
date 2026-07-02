import { Router } from "express";
import { authController } from "./auth.controller";
import protect from "../../middlewares/protect.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  RequestPhoneOtpSchema,
  VerifyPhoneOtpSchema,
  RequestEmailOtpSchema,
  VerifyEmailOtpSchema,
  GoogleAuthSchema,
  CompleteRegistrationSchema,
  CreateAdminSchema,
  ForgotPasswordSchema,
  LoginSchema,
  VerifyResetOtpSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
} from "./auth.types";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";

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

router.post("/google", validate(GoogleAuthSchema), authController.googleAuth);

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

router.post("/login", validate(LoginSchema), authController.login);

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

export default router;
