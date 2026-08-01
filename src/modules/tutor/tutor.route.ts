import { Router } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { tutorController } from "./tutor.controller";
import { validate, ParamsId } from "../../middlewares/validate.middleware";
import { UpdateMyTutorProfileSchema, UpdateSubjectPricingSchema } from "./tutor.schema";
import protect from "../../middlewares/protect.middleware";

const router = Router();

const introVideoUpload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) =>
      cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 200 * 1024 * 1024, files: 1 },
});

// Self-service routes first — otherwise the public "/:id" route below
// would swallow "/me" as if "me" were a tutorProfile id.
router.get("/me", protect, tutorController.getMe);
router.patch("/me", protect, validate(UpdateMyTutorProfileSchema), tutorController.updateMe);

router.post(
  "/me/intro-video",
  protect,
  introVideoUpload.single("video"),
  tutorController.uploadIntroVideo
);

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
