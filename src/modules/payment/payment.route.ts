import { Router } from "express";
import { z } from "zod";
import { paymentController } from "./payment.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";
import {
  TopupSchema,
  WithdrawSchema,
  AddPayoutAccountSchema,
  DirectMomoCheckoutSchema,
  CommissionWithdrawSchema,
} from "./payment.types";

const router = Router();
router.use(protect);

router.get("/wallet", paymentController.getMyWallet);
router.post("/wallet/topup", validate(TopupSchema), paymentController.topup);
router.post("/wallet/withdraw", validate(WithdrawSchema), paymentController.withdraw);

router.get("/payout-accounts", paymentController.listPayoutAccounts);
router.post(
  "/payout-accounts",
  validate(AddPayoutAccountSchema),
  paymentController.addPayoutAccount
);
router.delete(
  "/payout-accounts/:id",
  validate(z.object({ id: z.string().uuid() }), "params"),
  paymentController.removePayoutAccount
);

router.post(
  "/bookings/:bookingId/checkout/wallet",
  validate(z.object({ bookingId: z.string().uuid() }), "params"),
  paymentController.checkoutWithWallet
);
router.post(
  "/bookings/:bookingId/checkout/direct-momo",
  validate(z.object({ bookingId: z.string().uuid() }), "params"),
  validate(DirectMomoCheckoutSchema),
  paymentController.checkoutWithDirectMomo
);

router.get("/receipts", paymentController.listMyReceipts);
router.get(
  "/receipts/:referenceNumber",
  validate(z.object({ referenceNumber: z.string().min(1) }), "params"),
  paymentController.getReceiptByReference
);

router.post(
  "/monthly-fee/:chargeId/pay",
  validate(z.object({ chargeId: z.string().uuid() }), "params"),
  paymentController.payOverdueFee
);

// ── Admin — Super Admin platform commission ─────────────────
const adminRouter = Router();
adminRouter.use(protect);
adminRouter.get(
  "/commission",
  restrictTo(permissions.platform.commissionRead),
  paymentController.getCommissionBalance
);
adminRouter.post(
  "/commission/withdraw",
  restrictTo(permissions.platform.commissionWithdraw),
  validate(CommissionWithdrawSchema),
  paymentController.withdrawCommission
);
adminRouter.get(
  "/receipts/:referenceNumber",
  restrictTo(permissions.payments.receiptsRead),
  validate(z.object({ referenceNumber: z.string().min(1) }), "params"),
  paymentController.getReceiptByReference
);
adminRouter.get(
  "/payouts",
  restrictTo(permissions.payments.payoutsRead),
  paymentController.listAdminPayouts
);
adminRouter.get(
  "/reconciliations",
  restrictTo(permissions.payments.reconciliationRead),
  paymentController.listAdminReconciliations
);

export { adminRouter as paymentAdminRouter };
export default router;
