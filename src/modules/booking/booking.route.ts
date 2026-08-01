import { Router } from "express";
import { z } from "zod";
import { bookingController } from "./booking.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";
import {
  CreateBookingRequestSchema,
  RejectBookingSchema,
  CancelBookingSchema,
  CreateRecurringBookingSchema,
  RequestRescheduleSchema,
  RespondToRescheduleSchema,
  ListBookingsQuerySchema,
} from "./booking.types";

const router = Router();
router.use(protect);

const ParamsBookingId = z.object({ id: z.string().uuid() });

router.post("/", validate(CreateBookingRequestSchema), bookingController.create);

router.get("/mine", validate(ListBookingsQuerySchema, "query"), bookingController.listAsBooker);
router.get("/tutor-mine", validate(ListBookingsQuerySchema, "query"), bookingController.listAsTutor);

router.get("/:id", validate(ParamsBookingId, "params"), bookingController.getOne);

router.post("/:id/accept", validate(ParamsBookingId, "params"), bookingController.accept);
router.post(
  "/:id/reject",
  validate(ParamsBookingId, "params"),
  validate(RejectBookingSchema),
  bookingController.reject
);
router.post("/:id/withdraw", validate(ParamsBookingId, "params"), bookingController.withdraw);
router.post(
  "/:id/cancel-by-tutor",
  validate(ParamsBookingId, "params"),
  validate(CancelBookingSchema),
  bookingController.cancelByTutor
);
router.post(
  "/:id/cancel-by-parent",
  validate(ParamsBookingId, "params"),
  validate(CancelBookingSchema),
  bookingController.cancelByParent
);

router.post("/recurring", validate(CreateRecurringBookingSchema), bookingController.createRecurring);
router.get(
  "/series/:seriesId",
  validate(z.object({ seriesId: z.string().uuid() }), "params"),
  bookingController.getSeries
);

router.post("/:id/check-in", validate(ParamsBookingId, "params"), bookingController.checkIn);
router.post("/:id/check-out", validate(ParamsBookingId, "params"), bookingController.checkOut);
router.post("/:id/confirm", validate(ParamsBookingId, "params"), bookingController.confirm);

router.post(
  "/:id/reschedule",
  validate(ParamsBookingId, "params"),
  validate(RequestRescheduleSchema),
  bookingController.requestReschedule
);
router.get(
  "/:id/reschedule",
  validate(ParamsBookingId, "params"),
  bookingController.getPendingReschedule
);
router.post(
  "/reschedule/:requestId/respond",
  validate(z.object({ requestId: z.string().uuid() }), "params"),
  validate(RespondToRescheduleSchema),
  bookingController.respondToReschedule
);

// ── Admin ────────────────────────────────────────────────────
const adminRouter = Router();
adminRouter.use(protect);
adminRouter.get(
  "/",
  restrictTo(permissions.bookings.readAll),
  validate(ListBookingsQuerySchema, "query"),
  bookingController.listAdmin
);
adminRouter.get(
  "/:id",
  restrictTo(permissions.bookings.readAll),
  validate(ParamsBookingId, "params"),
  bookingController.getAdminOne
);

export { adminRouter as bookingAdminRouter };
export default router;
