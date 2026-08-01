import { computeAutoResolutionRecommendation } from "./autoResolution.util";

const scheduledStartAt = new Date("2026-07-27T09:00:00.000Z");
const scheduledEndAt = new Date("2026-07-27T10:00:00.000Z");

describe("computeAutoResolutionRecommendation", () => {
  it("recommends TUTOR_FAVOR when overlap > 50% and both joined promptly", () => {
    const result = computeAutoResolutionRecommendation({
      scheduledStartAt,
      scheduledEndAt,
      tutorJoinedAt: new Date("2026-07-27T09:02:00.000Z"),
      tutorLeftAt: new Date("2026-07-27T10:00:00.000Z"),
      studentJoinedAt: new Date("2026-07-27T09:00:00.000Z"),
      studentLeftAt: new Date("2026-07-27T10:00:00.000Z"),
    });
    expect(result.recommendation).toBe("TUTOR_FAVOR");
    expect(result.overlapPercentage).toBeGreaterThan(50);
  });

  it("recommends PARENT_FAVOR when overlap < 20% and the tutor never joined", () => {
    const result = computeAutoResolutionRecommendation({
      scheduledStartAt,
      scheduledEndAt,
      tutorJoinedAt: null,
      tutorLeftAt: null,
      studentJoinedAt: new Date("2026-07-27T09:00:00.000Z"),
      studentLeftAt: new Date("2026-07-27T10:00:00.000Z"),
    });
    expect(result.recommendation).toBe("PARENT_FAVOR");
    expect(result.tutorJoined).toBe(false);
  });

  it("falls back to ADMIN_REVIEW in an ambiguous case", () => {
    const result = computeAutoResolutionRecommendation({
      scheduledStartAt,
      scheduledEndAt,
      tutorJoinedAt: new Date("2026-07-27T09:35:00.000Z"), // 35 min late — not "promptly"
      tutorLeftAt: new Date("2026-07-27T10:00:00.000Z"),
      studentJoinedAt: new Date("2026-07-27T09:00:00.000Z"),
      studentLeftAt: new Date("2026-07-27T10:00:00.000Z"),
    });
    expect(result.recommendation).toBe("ADMIN_REVIEW");
  });

  it("falls back to ADMIN_REVIEW when severe connection events occurred despite good overlap", () => {
    const result = computeAutoResolutionRecommendation({
      scheduledStartAt,
      scheduledEndAt,
      tutorJoinedAt: new Date("2026-07-27T09:02:00.000Z"),
      tutorLeftAt: new Date("2026-07-27T10:00:00.000Z"),
      studentJoinedAt: new Date("2026-07-27T09:00:00.000Z"),
      studentLeftAt: new Date("2026-07-27T10:00:00.000Z"),
      severeConnectionEvents: true,
    });
    expect(result.recommendation).toBe("ADMIN_REVIEW");
  });

  it("flags sessionEndedEarly when the tutor left well before the scheduled end", () => {
    const result = computeAutoResolutionRecommendation({
      scheduledStartAt,
      scheduledEndAt,
      tutorJoinedAt: new Date("2026-07-27T09:00:00.000Z"),
      tutorLeftAt: new Date("2026-07-27T09:15:00.000Z"),
      studentJoinedAt: new Date("2026-07-27T09:00:00.000Z"),
      studentLeftAt: new Date("2026-07-27T09:15:00.000Z"),
    });
    expect(result.sessionEndedEarly).toBe(true);
  });
});
