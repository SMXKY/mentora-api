import axios from "axios";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

// ============================================================
// Fapshi (Cameroon MoMo / Orange Money) gateway wrapper.
//
// Always talks to FAPSHI_SANDBOX_BASE_URL — the live URL/credentials are
// deliberately never wired up here ("everything must be fully sandbox for
// now, I will integrate real payments later").
//
// FAPSHI_IS_LIVE=false (default): no HTTP call leaves the process at all.
//   Outcome is decided in-process using Fapshi's own documented sandbox
//   test-number convention, so behaviour matches what the real sandbox
//   would do for those numbers.
// FAPSHI_IS_LIVE=true: real HTTP calls to the sandbox API (still fake
//   money, still sandbox-only) gated by a GET /balance health check —
//   "we handle it the same way but with a hard check to ensure the
//   payment service is functional".
// ============================================================

const BASE_URL = process.env.FAPSHI_SANDBOX_BASE_URL || "https://sandbox.fapshi.com";
const API_USER = process.env.FAPSHI_API_USER || "";
const API_KEY = process.env.FAPSHI_API_KEY || "";

function isLive(): boolean {
  return process.env.FAPSHI_IS_LIVE === "true";
}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { apiuser: API_USER, apikey: API_KEY, "Content-Type": "application/json" },
});

export type FapshiMedium = "mobile money" | "orange money";
export type FapshiTransStatus = "CREATED" | "SUCCESSFUL" | "FAILED" | "EXPIRED";

export interface FapshiDirectPayParams {
  amount: number;
  phone: string;
  medium?: FapshiMedium;
  name?: string;
  email?: string;
  userId?: string;
  externalId?: string;
  message?: string;
}

export interface FapshiDirectPayResult {
  message: string;
  transId: string;
  dateInitiated: string;
}

export interface FapshiStatusResult {
  transId: string;
  status: FapshiTransStatus;
  medium: FapshiMedium;
  amount: number;
  revenue?: number;
  payerName?: string | null;
  email?: string | null;
  externalId?: string | null;
  userId?: string | null;
  financialTransId?: string | null;
  dateInitiated: string;
  dateConfirmed?: string | null;
}

const AMOUNT_ERROR = "payment/errors:fapshi.invalidAmount";
const PHONE_ERROR = "payment/errors:fapshi.invalidPhone";
const TRANS_ID_ERROR = "payment/errors:fapshi.invalidTransId";
const UNAVAILABLE_ERROR = "payment/errors:fapshi.serviceUnavailable";
const NOT_FOUND_ERROR = "payment/errors:fapshi.transactionNotFound";
const UPSTREAM_ERROR = "payment/errors:fapshi.upstreamError";

const PHONE_REGEX = /^6[\d]{8}$/;
const TRANS_ID_REGEX = /^[a-zA-Z0-9]{8,10}$/;

function assertValidAmount(amount: number) {
  if (!Number.isInteger(amount) || amount < 100) {
    throw new AppError(AMOUNT_ERROR, StatusCodes.BAD_REQUEST, { amount });
  }
}

function assertValidPhone(phone: string) {
  if (!PHONE_REGEX.test(phone)) {
    throw new AppError(PHONE_ERROR, StatusCodes.BAD_REQUEST, { phone });
  }
}

// Fapshi's documented Cameroon MTN/Orange numbering plan.
function detectMedium(phone: string): FapshiMedium {
  const prefix3 = phone.slice(0, 3);
  const prefix2 = phone.slice(0, 2);
  if (prefix2 === "69" || ["655", "656", "657", "658", "659"].includes(prefix3)) {
    return "orange money";
  }
  return "mobile money";
}

// Fapshi's documented sandbox test numbers — deterministic outcomes.
// Numbers outside this list get a random (weighted-success) outcome, same
// as the real sandbox's documented behaviour for unlisted numbers.
const MOCK_SUCCESS_NUMBERS = new Set([
  "670000000",
  "670000002",
  "650000000",
  "690000000",
  "690000002",
  "656000000",
]);
const MOCK_FAILURE_NUMBERS = new Set([
  "670000001",
  "670000003",
  "650000001",
  "690000001",
  "690000003",
  "656000001",
]);

interface MockTransaction extends FapshiStatusResult {}

// In-memory only — mock mode is a pure sandbox simulation, never persisted
// across restarts. Callers (booking/payment services) persist their own
// ledger rows independently and don't rely on this surviving a restart.
const mockLedger = new Map<string, MockTransaction>();

