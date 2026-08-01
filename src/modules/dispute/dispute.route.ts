import { Router } from "express";
import { z } from "zod";
import { disputeController } from "./dispute.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";
import {
  OpenDisputeSchema,
  RespondToDisputeSchema,
  ResolveDisputeSchema,
  ListDisputesQuerySchema,
} from "./dispute.types";

const router = Router();
router.use(protect);

const ParamsDisputeId = z.object({ id: z.string().uuid() });

router.post(
  "/bookings/:bookingId/dispute",
  validate(z.object({ bookingId: z.string().uuid() }), "params"),
  validate(OpenDisputeSchema),
  disputeController.open
);

router.get(
  "/bookings/:bookingId/dispute",
  validate(z.object({ bookingId: z.string().uuid() }), "params"),
  disputeController.getForBooking
);

router.get("/:id", validate(ParamsDisputeId, "params"), disputeController.getOne);

router.post(
  "/:id/respond",
  validate(ParamsDisputeId, "params"),
  validate(RespondToDisputeSchema),
  disputeController.respond
);

// ── Admin ────────────────────────────────────────────────────
router.post(
  "/:id/resolve",
  restrictTo(permissions.disputes.resolve),
  validate(ParamsDisputeId, "params"),
  validate(ResolveDisputeSchema),
  disputeController.resolve
);

router.get(
  "/:id/evidence",
  restrictTo(permissions.disputes.evidenceRead),
  validate(ParamsDisputeId, "params"),
  disputeController.getEvidence
);

const adminRouter = Router();
adminRouter.use(protect);
adminRouter.get(
  "/",
  restrictTo(permissions.disputes.readAll),
  validate(ListDisputesQuerySchema, "query"),
  disputeController.listAdmin
);

export { adminRouter as disputeAdminRouter };
export default router;
