import { Prisma, EscrowStatus, WalletType, LedgerOperation, LedgerStatus, PaymentDirection, NotificationType, NotificationResourceType } from "../../generated/prisma";
import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { computeCommission } from "./commission.util";
import { NotificationService } from "../notification/notification.service";

type Tx = Prisma.TransactionClient;

export interface CreateEscrowHoldParams {
  bookingId: string;
  payerId: string;
  tutorId: string;
  grossAmountXaf: number;
  commissionRatePercent: number;
  momoFeeXaf?: number;
  groupParticipantId?: string;
}

/** Called from checkout, inside the same transaction as the wallet debit / booking update. */
async function createEscrowHold(params: CreateEscrowHoldParams, tx: Tx) {
  const { commissionAmountXaf, netTutorAmountXaf } = computeCommission(
    params.grossAmountXaf,
    params.commissionRatePercent
  );

  return tx.escrowHold.create({
    data: {
      bookingId: params.bookingId,
      groupParticipantId: params.groupParticipantId,
      payerId: params.payerId,
      tutorId: params.tutorId,
      grossAmountXaf: params.grossAmountXaf,
      commissionRateSnapshot: params.commissionRatePercent,
      commissionAmountXaf,
      momoFeeXaf: params.momoFeeXaf ?? 0,
      netTutorAmountXaf,
      status: EscrowStatus.HELD,
    },
  });
}

async function assertHeld(escrowHoldId: string, tx: Tx | typeof prisma = prisma) {
  const hold = await tx.escrowHold.findUnique({ where: { id: escrowHoldId } });
  if (!hold) throw new AppError("payment/errors:escrowNotFound", StatusCodes.NOT_FOUND);
  if (hold.status !== EscrowStatus.HELD) {
    throw new AppError("payment/errors:escrowNotHeld", StatusCodes.CONFLICT, { status: hold.status });
  }
  return hold;
}

/** Credits the tutor's wallet with the net (post-commission) amount and closes out the hold. */
async function releaseEscrowToTutor(
  escrowHoldId: string,
  opts: { disputeId?: string; autoReleased?: boolean } = {}
) {
  return prisma.$transaction(async (tx) => {
    const hold = await assertHeld(escrowHoldId, tx);

    await tx.wallet.upsert({
      where: { userId: hold.tutorId },
      create: { userId: hold.tutorId, walletType: WalletType.TUTOR, balanceXaf: hold.netTutorAmountXaf, totalEarnedXaf: hold.netTutorAmountXaf },
      update: {
        balanceXaf: { increment: hold.netTutorAmountXaf },
        totalEarnedXaf: { increment: hold.netTutorAmountXaf },
      },
    });

    const updated = await tx.escrowHold.update({
      where: { id: escrowHoldId },
      data: {
        status: EscrowStatus.RELEASED,
        releasedAt: new Date(),
        releasedByDisputeId: opts.disputeId,
        autoReleased: opts.autoReleased ?? false,
      },
    });

    await tx.transactionLedger.create({
      data: {
        toUserId: hold.tutorId,
        operation: LedgerOperation.ESCROW_RELEASE,
        direction: PaymentDirection.PLATFORM_TO_USER,
        status: LedgerStatus.SUCCESS,
        amountXaf: hold.netTutorAmountXaf,
        bookingId: hold.bookingId,
        escrowHoldId: hold.id,
        isPlatformSender: true,
      },
    });

    // Platform keeps the commission — track it in the single commission
    // ledger row (seeded at startup, see seeds/platformCommission.seed.ts,
    // so this is always an update against an existing singleton).
    const commissionRow = await tx.platformCommission.findFirst();
    if (commissionRow) {
      await tx.platformCommission.update({
        where: { id: commissionRow.id },
        data: { balanceXaf: { increment: hold.commissionAmountXaf } },
      });
    } else {
      await tx.platformCommission.create({ data: { balanceXaf: hold.commissionAmountXaf } });
    }

    return updated;
  }).then(async (updated) => {
    const hold = await prisma.escrowHold.findUnique({ where: { id: escrowHoldId } });
    if (hold) {
      await NotificationService.send({
        type: NotificationType.ESCROW_RELEASED,
        target: { kind: "user", userId: hold.tutorId },
        resourceType: NotificationResourceType.PAYMENT,
        resourceId: hold.id,
      });
    }
    return updated;
  });
}

/** Full refund of the gross amount to the payer's wallet — used for parent cancellations ≥ threshold and parent-favor dispute resolutions. */
async function refundEscrowToPayer(escrowHoldId: string) {
  const updated = await prisma.$transaction(async (tx) => {
    const hold = await assertHeld(escrowHoldId, tx);

    await tx.wallet.upsert({
      where: { userId: hold.payerId },
      create: { userId: hold.payerId, walletType: WalletType.PARENT, balanceXaf: hold.grossAmountXaf },
      update: { balanceXaf: { increment: hold.grossAmountXaf } },
    });

    const result = await tx.escrowHold.update({
      where: { id: escrowHoldId },
      data: { status: EscrowStatus.REFUNDED, refundedAt: new Date() },
    });

    await tx.transactionLedger.create({
      data: {
        toUserId: hold.payerId,
        operation: LedgerOperation.ESCROW_REFUND,
        direction: PaymentDirection.PLATFORM_TO_USER,
        status: LedgerStatus.SUCCESS,
        amountXaf: hold.grossAmountXaf,
        bookingId: hold.bookingId,
        escrowHoldId: hold.id,
        isPlatformSender: true,
      },
    });

    return result;
  });

  await NotificationService.send({
    type: NotificationType.REFUND_ISSUED,
    target: { kind: "user", userId: updated.payerId },
    resourceType: NotificationResourceType.PAYMENT,
    resourceId: updated.id,
  });

  return updated;
}

/**
 * Releases the tutor's share while withholding a full refund isn't
 * warranted — used for the < threshold parent-cancellation policy, where
 * the tutor keeps the funds as if the session had happened.
 */
async function releaseEscrowAsForfeited(escrowHoldId: string) {
  return releaseEscrowToTutor(escrowHoldId, {});
}

async function freezeEscrowForBooking(bookingId: string) {
  await prisma.escrowHold.updateMany({
    where: { bookingId, status: EscrowStatus.HELD },
    data: { status: EscrowStatus.FROZEN, frozenAt: new Date() },
  });
}

/** Un-freezes back to HELD — used when a dispute resolves and the normal release/refund path takes over. */
async function unfreezeEscrowForBooking(bookingId: string) {
  await prisma.escrowHold.updateMany({
    where: { bookingId, status: EscrowStatus.FROZEN },
    data: { status: EscrowStatus.HELD, frozenAt: null },
  });
}

export const EscrowService = {
  createEscrowHold,
  releaseEscrowToTutor,
  refundEscrowToPayer,
  releaseEscrowAsForfeited,
  freezeEscrowForBooking,
  unfreezeEscrowForBooking,
};

export default EscrowService;
