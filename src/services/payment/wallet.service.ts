import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  WalletType,
  LedgerOperation,
  LedgerStatus,
  PaymentDirection,
  PayoutQueueStatus,
  NotificationType,
  NotificationResourceType,
  TicketCategory,
  TicketCreationSource,
} from "../../generated/prisma";
import { NotificationService } from "../notification/notification.service";
import { FapshiService } from "./fapshi.service";
import { paymentConfig, WALLET_MIN_TOPUP_FLOOR_XAF } from "./paymentConfig";
import { computeMomoWithdrawalFee } from "./commission.util";

async function getOrCreateWallet(userId: string, walletType: WalletType) {
  const existing = await prisma.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.wallet.create({ data: { userId, walletType, balanceXaf: 0 } });
}

async function getMyWallet(userId: string, walletType: WalletType) {
  return getOrCreateWallet(userId, walletType);
}

async function topup(userId: string, walletType: WalletType, amountXaf: number, phone: string) {
  const { walletMinTopupXaf } = await paymentConfig.getAll();
  if (amountXaf < walletMinTopupXaf) {
    throw new AppError("payment/errors:topupBelowMinimum", StatusCodes.BAD_REQUEST, {
      minimum: walletMinTopupXaf,
    });
  }

  const result = await FapshiService.directPay({
    amount: amountXaf,
    phone,
    userId,
    externalId: `topup-${userId}-${Date.now()}`,
    message: "Mentora wallet top-up",
  });
  const status = await FapshiService.paymentStatus(result.transId);

  if (status.status !== "SUCCESSFUL") {
    throw new AppError("payment/errors:topupFailed", StatusCodes.BAD_GATEWAY, {
      status: status.status,
    });
  }

  const wallet = await prisma.$transaction(async (tx) => {
    await getOrCreateWallet(userId, walletType);
    const updated = await tx.wallet.update({
      where: { userId },
      data: { balanceXaf: { increment: amountXaf } },
    });
    await tx.transactionLedger.create({
      data: {
        toUserId: userId,
        operation: LedgerOperation.WALLET_TOPUP,
        direction: PaymentDirection.USER_TO_PLATFORM,
        status: LedgerStatus.SUCCESS,
        amountXaf,
        providerTransactionId: result.transId,
        providerService: "fapshi",
        momoPhone: phone,
        momoProvider: FapshiService.detectMedium(phone),
        isPlatformReceiver: true,
      },
    });
    return updated;
  });

  await NotificationService.send({
    type: NotificationType.WALLET_TOPPED_UP,
    target: { kind: "user", userId },
    resourceType: NotificationResourceType.PAYMENT,
    resourceId: wallet.id,
  });

  return wallet;
}

async function assertWithdrawableAccount(userId: string, paymentAccountId: string) {
  const account = await prisma.paymentAccount.findFirst({
    where: { id: paymentAccountId, userId, deletedAt: null },
  });
  if (!account) {
    throw new AppError("payment/errors:payoutAccountNotFound", StatusCodes.NOT_FOUND);
  }
  if (account.coolingOffUntil && account.coolingOffUntil > new Date()) {
    throw new AppError("payment/errors:payoutAccountCoolingOff", StatusCodes.FORBIDDEN, {
      coolingOffUntil: account.coolingOffUntil,
    });
  }
  return account;
}

interface WithdrawResult {
  status: "COMPLETED" | "FAILED";
  netAmountXaf: number;
  momoFeeXaf: number;
  payoutQueueId: string;
}

