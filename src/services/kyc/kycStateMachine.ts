import { KycStatus } from "../../generated/prisma";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

/**
 * The only place a KYC status transition is decided as legal or not.
 * No endpoint may set KycStatus directly — every write goes through
 * `assertValidTransition` first. BANNED is terminal: nothing leaves it.
 */
const ALLOWED_TRANSITIONS: Record<KycStatus, KycStatus[]> = {
  [KycStatus.INCOMPLETE]: [KycStatus.PENDING, KycStatus.BANNED],
  [KycStatus.PENDING]: [
    KycStatus.IDENTITY_APPROVED,
    KycStatus.REJECTED,
    KycStatus.BANNED,
  ],
  [KycStatus.IDENTITY_APPROVED]: [
    KycStatus.ACTIVE,
    KycStatus.REJECTED,
    KycStatus.BANNED,
  ],
  [KycStatus.ACTIVE]: [
    KycStatus.SUSPENDED,
    KycStatus.BANNED,
    KycStatus.PENDING_REVERIFICATION,
  ],
  [KycStatus.SUSPENDED]: [KycStatus.ACTIVE, KycStatus.BANNED],
  [KycStatus.REJECTED]: [KycStatus.PENDING, KycStatus.BANNED],
  [KycStatus.PENDING_REVERIFICATION]: [
    KycStatus.ACTIVE,
    KycStatus.REJECTED,
    KycStatus.BANNED,
  ],
  [KycStatus.BANNED]: [],
};

export function isValidTransition(
  from: KycStatus,
  to: KycStatus
): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: KycStatus, to: KycStatus): void {
  if (!isValidTransition(from, to)) {
    throw new AppError("kyc/errors:invalidStatusTransition", StatusCodes.CONFLICT, {
      from,
      to,
    });
  }
}
