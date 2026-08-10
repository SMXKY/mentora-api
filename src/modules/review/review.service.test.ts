const mockPrisma: any = {
  review: { findMany: jest.fn() },
  reviewFraudSignal: { create: jest.fn(), findFirst: jest.fn() },
  riskSignal: { findFirst: jest.fn() },
  booking: { count: jest.fn() },
  user: { findUnique: jest.fn() },
};

jest.mock("../../config/database.config", () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockRecordSignal = jest.fn().mockResolvedValue({});
jest.mock("../trustSafety/trustSafety.service", () => ({
  TrustSafetyService: { recordSignal: mockRecordSignal },
}));

// review.service.ts's NotificationService/filterMessage/reviewWindow/
// ratingSnapshot imports pull in socket/env-var-checking modules that don't
// initialize cleanly under jest — checkReviewFraudSignals doesn't exercise
// any of them, so they're stubbed out purely to make the module importable.
jest.mock("../../services/notification/notification.service", () => ({
  __esModule: true,
  NotificationService: { send: jest.fn().mockResolvedValue([]) },
  default: { send: jest.fn().mockResolvedValue([]) },
}));
jest.mock("../../services/messaging/contentFilter", () => ({
  filterMessage: jest.fn().mockReturnValue({ result: "CLEAN", layer: null, matchedPattern: null, normalisedContent: null }),
}));
jest.mock("../../services/review/reviewWindow.service", () => ({
  tryRevealWindow: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../services/review/ratingSnapshot.service", () => ({
  recomputeTutorRatingSnapshot: jest.fn().mockResolvedValue(undefined),
}));

import { checkReviewFraudSignals } from "./review.service";

const NOW = new Date("2026-08-10T12:00:00.000Z");

const baseReview = {
  id: "review-1",
  subjectId: "tutor-1",
  authorId: "author-1",
  createdAt: NOW,
};

beforeEach(() => {
  jest.clearAllMocks();
  // Defaults: no fraud pattern present unless a test overrides these.
  mockPrisma.review.findMany.mockResolvedValue([{ id: "review-1" }]);
  mockPrisma.riskSignal.findFirst.mockResolvedValue(null);
  mockPrisma.booking.count.mockResolvedValue(5);
  mockPrisma.user.findUnique.mockResolvedValue({ createdAt: new Date("2020-01-01T00:00:00.000Z") });
});

describe("checkReviewFraudSignals — coordinated review burst", () => {
  it("flags a tutor with more than 5 reviews in the trailing 24h", async () => {
    const recentReviews = Array.from({ length: 6 }, (_, i) => ({ id: `r-${i}` }));
    mockPrisma.review.findMany.mockResolvedValue(recentReviews);

    await checkReviewFraudSignals(baseReview);

    expect(mockPrisma.reviewFraudSignal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signalType: "COORDINATED_REVIEW_BURST",
          subjectUserId: "tutor-1",
          reviewIds: recentReviews.map((r) => r.id),
        }),
      })
    );
    expect(mockRecordSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "tutor-1",
        signalType: "COORDINATED_REVIEW_PATTERN_DETECTED",
        pointsApplied: 40,
        requiresHumanReview: true,
      })
    );
  });

  it("does not flag at exactly 5 reviews (threshold is 'more than 5')", async () => {
    mockPrisma.review.findMany.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ id: `r-${i}` })));

    await checkReviewFraudSignals(baseReview);

    expect(mockPrisma.reviewFraudSignal.create).not.toHaveBeenCalled();
  });

  it("does not re-flag within the same window once already signalled", async () => {
    mockPrisma.review.findMany.mockResolvedValue(Array.from({ length: 6 }, (_, i) => ({ id: `r-${i}` })));
    mockPrisma.riskSignal.findFirst.mockResolvedValue({ id: "existing-signal" });

    await checkReviewFraudSignals(baseReview);

    expect(mockPrisma.reviewFraudSignal.create).not.toHaveBeenCalled();
    expect(mockRecordSignal).not.toHaveBeenCalled();
  });
});

describe("checkReviewFraudSignals — zero-booking-history cluster", () => {
  it("flags an author with no other booking history and a brand-new account", async () => {
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({ createdAt: new Date(NOW.getTime() - 60 * 60 * 1000) });

    await checkReviewFraudSignals(baseReview);

    expect(mockPrisma.reviewFraudSignal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signalType: "ZERO_BOOKING_HISTORY_CLUSTER",
          subjectUserId: "author-1",
        }),
      })
    );
    expect(mockRecordSignal).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "author-1", signalType: "ZERO_BOOKING_HISTORY_CLUSTER", pointsApplied: 25 })
    );
  });

  it("does not flag an author with an established booking history", async () => {
    mockPrisma.booking.count.mockResolvedValue(4);
    mockPrisma.user.findUnique.mockResolvedValue({ createdAt: new Date(NOW.getTime() - 60 * 60 * 1000) });

    await checkReviewFraudSignals(baseReview);

    expect(mockPrisma.reviewFraudSignal.create).not.toHaveBeenCalled();
  });

  it("does not flag a new-account author whose account predates the review by more than a day", async () => {
    mockPrisma.booking.count.mockResolvedValue(1);
    mockPrisma.user.findUnique.mockResolvedValue({ createdAt: new Date("2020-01-01T00:00:00.000Z") });

    await checkReviewFraudSignals(baseReview);

    expect(mockPrisma.reviewFraudSignal.create).not.toHaveBeenCalled();
  });
});
