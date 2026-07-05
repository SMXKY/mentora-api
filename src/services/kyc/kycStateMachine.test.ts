import { KycStatus } from "../../generated/prisma";
import { isValidTransition, assertValidTransition } from "./kycStateMachine";
import { AppError } from "../../utils/AppError.util";

const ALL_STATUSES = Object.values(KycStatus);

describe("KYC status transitions", () => {
  it("rejects a status transitioning to itself for every status", () => {
    for (const status of ALL_STATUSES) {
      expect(isValidTransition(status, status)).toBe(false);
    }
  });

  it("BANNED is terminal — nothing transitions out of it", () => {
    for (const status of ALL_STATUSES) {
      expect(isValidTransition(KycStatus.BANNED, status)).toBe(false);
    }
  });

  it("every non-BANNED status can reach BANNED", () => {
    for (const status of ALL_STATUSES) {
      if (status === KycStatus.BANNED) continue;
      expect(isValidTransition(status, KycStatus.BANNED)).toBe(true);
    }
  });

  const validCases: [KycStatus, KycStatus][] = [
    [KycStatus.INCOMPLETE, KycStatus.PENDING],
    [KycStatus.PENDING, KycStatus.IDENTITY_APPROVED],
    [KycStatus.PENDING, KycStatus.REJECTED],
    [KycStatus.IDENTITY_APPROVED, KycStatus.ACTIVE],
    [KycStatus.IDENTITY_APPROVED, KycStatus.REJECTED],
    [KycStatus.ACTIVE, KycStatus.SUSPENDED],
    [KycStatus.ACTIVE, KycStatus.PENDING_REVERIFICATION],
    [KycStatus.SUSPENDED, KycStatus.ACTIVE],
    [KycStatus.REJECTED, KycStatus.PENDING],
    [KycStatus.PENDING_REVERIFICATION, KycStatus.ACTIVE],
    [KycStatus.PENDING_REVERIFICATION, KycStatus.REJECTED],
  ];

  it.each(validCases)("%s -> %s is valid", (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
    expect(() => assertValidTransition(from, to)).not.toThrow();
  });

  const invalidCases: [KycStatus, KycStatus][] = [
    [KycStatus.INCOMPLETE, KycStatus.ACTIVE],
    [KycStatus.INCOMPLETE, KycStatus.IDENTITY_APPROVED],
    [KycStatus.PENDING, KycStatus.ACTIVE],
    [KycStatus.PENDING, KycStatus.SUSPENDED],
    [KycStatus.REJECTED, KycStatus.ACTIVE],
    [KycStatus.REJECTED, KycStatus.IDENTITY_APPROVED],
    [KycStatus.SUSPENDED, KycStatus.PENDING],
    [KycStatus.ACTIVE, KycStatus.PENDING],
    [KycStatus.ACTIVE, KycStatus.REJECTED],
    [KycStatus.ACTIVE, KycStatus.IDENTITY_APPROVED],
  ];

  it.each(invalidCases)("%s -> %s is invalid", (from, to) => {
    expect(isValidTransition(from, to)).toBe(false);
  });

  it("assertValidTransition throws an AppError with from/to context on an invalid transition", () => {
    expect(() =>
      assertValidTransition(KycStatus.ACTIVE, KycStatus.PENDING)
    ).toThrow(AppError);
    try {
      assertValidTransition(KycStatus.ACTIVE, KycStatus.PENDING);
      fail("expected assertValidTransition to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).meta).toEqual({
        from: KycStatus.ACTIVE,
        to: KycStatus.PENDING,
      });
    }
  });
});
