import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { LedgerOperation, LedgerStatus, PaymentDirection } from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import { AuditService } from "../../utils/logUserActivity.util";
import { FapshiService } from "./fapshi.service";

async function getBalance() {
  const row = await prisma.platformCommission.findFirst();
  return { balanceXaf: row?.balanceXaf ?? 0 };
}

/** Super Admin withdraws accumulated platform commission out to a MoMo/Orange number. */
async function withdraw(amountXaf: number, phone: string, ctx: ServiceContext) {
  const commission = await prisma.platformCommission.findFirst();
  if (!commission || commission.balanceXaf < amountXaf) {
    throw new AppError("payment/errors:insufficientCommissionBalance", StatusCodes.BAD_REQUEST);
  }

  const payoutResult = await FapshiService.payout({
    amount: amountXaf,
    phone,
    externalId: `commission-withdrawal-${Date.now()}`,
    message: "Mentora platform commission withdrawal",
  });
  const status = await FapshiService.paymentStatus(payoutResult.transId);
  if (status.status !== "SUCCESSFUL") {
    throw new AppError("payment/errors:directPayFailed", StatusCodes.BAD_GATEWAY, { status: status.status });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.platformCommission.update({
      where: { id: commission.id },
      data: { balanceXaf: { decrement: amountXaf } },
    });
    await tx.transactionLedger.create({
      data: {
        operation: LedgerOperation.PLATFORM_WITHDRAWAL,
        direction: PaymentDirection.PLATFORM_TO_USER,
        status: LedgerStatus.SUCCESS,
        amountXaf,
        providerTransactionId: payoutResult.transId,
        providerService: "fapshi",
        momoPhone: phone,
        momoProvider: FapshiService.detectMedium(phone),
        isPlatformSender: true,
        performedById: ctx.userId,
      },
    });
    return result;
  });

  AuditService.record(ctx, "platform_commission", {
    operation: "TRANSFER" as any,
    category: "WRITE" as any,
    recordId: updated.id,
    newState: { balanceXaf: updated.balanceXaf, withdrawnXaf: amountXaf },
    eventType: "platform_commission_withdrawn",
  });

  return { balanceXaf: updated.balanceXaf, transId: payoutResult.transId };
}

export const PlatformCommissionService = { getBalance, withdraw };
export default PlatformCommissionService;
