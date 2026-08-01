/** Pure commission-split math — kept dependency-free so it's directly unit-testable. */
export interface CommissionSplit {
  commissionAmountXaf: number;
  netTutorAmountXaf: number;
}

export function computeCommission(grossAmountXaf: number, commissionRatePercent: number): CommissionSplit {
  const commissionAmountXaf = Math.round((grossAmountXaf * commissionRatePercent) / 100);
  const netTutorAmountXaf = grossAmountXaf - commissionAmountXaf;
  return { commissionAmountXaf, netTutorAmountXaf };
}

export function computeMomoWithdrawalFee(amountXaf: number, feePercent: number): number {
  return Math.round((amountXaf * feePercent) / 100);
}
