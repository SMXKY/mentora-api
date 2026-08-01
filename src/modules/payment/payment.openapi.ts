import { registry } from "../../docs/openapi.registry";
import {
  TopupSchema,
  WithdrawSchema,
  AddPayoutAccountSchema,
  DirectMomoCheckoutSchema,
  CommissionWithdrawSchema,
} from "./payment.types";

const tags = ["Payments"];
const adminTags = ["Payments — Admin"];
const basePath = "/api/v1/payments";
const adminBasePath = "/api/v1/admin/payments";
const bearer = { security: [{ bearerAuth: [] }] };
const idempotencyNote =
  " Accepts an `Idempotency-Key` header — replaying the same key within 24h returns the original response instead of re-processing.";

registry.registerPath({
  method: "get",
  path: `${basePath}/wallet`,
  tags,
  summary: "Get my wallet",
  ...bearer,
  responses: { 200: { description: "{ wallet: Wallet }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/wallet/topup`,
  tags,
  summary: "Top up my wallet via direct MoMo/Orange Money",
  description: "Enforces the admin-configurable minimum (floored by WALLET_MIN_TOPUP)." + idempotencyNote,
  ...bearer,
  request: { body: { content: { "application/json": { schema: TopupSchema } } } },
  responses: { 200: { description: "{ wallet: Wallet }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/wallet/withdraw`,
  tags,
  summary: "Withdraw from my wallet to a registered payout account",
  description: "Deducts the configured MoMo fee before payout; on provider failure the funds are retained and a support ticket is opened." + idempotencyNote,
  ...bearer,
  request: { body: { content: { "application/json": { schema: WithdrawSchema } } } },
  responses: { 200: { description: "{ result: { status, netAmountXaf, momoFeeXaf, payoutQueueId } }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/payout-accounts`,
  tags,
  summary: "List my registered payout accounts",
  ...bearer,
  responses: { 200: { description: "{ accounts: PaymentAccount[] }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/payout-accounts`,
  tags,
  summary: "Add a payout account",
  description: "New accounts enter a 48h (configurable) cooling-off period before they can receive a payout.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: AddPayoutAccountSchema } } } },
  responses: { 201: { description: "{ account: PaymentAccount }" } },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/payout-accounts/{id}`,
  tags,
  summary: "Remove a payout account",
  ...bearer,
  responses: { 204: { description: "Deleted" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/bookings/{bookingId}/checkout/wallet`,
  tags,
  summary: "Pay for a booking from wallet balance",
  description: "Debits the wallet and creates the escrow hold atomically." + idempotencyNote,
  ...bearer,
  responses: { 200: { description: "{ status: 'SUCCESSFUL', booking, escrowHold }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/bookings/{bookingId}/checkout/direct-momo`,
  tags,
  summary: "Pay for a booking via direct MoMo/Orange Money",
  description:
    "Direct pay, not a payment link. If Fapshi confirms synchronously the escrow hold is created immediately; otherwise the payment is parked for the reconciliation job and PENDING is returned." + idempotencyNote,
  ...bearer,
  request: { body: { content: { "application/json": { schema: DirectMomoCheckoutSchema } } } },
  responses: { 200: { description: "{ status: 'SUCCESSFUL' | 'PENDING', transId, booking?, escrowHold? }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/receipts`,
  tags,
  summary: "List my payment receipts",
  ...bearer,
  responses: { 200: { description: "{ receipts: Receipt[] }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/receipts/{referenceNumber}`,
  tags,
  summary: "Look up one of my receipts by reference number",
  ...bearer,
  responses: { 200: { description: "{ receipt: Receipt }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/monthly-fee/{chargeId}/pay`,
  tags,
  summary: "Pay an overdue monthly platform fee",
  description: "Clears the search-visibility block (isPaymentOverdue) once paid.",
  ...bearer,
  responses: { 200: { description: "{ paid: true }" } },
});

// ── Admin — Super Admin platform commission ─────────────────
registry.registerPath({
  method: "get",
  path: `${adminBasePath}/commission`,
  tags: adminTags,
  summary: "Get the platform commission balance",
  ...bearer,
  responses: { 200: { description: "{ balanceXaf: number }" } },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/commission/withdraw`,
  tags: adminTags,
  summary: "Withdraw accumulated platform commission",
  ...bearer,
  request: { body: { content: { "application/json": { schema: CommissionWithdrawSchema } } } },
  responses: { 200: { description: "{ balanceXaf, transId }" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/receipts/{referenceNumber}`,
  tags: adminTags,
  summary: "Admin lookup of any receipt by reference number",
  ...bearer,
  responses: { 200: { description: "{ receipt: Receipt }" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/payouts`,
  tags: adminTags,
  summary: "List the payout queue (finance oversight)",
  description: "Requires the payments:payouts-read permission. Optionally filter by status via ?status=.",
  ...bearer,
  responses: { 200: { description: "{ payouts: PayoutQueue[] }" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/reconciliations`,
  tags: adminTags,
  summary: "List payment reconciliations (finance oversight)",
  description: "Requires the payments:reconciliation-read permission. Optionally filter with ?resolved=true|false.",
  ...bearer,
  responses: { 200: { description: "{ reconciliations: PaymentReconciliation[] }" } },
});
