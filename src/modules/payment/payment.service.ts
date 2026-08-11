import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  Prisma,
  BookingStatus,
  WalletType,
  LedgerOperation,
  LedgerStatus,
  PaymentDirection,
  NotificationType,
  NotificationResourceType,
} from "../../generated/prisma";
import { assertValidTransition } from "../../services/booking/bookingStateMachine";
import { cancelScheduledJobsForBooking } from "../../services/booking/paymentWindow.processor";
import { paymentConfig } from "../../services/payment/paymentConfig";
import { EscrowService } from "../../services/payment/escrow.service";
import { WalletService } from "../../services/payment/wallet.service";
import { FapshiService } from "../../services/payment/fapshi.service";
import { NotificationService } from "../../services/notification/notification.service";
import { ReceiptService } from "../../services/payment/receipt.service";
import { scheduleReconciliationCheck } from "../../services/payment/reconciliation.processor";
import type { FapshiStatusResult } from "../../services/payment/fapshi.service";
import { MessagingService } from "../messaging/messaging.service";

async function loadPayableBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, deletedAt: null },
    include: { tutorProfile: { select: { userId: true } } },
  });
  if (!booking) throw new AppError("booking/errors:bookingNotFound", StatusCodes.NOT_FOUND);
  if (booking.bookerId !== userId) {
    throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  }
  assertValidTransition(booking.status, BookingStatus.PAID);
  if (booking.paymentWindowExpiresAt && booking.paymentWindowExpiresAt < new Date()) {
    throw new AppError("payment/errors:paymentWindowExpired", StatusCodes.CONFLICT);
  }
  if (!booking.agreedRateXaf) {
    throw new AppError("payment/errors:bookingHasNoAgreedRate", StatusCodes.CONFLICT);
  }
  return booking;
}

interface FinalizeParams {
  booking: Awaited<ReturnType<typeof loadPayableBooking>>;
  momoFeeXaf: number;
  ledgerOperation: LedgerOperation;
  providerTransactionId?: string;
  momoPhone?: string;
  momoProvider?: string;
  /** Runs inside the same transaction as the escrow-hold/booking-update, e.g. the wallet debit for a wallet-funded checkout. Absent for direct-MoMo checkout, where funds never touch the wallet. */
  debitPayerWallet?: (tx: Prisma.TransactionClient) => Promise<void>;
}

async function finalizeBookingPayment(params: FinalizeParams) {
  const { booking } = params;
  const { commissionRatePercent } = await paymentConfig.getAll();
  const totalAmountXaf = booking.agreedRateXaf!;

  const { updatedBooking, escrowHold } = await prisma.$transaction(async (tx) => {
    if (params.debitPayerWallet) await params.debitPayerWallet(tx);

    const escrowHold = await EscrowService.createEscrowHold(
      {
        bookingId: booking.id,
        payerId: booking.bookerId!,
        tutorId: booking.tutorProfile.userId,
        grossAmountXaf: totalAmountXaf,
        commissionRatePercent,
        momoFeeXaf: params.momoFeeXaf,
      },
      tx
    );

    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.PAID,
        commissionRatePercent,
        commissionAmountXaf: escrowHold.commissionAmountXaf,
        netTutorAmountXaf: escrowHold.netTutorAmountXaf,
        totalAmountXaf,
      },
    });

    await tx.transactionLedger.create({
      data: {
        fromUserId: booking.bookerId,
        toUserId: booking.tutorProfile.userId,
        operation: params.ledgerOperation,
        direction: PaymentDirection.USER_TO_PLATFORM,
        status: LedgerStatus.SUCCESS,
        amountXaf: totalAmountXaf,
        momoFeeXaf: params.momoFeeXaf || undefined,
        providerTransactionId: params.providerTransactionId,
        providerService: params.providerTransactionId ? "fapshi" : undefined,
        momoPhone: params.momoPhone,
        momoProvider: params.momoProvider,
        bookingId: booking.id,
        escrowHoldId: escrowHold.id,
        isPlatformReceiver: true,
      },
    });

    return { updatedBooking, escrowHold };
  });

  await cancelScheduledJobsForBooking(booking.id);

  await Promise.all([
    NotificationService.send({
      type: NotificationType.PAYMENT_CONFIRMED,
      target: { kind: "user", userId: booking.bookerId! },
      resourceType: NotificationResourceType.PAYMENT,
      resourceId: updatedBooking.id,
    }),
    NotificationService.send({
      type: NotificationType.PAYMENT_CONFIRMED,
      target: { kind: "user", userId: booking.tutorProfile.userId },
      resourceType: NotificationResourceType.PAYMENT,
      resourceId: updatedBooking.id,
    }),
  ]);

  if (booking.bookerId) {
    await ReceiptService.generateReceiptForBooking(booking.id, booking.bookerId).catch((err) =>
      console.error({ event: "receipt_generation_failed", bookingId: booking.id, error: err.message })
    );

    await MessagingService.upgradeToActiveForBooking(booking.id, booking.tutorProfile.userId, booking.bookerId).catch((err) =>
      console.error({ event: "conversation_upgrade_failed", bookingId: booking.id, error: err.message })
    );
  }

  return { booking: updatedBooking, escrowHold };
}

