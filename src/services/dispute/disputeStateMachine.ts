import { DisputeStatus } from "../../generated/prisma";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

/** The only place a Dispute status transition is decided as legal or not. */
const ALLOWED_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  [DisputeStatus.OPEN]: [
    DisputeStatus.AWAITING_ADMIN,
    DisputeStatus.ESCALATED,
    // An admin can resolve directly even before the tutor responds or the
    // SLA nudges it into AWAITING_ADMIN — waiting on the tutor is never a
    // hard requirement for resolution.
    DisputeStatus.RESOLVED_TUTOR_FAVOR,
    DisputeStatus.RESOLVED_PARENT_FAVOR,
  ],
  [DisputeStatus.AWAITING_ADMIN]: [
    DisputeStatus.UNDER_REVIEW,
    DisputeStatus.RESOLVED_TUTOR_FAVOR,
    DisputeStatus.RESOLVED_PARENT_FAVOR,
    DisputeStatus.ESCALATED,
  ],
  [DisputeStatus.UNDER_REVIEW]: [
    DisputeStatus.RESOLVED_TUTOR_FAVOR,
    DisputeStatus.RESOLVED_PARENT_FAVOR,
    DisputeStatus.ESCALATED,
  ],
  [DisputeStatus.ESCALATED]: [DisputeStatus.RESOLVED_TUTOR_FAVOR, DisputeStatus.RESOLVED_PARENT_FAVOR],
  [DisputeStatus.RESOLVED_TUTOR_FAVOR]: [],
  [DisputeStatus.RESOLVED_PARENT_FAVOR]: [],
};

export function isValidTransition(from: DisputeStatus, to: DisputeStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: DisputeStatus, to: DisputeStatus): void {
  if (!isValidTransition(from, to)) {
    throw new AppError("dispute/errors:invalidStatusTransition", StatusCodes.CONFLICT, { from, to });
  }
}
