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
} from "./auth.types";
import restrictTo from "../../middlewares/restrictTo.middleware";

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
  // restrictTo("can_create_admin_account"),
  validate(CreateAdminSchema),
  authController.createAdminUser
);

router.get("/me", protect, authController.me);

export default router;