async function walletCheckout(userId: string, bookingId: string) {
  const booking = await loadPayableBooking(bookingId, userId);
  const wallet = await WalletService.getOrCreateWallet(userId, WalletType.PARENT);
  if (wallet.balanceXaf < booking.agreedRateXaf!) {
    throw new AppError("payment/errors:insufficientBalance", StatusCodes.BAD_REQUEST);
  }

  // Debit happens inside the same transaction as the escrow-hold/booking
  // update (see debitPayerWallet) so the two either both happen or neither does.
  const result = await finalizeBookingPayment({
    booking,
    momoFeeXaf: 0,
    ledgerOperation: LedgerOperation.BOOKING_PAYMENT,
    debitPayerWallet: async (tx) => {
      const fresh = await tx.wallet.findUnique({ where: { userId } });
      if (!fresh || fresh.balanceXaf < booking.agreedRateXaf!) {
        throw new AppError("payment/errors:insufficientBalance", StatusCodes.BAD_REQUEST);
      }
      await tx.wallet.update({ where: { userId }, data: { balanceXaf: { decrement: booking.agreedRateXaf! } } });
    },
  });

  return { status: "SUCCESSFUL" as const, ...result };
}

async function directMomoCheckout(userId: string, bookingId: string, phone: string) {
  const booking = await loadPayableBooking(bookingId, userId);
  const totalAmountXaf = booking.agreedRateXaf!;

  const initiated = await FapshiService.directPay({
    amount: totalAmountXaf,
    phone,
    userId,
    externalId: bookingId,
    message: "Mentora booking payment",
  });
  // Same polling-to-terminal-status wait wallet top-up uses — a single
  // immediate status check almost always still reads CREATED, since the
  // user hasn't had time to approve the MoMo/OM prompt on their phone yet,
  // which meant this path nearly always fell into the PENDING/reconciliation
  // branch below even when the payment ultimately succeeded seconds later.
  const status = await FapshiService.waitForFinalStatus(initiated.transId);

  if (status?.status === "FAILED" || status?.status === "EXPIRED") {
    throw new AppError("payment/errors:directPayFailed", StatusCodes.BAD_GATEWAY, { status: status.status });
  }

  if (status?.status !== "SUCCESSFUL") {
    // Still not terminal after the polling window — park it for the
    // reconciliation job rather than block the request indefinitely.
    const reconciliation = await prisma.paymentReconciliation.create({
      data: {
        userId,
        bookingId,
        providerTransactionId: initiated.transId,
        providerStatus: status?.status ?? "CREATED",
      },
    });
    await scheduleReconciliationCheck(reconciliation.id);
    return { status: "PENDING" as const, transId: initiated.transId, booking: undefined, escrowHold: undefined };
  }

  const result = await finalizeBookingPayment({
    booking,
    momoFeeXaf: 0,
    ledgerOperation: LedgerOperation.BOOKING_PAYMENT_MOMO,
    providerTransactionId: initiated.transId,
    momoPhone: phone,
    momoProvider: FapshiService.detectMedium(phone),
  });

  return { status: "SUCCESSFUL" as const, transId: initiated.transId, ...result };
}

/** Called by the reconciliation job once a delayed Fapshi status query confirms success. */
async function finalizeReconciledPayment(bookingId: string, userId: string, status: FapshiStatusResult) {
  const booking = await loadPayableBooking(bookingId, userId);
  return finalizeBookingPayment({
    booking,
    momoFeeXaf: 0,
    ledgerOperation: LedgerOperation.BOOKING_PAYMENT_MOMO,
    providerTransactionId: status.transId,
    momoProvider: status.medium,
  });
}

/** Admin oversight — the finance queue (failed/pending payouts, unresolved reconciliations). */
async function listAdminPayouts(status?: string) {
  return prisma.payoutQueue.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

async function listAdminReconciliations(resolved?: boolean) {
  return prisma.paymentReconciliation.findMany({
    where: resolved === undefined ? undefined : { resolved },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export const PaymentService = {
  walletCheckout,
  directMomoCheckout,
  finalizeBookingPayment,
  finalizeReconciledPayment,
  listAdminPayouts,
  listAdminReconciliations,
};

export default PaymentService;
