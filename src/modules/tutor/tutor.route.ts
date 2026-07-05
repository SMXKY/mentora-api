import { Router } from "express";
import { z } from "zod";
import { tutorController } from "./tutor.controller";
import { validate, ParamsId } from "../../middlewares/validate.middleware";
import { UpdateMyTutorProfileSchema, UpdateSubjectPricingSchema } from "./tutor.schema";
import protect from "../../middlewares/protect.middleware";

const router = Router();

// Self-service routes first — otherwise the public "/:id" route below
// would swallow "/me" as if "me" were a tutorProfile id.
router.get("/me", protect, tutorController.getMe);
router.patch("/me", protect, validate(UpdateMyTutorProfileSchema), tutorController.updateMe);

router.patch(
  "/me/subjects/:subjectId",
  protect,
  validate(z.object({ subjectId: z.string().uuid() }), "params"),
  validate(UpdateSubjectPricingSchema),
  tutorController.updateSubjectPricing
);

// Public — no auth. Only ever exposes ACTIVE tutors' safe, non-KYC fields.
router.get("/:id", validate(ParamsId, "params"), tutorController.getPublicProfile);

export default router;
