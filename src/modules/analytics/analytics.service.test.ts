const mockPrisma: any = {
  tutorProfile: { findFirst: jest.fn() },
  booking: { findMany: jest.fn() },
};

jest.mock("../../config/database.config", () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { AnalyticsService } from "./analytics.service";
import { sessionStartAt } from "../availability/availability.logic";

const SCHEDULED_START_TIME = new Date("1970-01-01T09:00:00.000Z");
const SCHEDULED_END_TIME = new Date("1970-01-01T10:00:00.000Z");

const DATE_A = new Date(Date.UTC(2026, 0, 5)); // Monday — HOME session
const DATE_B = new Date(Date.UTC(2026, 0, 7)); // Wednesday, same week as A — ONLINE session
const DATE_C = new Date(Date.UTC(2026, 0, 20)); // Tuesday, a later week — ONLINE session, no attendance data

const scheduledStartA = sessionStartAt({ sessionDate: DATE_A, sessionStartTime: SCHEDULED_START_TIME });
const scheduledStartB = sessionStartAt({ sessionDate: DATE_B, sessionStartTime: SCHEDULED_START_TIME });

const bookingA = {
  sessionDate: DATE_A,
  sessionType: "HOME",
  sessionStartTime: SCHEDULED_START_TIME,
  sessionEndTime: SCHEDULED_END_TIME,
  netTutorAmountXaf: 10000,
  tutorCheckedInAt: new Date(scheduledStartA.getTime() + 5 * 60000),
  tutorCheckedOutAt: new Date(scheduledStartA.getTime() + 5 * 60000 + 50 * 60000),
  liveRoom: null,
};

const bookingB = {
  sessionDate: DATE_B,
  sessionType: "ONLINE",
  sessionStartTime: SCHEDULED_START_TIME,
  sessionEndTime: SCHEDULED_END_TIME,
  netTutorAmountXaf: 8000,
  tutorCheckedInAt: null,
  tutorCheckedOutAt: null,
  liveRoom: {
    participants: [
      {
        firstJoinedAt: new Date(scheduledStartB.getTime() + 2 * 60000),
        lastLeftAt: new Date(scheduledStartB.getTime() + 62 * 60000),
        totalTimeSeconds: 3600,
      },
    ],
  },
};

const bookingC = {
  sessionDate: DATE_C,
  sessionType: "ONLINE",
  sessionStartTime: SCHEDULED_START_TIME,
  sessionEndTime: SCHEDULED_END_TIME,
  netTutorAmountXaf: 6000,
  tutorCheckedInAt: null,
  tutorCheckedOutAt: null,
  liveRoom: { participants: [] },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AnalyticsService.getTutorAnalytics", () => {
  it("returns the empty shape when the user has no tutor profile", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue(null);

    const result = await AnalyticsService.getTutorAnalytics("user-1", "all");

    expect(result.sessionsCount).toBe(0);
    expect(result.weeklyTrend).toEqual([]);
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
  });

  it("returns the empty shape when there are no qualifying bookings", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({ id: "tutor-1" });
    mockPrisma.booking.findMany.mockResolvedValue([]);

    const result = await AnalyticsService.getTutorAnalytics("user-1", "3m");

    expect(result.sessionsCount).toBe(0);
    expect(result.financials).toEqual({ totalEarnedXaf: 0, averagePerSessionXaf: 0 });
  });

  it("aggregates financials, session-type split, weekly buckets, and timing across HOME and ONLINE sessions", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({ id: "tutor-1" });
    mockPrisma.booking.findMany.mockResolvedValue([bookingA, bookingB, bookingC]);

    const result = await AnalyticsService.getTutorAnalytics("user-1", "all");

    expect(result.sessionsCount).toBe(3);
    expect(result.financials).toEqual({ totalEarnedXaf: 24000, averagePerSessionXaf: 8000 });

    expect(result.sessionTypeBreakdown).toEqual({
      online: { count: 2, earningsXaf: 14000 },
      home: { count: 1, earningsXaf: 10000 },
    });

    // A and B fall in the same Sunday-start week; C falls two weeks later.
    expect(result.weeklyTrend).toEqual([
      { weekStart: "2026-01-04", sessionsCount: 2 },
      { weekStart: "2026-01-18", sessionsCount: 1 },
    ]);

    // Home: only booking A has check-in/out data.
    expect(result.timing.home).toEqual({
      avgCheckInDelayMinutes: 5,
      avgActualDurationMinutes: 50,
      sampledSessionsCount: 1,
    });

    // Online: booking B has full attendance data (duration prefers
    // totalTimeSeconds = 3600s = 60min over the 62min raw join/leave diff);
    // booking C has none, so it doesn't pull the averages down and isn't
    // counted as "sampled".
    expect(result.timing.online).toEqual({
      avgJoinDelayMinutes: 2,
      avgActualDurationMinutes: 60,
      sampledSessionsCount: 1,
    });
  });

  it("passes the resolved date filter through to the booking query for a bounded range", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({ id: "tutor-1" });
    mockPrisma.booking.findMany.mockResolvedValue([]);

    await AnalyticsService.getTutorAnalytics("user-1", "4w");

    const whereArg = mockPrisma.booking.findMany.mock.calls[0][0].where;
    expect(whereArg.sessionDate.gte).toBeInstanceOf(Date);

    mockPrisma.booking.findMany.mockClear();
    await AnalyticsService.getTutorAnalytics("user-1", "all");
    const allWhereArg = mockPrisma.booking.findMany.mock.calls[0][0].where;
    expect(allWhereArg.sessionDate).toBeUndefined();
  });
});
