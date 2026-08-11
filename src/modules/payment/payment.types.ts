import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { LedgerOperation } from "../../generated/prisma";

extendZodWithOpenApi(z);

// ============================================================
// Module 13 — Payments & Escrow — zod schemas & types
// ============================================================

const PhoneSchema = z.string().regex(/^6[\d]{8}$/, "Expected a Cameroon mobile number, e.g. 670000000");

export const TopupSchema = z
  .object({
    amountXaf: z.number().int().min(1),
    phone: PhoneSchema,
  })
  .openapi("WalletTopup");
export type TopupInput = z.infer<typeof TopupSchema>;

export const WithdrawSchema = z
  .object({
    amountXaf: z.number().int().min(1),
    paymentAccountId: z.string().uuid(),
  })
  .openapi("WalletWithdraw");
export type WithdrawInput = z.infer<typeof WithdrawSchema>;

export const PaymentAccountTypeEnum = z.enum(["MTN_MOMO", "ORANGE_MONEY"]);

export const AddPayoutAccountSchema = z
  .object({
    phoneNumber: PhoneSchema,
    accountType: PaymentAccountTypeEnum,
    isPrimary: z.boolean().optional(),
  })
  .openapi("AddPayoutAccount");
export type AddPayoutAccountInput = z.infer<typeof AddPayoutAccountSchema>;

export const DirectMomoCheckoutSchema = z
  .object({
    phone: PhoneSchema,
  })
  .openapi("DirectMomoCheckout");
export type DirectMomoCheckoutInput = z.infer<typeof DirectMomoCheckoutSchema>;

export const CommissionWithdrawSchema = z
  .object({
    amountXaf: z.number().int().min(1),
    phone: PhoneSchema,
  })
  .openapi("CommissionWithdraw");
export type CommissionWithdrawInput = z.infer<typeof CommissionWithdrawSchema>;

// ── Transaction history (wallet dashboard) ──────────────────
export const ListTransactionsQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    // 10 at a time, matching the wallet dashboard's infinite-scroll spec —
    // deliberately a smaller default than ListBookingsQuerySchema's 20.
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    operation: z.nativeEnum(LedgerOperation).optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
    subjectId: z.string().uuid().optional(),
    tutorProfileId: z.string().uuid().optional(),
    search: z.string().min(1).max(100).optional(),
    sortBy: z.enum(["date", "amount"]).optional().default("date"),
    sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .openapi("ListTransactionsQuery");
export type ListTransactionsQueryInput = z.infer<typeof ListTransactionsQuerySchema>;

export const TransactionSummaryQuerySchema = z
  .object({
    months: z.coerce.number().int().min(1).max(24).optional().default(6),
  })
  .openapi("TransactionSummaryQuery");
export type TransactionSummaryQueryInput = z.infer<typeof TransactionSummaryQuerySchema>;
