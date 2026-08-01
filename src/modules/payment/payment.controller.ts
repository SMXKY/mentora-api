import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import prisma from "../../config/database.config";
import { WalletType } from "../../generated/prisma";
import { WalletService } from "../../services/payment/wallet.service";
import { PayoutAccountService } from "../../services/payment/payoutAccount.service";
import { PaymentService } from "./payment.service";
import { withIdempotency } from "../../services/payment/idempotency.util";
import { ReceiptService } from "../../services/payment/receipt.service";
import { PlatformCommissionService } from "../../services/payment/platformCommission.service";
import { payOverdueFee } from "../../services/payment/monthlyFee.processor";

async function inferWalletType(userId: string): Promise<WalletType> {
  const tutorProfile = await prisma.tutorProfile.findFirst({ where: { userId }, select: { id: true } });
  if (tutorProfile) return WalletType.TUTOR;
  const ownStudentProfile = await prisma.studentProfile.findFirst({ where: { userId }, select: { id: true } });
  if (ownStudentProfile) return WalletType.STUDENT;
  return WalletType.PARENT;
}

export const paymentController = {
  getMyWallet: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const walletType = await inferWalletType(ctx.userId!);
    const wallet = await WalletService.getMyWallet(ctx.userId!, walletType);
    appResponder(StatusCodes.OK, { wallet }, res);
  }),

  topup: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const walletType = await inferWalletType(ctx.userId!);
    const idempotencyKey = req.header("Idempotency-Key");
    const { status, body } = await withIdempotency(ctx.userId!, idempotencyKey, "wallet.topup", async () => {
      const wallet = await WalletService.topup(ctx.userId!, walletType, req.body.amountXaf, req.body.phone);
      return { status: StatusCodes.OK, body: { wallet } };
    });
    appResponder(status, body as object, res);
  }),

  withdraw: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const idempotencyKey = req.header("Idempotency-Key");
    const { status, body } = await withIdempotency(ctx.userId!, idempotencyKey, "wallet.withdraw", async () => {
      const result = await WalletService.withdraw(ctx.userId!, req.body.amountXaf, req.body.paymentAccountId);
      return { status: StatusCodes.OK, body: { result } };
    });
    appResponder(status, body as object, res);
  }),

  listPayoutAccounts: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const accounts = await PayoutAccountService.listMyAccounts(ctx.userId!);
    appResponder(StatusCodes.OK, { accounts }, res);
  }),

  addPayoutAccount: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const account = await PayoutAccountService.addAccount(ctx.userId!, req.body);
    appResponder(StatusCodes.CREATED, { account }, res);
  }),

  removePayoutAccount: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await PayoutAccountService.removeAccount(ctx.userId!, req.params.id);
    appResponder(StatusCodes.NO_CONTENT, {}, res);
  }),

  checkoutWithWallet: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const idempotencyKey = req.header("Idempotency-Key");
    const { status, body } = await withIdempotency(ctx.userId!, idempotencyKey, "booking.checkout.wallet", async () => {
      const result = await PaymentService.walletCheckout(ctx.userId!, req.params.bookingId);
      return { status: StatusCodes.OK, body: result };
    });
    appResponder(status, body as object, res);
  }),

  checkoutWithDirectMomo: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const idempotencyKey = req.header("Idempotency-Key");
    const { status, body } = await withIdempotency(ctx.userId!, idempotencyKey, "booking.checkout.momo", async () => {
      const result = await PaymentService.directMomoCheckout(ctx.userId!, req.params.bookingId, req.body.phone);
      return { status: StatusCodes.OK, body: result };
    });
    appResponder(status, body as object, res);
  }),

  listMyReceipts: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const receipts = await ReceiptService.listMyReceipts(ctx.userId!);
    appResponder(StatusCodes.OK, { receipts }, res);
  }),

  getReceiptByReference: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const receipt = await ReceiptService.getReceiptByReference(req.params.referenceNumber);
    appResponder(StatusCodes.OK, { receipt }, res);
  }),

  payOverdueFee: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await payOverdueFee(ctx.userId!, req.params.chargeId);
    appResponder(StatusCodes.OK, { paid: true }, res);
  }),

  getCommissionBalance: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const balance = await PlatformCommissionService.getBalance();
    appResponder(StatusCodes.OK, balance, res);
  }),

  withdrawCommission: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await PlatformCommissionService.withdraw(req.body.amountXaf, req.body.phone, ctx);
    appResponder(StatusCodes.OK, result, res);
  }),

  listAdminPayouts: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const payouts = await PaymentService.listAdminPayouts(req.query.status as string | undefined);
    appResponder(StatusCodes.OK, { payouts }, res);
  }),

  listAdminReconciliations: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const resolvedParam = req.query.resolved as string | undefined;
    const resolved = resolvedParam === undefined ? undefined : resolvedParam === "true";
    const reconciliations = await PaymentService.listAdminReconciliations(resolved);
    appResponder(StatusCodes.OK, { reconciliations }, res);
  }),
};

export default paymentController;