function generateMockTransId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 9; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function decideMockOutcome(phone: string): FapshiTransStatus {
  if (MOCK_SUCCESS_NUMBERS.has(phone)) return "SUCCESSFUL";
  if (MOCK_FAILURE_NUMBERS.has(phone)) return "FAILED";
  return Math.random() < 0.8 ? "SUCCESSFUL" : "FAILED";
}

async function mockDirectPay(params: FapshiDirectPayParams): Promise<FapshiDirectPayResult> {
  const transId = generateMockTransId();
  const now = new Date().toISOString();
  const status = decideMockOutcome(params.phone);

  mockLedger.set(transId, {
    transId,
    status,
    medium: params.medium ?? detectMedium(params.phone),
    amount: params.amount,
    revenue: params.amount,
    payerName: params.name ?? null,
    email: params.email ?? null,
    externalId: params.externalId ?? null,
    userId: params.userId ?? null,
    financialTransId: status === "SUCCESSFUL" ? `MOCKFIN${transId}` : null,
    dateInitiated: now,
    dateConfirmed: status !== "CREATED" ? now : null,
  });

  console.log({
    event: "fapshi_mock_direct_pay",
    transId,
    amount: params.amount,
    phone: params.phone,
    status,
  });

  return { message: "Payment initiated", transId, dateInitiated: now };
}

async function mockPayout(params: FapshiDirectPayParams): Promise<FapshiDirectPayResult> {
  // Same simulated ledger/outcome mechanics as directPay — Fapshi's payout
  // endpoint has the identical request/response shape.
  return mockDirectPay(params);
}

function mockPaymentStatus(transId: string): FapshiStatusResult {
  const entry = mockLedger.get(transId);
  if (!entry) {
    throw new AppError(NOT_FOUND_ERROR, StatusCodes.NOT_FOUND, { transId });
  }
  return entry;
}

// ── Health check ────────────────────────────────────────────
// GET /balance — used as the "hard check" gate before any live-mode call.
async function healthCheck(): Promise<{ ok: boolean; balance?: number; error?: string }> {
  try {
    const { data } = await client.get("/balance");
    return { ok: true, balance: data?.balance };
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.message || err.message };
  }
}

async function assertServiceHealthy(): Promise<void> {
  const health = await healthCheck();
  if (!health.ok) {
    throw new AppError(UNAVAILABLE_ERROR, StatusCodes.SERVICE_UNAVAILABLE, {
      reason: health.error,
    });
  }
}

function buildRequestBody(params: FapshiDirectPayParams) {
  return {
    amount: params.amount,
    phone: params.phone,
    medium: params.medium ?? detectMedium(params.phone),
    name: params.name,
    email: params.email,
    userId: params.userId,
    externalId: params.externalId,
    message: params.message,
  };
}

// ── Public API ───────────────────────────────────────────────

async function directPay(params: FapshiDirectPayParams): Promise<FapshiDirectPayResult> {
  assertValidAmount(params.amount);
  assertValidPhone(params.phone);

  if (!isLive()) return mockDirectPay(params);

  await assertServiceHealthy();
  try {
    const { data } = await client.post("/direct-pay", buildRequestBody(params));
    return data;
  } catch (err: any) {
    throw new AppError(UPSTREAM_ERROR, StatusCodes.BAD_GATEWAY, {
      reason: err?.response?.data?.message || err.message,
    });
  }
}

async function payout(params: FapshiDirectPayParams): Promise<FapshiDirectPayResult> {
  assertValidAmount(params.amount);
  assertValidPhone(params.phone);

  if (!isLive()) return mockPayout(params);

  await assertServiceHealthy();
  try {
    const { data } = await client.post("/payout", buildRequestBody(params));
    return data;
  } catch (err: any) {
    throw new AppError(UPSTREAM_ERROR, StatusCodes.BAD_GATEWAY, {
      reason: err?.response?.data?.message || err.message,
    });
  }
}

async function paymentStatus(transId: string): Promise<FapshiStatusResult> {
  if (!TRANS_ID_REGEX.test(transId)) {
    throw new AppError(TRANS_ID_ERROR, StatusCodes.BAD_REQUEST, { transId });
  }

  if (!isLive()) return mockPaymentStatus(transId);

  try {
    const { data } = await client.get(`/payment-status/${transId}`);
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404) {
      throw new AppError(NOT_FOUND_ERROR, StatusCodes.NOT_FOUND, { transId });
    }
    throw new AppError(UPSTREAM_ERROR, StatusCodes.BAD_GATEWAY, {
      reason: err?.response?.data?.message || err.message,
    });
  }
}

export const FapshiService = {
  isLive,
  detectMedium,
  directPay,
  payout,
  paymentStatus,
  healthCheck,
};

export default FapshiService;
