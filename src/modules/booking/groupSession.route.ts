import { Router } from "express";
import { z } from "zod";
import { groupSessionController } from "./groupSession.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import { DirectMomoCheckoutSchema } from "../payment/payment.types";
import { CreateGroupSessionSchema, JoinGroupSessionSchema } from "./groupSession.types";

const router = Router();
router.use(protect);

const ParamsBookingId = z.object({ bookingId: z.string().uuid() });

router.post("/", validate(CreateGroupSessionSchema), groupSessionController.create);
router.get("/:bookingId", validate(ParamsBookingId, "params"), groupSessionController.getOne);
router.post("/:bookingId/publish", validate(ParamsBookingId, "params"), groupSessionController.publish);
router.post(
  "/:bookingId/join",
  validate(ParamsBookingId, "params"),
  validate(JoinGroupSessionSchema),
  groupSessionController.join
);
router.post(
  "/:bookingId/checkout/wallet",
  validate(ParamsBookingId, "params"),
  groupSessionController.checkoutWithWallet
);
router.post(
  "/:bookingId/checkout/direct-momo",
  validate(ParamsBookingId, "params"),
  validate(DirectMomoCheckoutSchema),
  groupSessionController.checkoutWithDirectMomo
);

export default router;
