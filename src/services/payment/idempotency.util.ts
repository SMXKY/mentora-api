import prisma from "../../config/database.config";
import { paymentConfig } from "./paymentConfig";

/**
 * Wraps a side-effecting operation with client-generated idempotency-key
 * support (REQ-013: "client-generated idempotency key, 24h expiry").
 * If `key` is omitted the operation just runs normally — idempotency is
 * opt-in per request, not enforced globally.
 */
export async function withIdempotency<T>(
  userId: string,
  key: string | undefined,
  operation: string,
  fn: () => Promise<{ status: number; body: T }>
): Promise<{ status: number; body: T }> {
  if (!key) return fn();

  const existing = await prisma.idempotencyKey.findUnique({
    where: { userId_key: { userId, key } },
  });
  if (existing && existing.expiresAt > new Date()) {
    return { status: existing.responseStatus, body: existing.responseBody as T };
  }

  const result = await fn();

  const { idempotencyKeyExpiryHours } = await paymentConfig.getAll();
  const expiresAt = new Date(Date.now() + idempotencyKeyExpiryHours * 60 * 60 * 1000);

  await prisma.idempotencyKey.upsert({
    where: { userId_key: { userId, key } },
    create: {
      userId,
      key,
      operation,
      responseStatus: result.status,
      responseBody: result.body as any,
      expiresAt,
    },
    update: { responseStatus: result.status, responseBody: result.body as any, expiresAt },
  });

  return result;
}
