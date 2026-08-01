import { computeCommission, computeMomoWithdrawalFee } from "./commission.util";

describe("computeCommission", () => {
  it("splits a gross amount at the default 15% rate", () => {
    expect(computeCommission(5000, 15)).toEqual({
      commissionAmountXaf: 750,
      netTutorAmountXaf: 4250,
    });
  });

  it("rounds the commission to the nearest whole XAF", () => {
    // 999 * 15% = 149.85 -> rounds to 150
    expect(computeCommission(999, 15)).toEqual({
      commissionAmountXaf: 150,
      netTutorAmountXaf: 849,
    });
  });

  it("returns zero commission at a 0% rate", () => {
    expect(computeCommission(10000, 0)).toEqual({
      commissionAmountXaf: 0,
      netTutorAmountXaf: 10000,
    });
  });

  it("always sums back to the gross amount", () => {
    for (const [gross, rate] of [[5000, 15], [12345, 22], [100, 1]] as const) {
      const { commissionAmountXaf, netTutorAmountXaf } = computeCommission(gross, rate);
      expect(commissionAmountXaf + netTutorAmountXaf).toBe(gross);
    }
  });
});

describe("computeMomoWithdrawalFee", () => {
  it("computes a percentage-based fee", () => {
    expect(computeMomoWithdrawalFee(10000, 1.5)).toBe(150);
  });
});
