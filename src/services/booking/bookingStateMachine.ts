import { BookingStatus } from "../../generated/prisma";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

/**
 * The only place a Booking status transition is decided as legal or not.
 * No code may set BookingStatus directly — every write goes through
 * `assertValidTransition` first. Reschedule does NOT change status (it
 * only moves sessionDate/sessionStartTime/sessionEndTime via a separate
 * RescheduleRequest row), so it isn't represented here.
 */
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.REQUESTED]: [
    BookingStatus.ACCEPTED,
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED_UNPAID,
  ],
  [BookingStatus.ACCEPTED]: [
    BookingStatus.PAID,
    BookingStatus.CANCELLED_UNPAID,
    BookingStatus.CANCELLED_BY_PARENT,
  ],
  [BookingStatus.PAID]: [
    BookingStatus.IN_PROGRESS,
    BookingStatus.CANCELLED_BY_TUTOR,
    BookingStatus.CANCELLED_BY_PARENT,
  ],
  [BookingStatus.IN_PROGRESS]: [BookingStatus.AWAITING_CONFIRMATION],
  [BookingStatus.AWAITING_CONFIRMATION]: [
    BookingStatus.CONFIRMED,
    BookingStatus.AUTO_CONFIRMED,
    BookingStatus.DISPUTED,
  ],
  [BookingStatus.DISPUTED]: [
    BookingStatus.RESOLVED_TUTOR_FAVOR,
    BookingStatus.RESOLVED_PARENT_FAVOR,
  ],
  [BookingStatus.REJECTED]: [],
  [BookingStatus.CANCELLED_UNPAID]: [],
  [BookingStatus.CANCELLED_BY_TUTOR]: [],
  [BookingStatus.CANCELLED_BY_PARENT]: [],
  [BookingStatus.CONFIRMED]: [],
  [BookingStatus.AUTO_CONFIRMED]: [],
  [BookingStatus.RESOLVED_TUTOR_FAVOR]: [],
  [BookingStatus.RESOLVED_PARENT_FAVOR]: [],
};

// Statuses in which a booking still occupies the tutor's calendar /
// counts as "active" for conflict checks and dashboards.
export const OCCUPYING_STATUSES: BookingStatus[] = [
  BookingStatus.REQUESTED,
  BookingStatus.ACCEPTED,
  BookingStatus.PAID,
  BookingStatus.IN_PROGRESS,
  BookingStatus.AWAITING_CONFIRMATION,
  BookingStatus.CONFIRMED,
  BookingStatus.AUTO_CONFIRMED,
  BookingStatus.DISPUTED,
  BookingStatus.RESOLVED_TUTOR_FAVOR,
  BookingStatus.RESOLVED_PARENT_FAVOR,
];

export const TERMINAL_STATUSES: BookingStatus[] = [
  BookingStatus.REJECTED,
  BookingStatus.CANCELLED_UNPAID,
  BookingStatus.CANCELLED_BY_TUTOR,
  BookingStatus.CANCELLED_BY_PARENT,
  BookingStatus.CONFIRMED,
  BookingStatus.AUTO_CONFIRMED,
  BookingStatus.RESOLVED_TUTOR_FAVOR,
  BookingStatus.RESOLVED_PARENT_FAVOR,
];

export function isValidTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return false;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertValidTransition(from: BookingStatus, to: BookingStatus): void {
  if (!isValidTransition(from, to)) {
    throw new AppError("booking/errors:invalidStatusTransition", StatusCodes.CONFLICT, {
      from,
      to,
    });
  }
}
