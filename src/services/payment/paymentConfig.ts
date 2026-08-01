import { ConfigCategory } from "../../generated/prisma";
import { createConfigGroup } from "../config/configGroup.util";

const ENV_MIN_TOPUP = Number(process.env.WALLET_MIN_TOPUP) || 500;

export const paymentConfig = createConfigGroup({
  commissionRatePercent: {
    key: "payment.commission_rate_percent",
    category: ConfigCategory.PAYMENT,
    description: "Platform commission percentage taken from each booking payment at payment time",
    default: 15,
  },
  momoWithdrawalFeePercent: {
    key: "payment.momo_withdrawal_fee_percent",
    category: ConfigCategory.PAYMENT,
    description: "Fee percentage shown to a tutor before confirming a MoMo/Orange Money wallet withdrawal",
    default: 1.5,
  },
  walletMinTopupXaf: {
    key: "payment.wallet_min_topup_xaf",
    category: ConfigCategory.PAYMENT,
    description:
      "Minimum wallet top-up amount in XAF — floored by the WALLET_MIN_TOPUP env var; admins may raise it but never lower it below that floor",
    default: ENV_MIN_TOPUP,
  },
  payoutCoolingOffHours: {
    key: "payment.payout_cooling_off_hours",
    category: ConfigCategory.PAYMENT,
    description: "Hours a newly added/changed payout account must wait before it can receive a payout",
    default: 48,
  },
  monthlyFeeAmountXaf: {
    key: "payment.monthly_fee_amount_xaf",
    category: ConfigCategory.PAYMENT,
    description: "Flat monthly platform fee charged to active tutors, in XAF",
    default: 5000,
  },
  monthlyFeeGracePeriodDays: {
    key: "payment.monthly_fee_grace_period_days",
    category: ConfigCategory.PAYMENT,
    description: "Grace period in days after a failed monthly fee charge before the tutor is hidden from search",
    default: 7,
  },
  idempotencyKeyExpiryHours: {
    key: "payment.idempotency_key_expiry_hours",
    category: ConfigCategory.PAYMENT,
    description: "Hours a client-generated payment idempotency key remains valid",
    default: 24,
  },
  reconciliationDelayMinutes: {
    key: "payment.reconciliation_delay_minutes",
    category: ConfigCategory.PAYMENT,
    description: "Minutes to wait after a suspected dropped payment before querying Fapshi directly for its status",
    default: 10,
  },
});

export const WALLET_MIN_TOPUP_FLOOR_XAF = ENV_MIN_TOPUP;

export type PaymentConfig = Awaited<ReturnType<typeof paymentConfig.getAll>>;
