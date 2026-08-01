import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { PaymentAccountType, NotificationType, NotificationResourceType } from "../../generated/prisma";
import { NotificationService } from "../notification/notification.service";
import { paymentConfig } from "./paymentConfig";

async function listMyAccounts(userId: string) {
  return prisma.paymentAccount.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });
}

async function addAccount(
  userId: string,
  input: { phoneNumber: string; accountType: PaymentAccountType; isPrimary?: boolean }
) {
  const { payoutCoolingOffHours } = await paymentConfig.getAll();
  const coolingOffUntil = new Date(Date.now() + payoutCoolingOffHours * 60 * 60 * 1000);

  const account = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.paymentAccount.updateMany({
        where: { userId, deletedAt: null },
        data: { isPrimary: false },
      });
    }
    return tx.paymentAccount.create({
      data: {
        userId,
        phoneNumber: input.phoneNumber,
        accountType: input.accountType,
        isPrimary: input.isPrimary ?? false,
        coolingOffUntil,
      },
    });
  });

  await NotificationService.send({
    type: NotificationType.PAYOUT_ACCOUNT_ADDED,
    target: { kind: "user", userId },
    resourceType: NotificationResourceType.PAYMENT,
    resourceId: account.id,
  });

  return account;
}

async function removeAccount(userId: string, accountId: string) {
  const account = await prisma.paymentAccount.findFirst({
    where: { id: accountId, userId, deletedAt: null },
  });
  if (!account) {
    throw new AppError("payment/errors:payoutAccountNotFound", StatusCodes.NOT_FOUND);
  }
  await prisma.paymentAccount.update({ where: { id: accountId }, data: { deletedAt: new Date() } });
}

export const PayoutAccountService = { listMyAccounts, addAccount, removeAccount };
export default PayoutAccountService;
