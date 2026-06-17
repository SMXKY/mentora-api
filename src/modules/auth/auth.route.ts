import { Router } from "express";
import { authController } from "./auth.controller";
import { requireClerkAuth } from "../../middlewares/requireClerkAuth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { CompleteRegistrationSchema } from "./auth.types";

const router = Router();

router.post(
  "/complete-registration",
  requireClerkAuth,
  validate(CompleteRegistrationSchema),
  authController.completeRegistration
);

router.get("/me", requireClerkAuth, authController.me);

export default router;
