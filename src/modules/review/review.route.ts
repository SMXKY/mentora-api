import { Router } from "express";
import { z } from "zod";
import { reviewController } from "./review.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import { SubmitReviewSchema, ListTutorReviewsQuerySchema } from "./review.types";

const router = Router();

router.post(
  "/bookings/:bookingId/review",
  protect,
  validate(z.object({ bookingId: z.string().uuid() }), "params"),
  validate(SubmitReviewSchema),
  reviewController.submit
);

router.post(
  "/:id/response",
  protect,
  validate(z.object({ id: z.string().uuid() }), "params"),
  validate(z.object({ response: z.string().trim().min(1).max(1000) })),
  reviewController.respond
);

// Public — anyone can read a tutor's revealed reviews.
router.get(
  "/tutors/:tutorProfileId",
  validate(z.object({ tutorProfileId: z.string().uuid() }), "params"),
  validate(ListTutorReviewsQuerySchema, "query"),
  reviewController.listForTutor
);

export default router;
