import { Router } from "express";
import { z } from "zod";
import { reviewController } from "./review.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";
import {
  SubmitReviewSchema,
  ListTutorReviewsQuerySchema,
  ReportReviewSchema,
  ReviewReviewReportSchema,
  ListReviewReportsQuerySchema,
  SubmitIncidentReportSchema,
  ReviewIncidentReportSchema,
  ListIncidentReportsQuerySchema,
} from "./review.types";

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

router.post(
  "/:id/report",
  protect,
  validate(z.object({ id: z.string().uuid() }), "params"),
  validate(ReportReviewSchema),
  reviewController.report
);

router.post(
  "/bookings/:bookingId/incident-report",
  protect,
  validate(z.object({ bookingId: z.string().uuid() }), "params"),
  validate(SubmitIncidentReportSchema),
  reviewController.submitIncidentReport
);

// Public — anyone can read a tutor's revealed reviews.
router.get(
  "/tutors/:tutorProfileId",
  validate(z.object({ tutorProfileId: z.string().uuid() }), "params"),
  validate(ListTutorReviewsQuerySchema, "query"),
  reviewController.listForTutor
);

const adminRouter = Router();
adminRouter.use(protect);

adminRouter.get(
  "/reports",
  restrictTo(permissions.reviews.reportsRead),
  validate(ListReviewReportsQuerySchema, "query"),
  reviewController.listReviewReports
);
adminRouter.post(
  "/reports/:id/review",
  restrictTo(permissions.reviews.reportsReview),
  validate(z.object({ id: z.string().uuid() }), "params"),
  validate(ReviewReviewReportSchema),
  reviewController.reviewReport
);

adminRouter.get(
  "/incidents",
  restrictTo(permissions.reviews.incidentsRead),
  validate(ListIncidentReportsQuerySchema, "query"),
  reviewController.listIncidentReports
);
adminRouter.get(
  "/incidents/:id",
  restrictTo(permissions.reviews.incidentsRead),
  validate(z.object({ id: z.string().uuid() }), "params"),
  reviewController.getIncidentReport
);
adminRouter.post(
  "/incidents/:id/review",
  restrictTo(permissions.reviews.incidentsReview),
  validate(z.object({ id: z.string().uuid() }), "params"),
  validate(ReviewIncidentReportSchema),
  reviewController.reviewIncidentReport
);

export { adminRouter as reviewAdminRouter };
export default router;
