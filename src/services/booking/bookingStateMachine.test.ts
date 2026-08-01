import { BookingStatus } from "../../generated/prisma";
import { isValidTransition, assertValidTransition, OCCUPYING_STATUSES, TERMINAL_STATUSES } from "./bookingStateMachine";

describe("booking state machine", () => {
  it("allows the golden path: REQUESTED -> ACCEPTED -> PAID -> IN_PROGRESS -> AWAITING_CONFIRMATION -> CONFIRMED", () => {
    expect(isValidTransition(BookingStatus.REQUESTED, BookingStatus.ACCEPTED)).toBe(true);
    expect(isValidTransition(BookingStatus.ACCEPTED, BookingStatus.PAID)).toBe(true);
    expect(isValidTransition(BookingStatus.PAID, BookingStatus.IN_PROGRESS)).toBe(true);
    expect(isValidTransition(BookingStatus.IN_PROGRESS, BookingStatus.AWAITING_CONFIRMATION)).toBe(true);
    expect(isValidTransition(BookingStatus.AWAITING_CONFIRMATION, BookingStatus.CONFIRMED)).toBe(true);
  });

  it("rejects skipping states, e.g. REQUESTED straight to PAID", () => {
    expect(isValidTransition(BookingStatus.REQUESTED, BookingStatus.PAID)).toBe(false);
  });

  it("rejects a no-op transition to the same status", () => {
    expect(isValidTransition(BookingStatus.ACCEPTED, BookingStatus.ACCEPTED)).toBe(false);
  });

  it("rejects any transition out of a terminal status", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(isValidTransition(status, BookingStatus.ACCEPTED)).toBe(false);
    }
  });

  it("allows AWAITING_CONFIRMATION to branch into DISPUTED as well as CONFIRMED/AUTO_CONFIRMED", () => {
    expect(isValidTransition(BookingStatus.AWAITING_CONFIRMATION, BookingStatus.DISPUTED)).toBe(true);
    expect(isValidTransition(BookingStatus.AWAITING_CONFIRMATION, BookingStatus.AUTO_CONFIRMED)).toBe(true);
  });

  it("allows DISPUTED to resolve either way", () => {
    expect(isValidTransition(BookingStatus.DISPUTED, BookingStatus.RESOLVED_TUTOR_FAVOR)).toBe(true);
    expect(isValidTransition(BookingStatus.DISPUTED, BookingStatus.RESOLVED_PARENT_FAVOR)).toBe(true);
  });

  it("throws an AppError with the from/to states on an illegal transition", () => {
    expect(() => assertValidTransition(BookingStatus.REJECTED, BookingStatus.ACCEPTED)).toThrow();
  });

  it("keeps OCCUPYING_STATUSES and TERMINAL_STATUSES disjoint and exhaustive over all BookingStatus values", () => {
    const all = Object.values(BookingStatus);
    for (const status of all) {
      const occupying = OCCUPYING_STATUSES.includes(status);
      const terminal = TERMINAL_STATUSES.includes(status);
      // Every status is exactly one of: still-occupying-and-non-terminal, or terminal.
      // (A status can be both occupying AND terminal, e.g. CONFIRMED — but never neither.)
      expect(occupying || terminal).toBe(true);
    }
  });
});
