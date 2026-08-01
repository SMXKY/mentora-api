import { Router } from "express";
import { z } from "zod";
import { availabilityController } from "./availability.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import {
  CreateAvailabilitySlotSchema,
  UpdateAvailabilitySlotSchema,
  AvailableWindowsQuerySchema,
} from "./availability.types";
import checkKyc from "../../middlewares/checkKyc.middleware";
import checkAccountCompletion from "../../middlewares/checkAccountCompletion.middleware";

const router = Router();

// Self-service — a tutor manages their own availability; ownership is
// enforced in the service layer, matching the rest of this app's "/me"
// routes (no RBAC permission gate needed for one's own resource).
router.get(
  "/me/availability",
  protect,
  checkAccountCompletion,
  checkKyc,
  availabilityController.listMine
);

router.post(
  "/me/availability",
  protect,
  checkAccountCompletion,
  checkKyc,
  validate(CreateAvailabilitySlotSchema),
  availabilityController.create
);

router.patch(
  "/me/availability/:id",
  protect,
  checkAccountCompletion,
  checkKyc,
  validate(z.object({ id: z.string().uuid() }), "params"),
  validate(UpdateAvailabilitySlotSchema),
  availabilityController.update
);

router.delete(
  "/me/availability/:id",
  protect,
  checkAccountCompletion,
  checkKyc,
  validate(z.object({ id: z.string().uuid() }), "params"),
  availabilityController.remove
);

// Public — computed open windows for a specific tutor+date, used by the
// booking flow to only ever offer bookable times. Mounted under the same
// `/api/v1/tutors` base as tutor.route.ts, so this resolves to
// `/api/v1/tutors/:tutorProfileId/availability/windows`.
router.get(
  "/:tutorProfileId/availability/windows",
  validate(z.object({ tutorProfileId: z.string().uuid() }), "params"),
  validate(AvailableWindowsQuerySchema, "query"),
  availabilityController.getWindowsForTutor
);

export default router;
