import { computeParentCancellationOutcome } from "./cancellationPolicy";

describe("computeParentCancellationOutcome", () => {
  const threshold = 12;

  it("gives a full refund exactly at the threshold", () => {
    const now = new Date("2026-07-27T00:00:00.000Z");
    const sessionStart = new Date("2026-07-27T12:00:00.000Z"); // exactly 12h out
    expect(computeParentCancellationOutcome(sessionStart, now, threshold)).toBe("FULL_REFUND");
  });

  it("gives a full refund well before the threshold", () => {
    const now = new Date("2026-07-27T00:00:00.000Z");
    const sessionStart = new Date("2026-07-28T00:00:00.000Z"); // 24h out
    expect(computeParentCancellationOutcome(sessionStart, now, threshold)).toBe("FULL_REFUND");
  });

  it("releases to the tutor just under the threshold", () => {
    const now = new Date("2026-07-27T00:00:00.000Z");
    const sessionStart = new Date("2026-07-27T11:59:00.000Z"); // 11h59m out
    expect(computeParentCancellationOutcome(sessionStart, now, threshold)).toBe("RELEASE_TO_TUTOR");
  });

  it("releases to the tutor when the session has already started", () => {
    const now = new Date("2026-07-27T13:00:00.000Z");
    const sessionStart = new Date("2026-07-27T12:00:00.000Z"); // already 1h in the past
    expect(computeParentCancellationOutcome(sessionStart, now, threshold)).toBe("RELEASE_TO_TUTOR");
  });
});
