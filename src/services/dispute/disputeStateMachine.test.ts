import { DisputeStatus } from "../../generated/prisma";
import { isValidTransition, assertValidTransition } from "./disputeStateMachine";

describe("dispute state machine", () => {
  it("allows an admin to resolve directly from OPEN without waiting on the tutor", () => {
    expect(isValidTransition(DisputeStatus.OPEN, DisputeStatus.RESOLVED_TUTOR_FAVOR)).toBe(true);
    expect(isValidTransition(DisputeStatus.OPEN, DisputeStatus.RESOLVED_PARENT_FAVOR)).toBe(true);
  });

  it("allows the SLA nudge from OPEN to AWAITING_ADMIN and escalation", () => {
    expect(isValidTransition(DisputeStatus.OPEN, DisputeStatus.AWAITING_ADMIN)).toBe(true);
    expect(isValidTransition(DisputeStatus.OPEN, DisputeStatus.ESCALATED)).toBe(true);
  });

  it("allows AWAITING_ADMIN and ESCALATED to resolve either way", () => {
    for (const from of [DisputeStatus.AWAITING_ADMIN, DisputeStatus.UNDER_REVIEW, DisputeStatus.ESCALATED]) {
      expect(isValidTransition(from, DisputeStatus.RESOLVED_TUTOR_FAVOR)).toBe(true);
      expect(isValidTransition(from, DisputeStatus.RESOLVED_PARENT_FAVOR)).toBe(true);
    }
  });

  it("rejects any transition out of a resolved status", () => {
    expect(isValidTransition(DisputeStatus.RESOLVED_TUTOR_FAVOR, DisputeStatus.OPEN)).toBe(false);
    expect(isValidTransition(DisputeStatus.RESOLVED_PARENT_FAVOR, DisputeStatus.UNDER_REVIEW)).toBe(false);
  });

  it("rejects a no-op transition", () => {
    expect(isValidTransition(DisputeStatus.OPEN, DisputeStatus.OPEN)).toBe(false);
  });

  it("throws on an illegal transition", () => {
    expect(() => assertValidTransition(DisputeStatus.RESOLVED_TUTOR_FAVOR, DisputeStatus.OPEN)).toThrow();
  });
});