async function withdraw(userId: string, amountXaf: number, paymentAccountId: string): Promise<WithdrawResult> {
  const account = await assertWithdrawableAccount(userId, paymentAccountId);

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.balanceXaf < amountXaf) {
    throw new AppError("payment/errors:insufficientBalance", StatusCodes.BAD_REQUEST);
  }

  const { momoWithdrawalFeePercent } = await paymentConfig.getAll();
  const momoFeeXaf = computeMomoWithdrawalFee(amountXaf, momoWithdrawalFeePercent);
  const netAmountXaf = amountXaf - momoFeeXaf;

  const payoutQueue = await prisma.$transaction(async (tx) => {
    await tx.wallet.update({ where: { userId }, data: { balanceXaf: { decrement: amountXaf } } });
    return tx.payoutQueue.create({
      data: {
        userId,
        paymentAccountId,
        grossAmountXaf: amountXaf,
        momoFeeXaf,
        netAmountXaf,
        status: PayoutQueueStatus.PROCESSING,
        attemptCount: 1,
        lastAttemptedAt: new Date(),
      },
    });
  });

  try {
    const payoutResult = await FapshiService.payout({
      amount: netAmountXaf,
      phone: account.phoneNumber,
      userId,
      externalId: payoutQueue.id,
      message: "Mentora wallet withdrawal",
    });
    const status = await FapshiService.paymentStatus(payoutResult.transId);

    if (status.status !== "SUCCESSFUL") {
      return handleFailedPayout(payoutQueue.id, userId, account, amountXaf, `Provider status: ${status.status}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.payoutQueue.update({
        where: { id: payoutQueue.id },
        data: {
          status: PayoutQueueStatus.COMPLETED,
          providerTransactionId: payoutResult.transId,
          completedAt: new Date(),
        },
      });
      await tx.transactionLedger.create({
        data: {
          fromUserId: userId,
          operation: LedgerOperation.WALLET_WITHDRAWAL,
          direction: PaymentDirection.PLATFORM_TO_USER,
          status: LedgerStatus.SUCCESS,
          amountXaf: netAmountXaf,
          momoFeeXaf,
          providerTransactionId: payoutResult.transId,
          providerService: "fapshi",
          momoPhone: account.phoneNumber,
          payoutQueueId: payoutQueue.id,
          isPlatformSender: true,
        },
      });
    });

    await NotificationService.send({
      type: NotificationType.WALLET_WITHDRAWAL_INITIATED,
      target: { kind: "user", userId },
      resourceType: NotificationResourceType.PAYMENT,
      resourceId: payoutQueue.id,
    });

    return { status: "COMPLETED", netAmountXaf, momoFeeXaf, payoutQueueId: payoutQueue.id };
  } catch (err: any) {
    return handleFailedPayout(payoutQueue.id, userId, account, amountXaf, err.message);
  }
}

/** Failed payout: funds are retained (already debited into the queue, not lost), tutor notified, support ticket opened. */
async function handleFailedPayout(
  payoutQueueId: string,
  userId: string,
  account: { phoneNumber: string; accountType: string },
  grossAmountXaf: number,
  failureReason: string
): Promise<WithdrawResult> {
  const registeredAccounts = await prisma.paymentAccount.findMany({ where: { userId, deletedAt: null } });

  const { payoutQueue, ticket } = await prisma.$transaction(async (tx) => {
    // Refund the debited amount back to the wallet — it never left the platform.
    await tx.wallet.update({ where: { userId }, data: { balanceXaf: { increment: grossAmountXaf } } });

    const payoutQueue = await tx.payoutQueue.update({
      where: { id: payoutQueueId },
      data: { status: PayoutQueueStatus.FAILED, failedAt: new Date(), failureReason },
    });

    const ticket = await tx.supportTicket.create({
      data: {
        submittedById: userId,
        category: TicketCategory.WITHDRAWAL_FAILED,
        subject: "Wallet withdrawal failed",
        creationSource: TicketCreationSource.SYSTEM_FAILED_PAYOUT,
        payoutQueueId: payoutQueue.id,
      },
    });

    await tx.failedPayoutContext.create({
      data: {
        ticketId: ticket.id,
        payoutQueueId: payoutQueue.id,
        withdrawalAmountXaf: payoutQueue.netAmountXaf,
        destinationPhone: account.phoneNumber,
        destinationProvider: account.accountType,
        providerFailureReason: failureReason,
        registeredAccountsSnapshot: registeredAccounts as any,
      },
    });

    return { payoutQueue, ticket };
  });

  await NotificationService.send({
    type: NotificationType.WITHDRAWAL_FAILED,
    target: { kind: "user", userId },
    resourceType: NotificationResourceType.PAYMENT,
    resourceId: payoutQueue.id,
  });

  void ticket;
  return {
    status: "FAILED",
    netAmountXaf: payoutQueue.netAmountXaf,
    momoFeeXaf: payoutQueue.momoFeeXaf,
    payoutQueueId: payoutQueue.id,
  };
}

export const WalletService = {
  getOrCreateWallet,
  getMyWallet,
  topup,
  withdraw,
  WALLET_MIN_TOPUP_FLOOR_XAF,
};

export default WalletService;
