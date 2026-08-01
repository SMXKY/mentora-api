import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

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
