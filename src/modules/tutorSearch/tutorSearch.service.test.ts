const mockPrisma: any = {
  tutorProfile: { findMany: jest.fn(), count: jest.fn() },
  city: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  tutorSubject: { count: jest.fn() },
  demandSignal: { create: jest.fn(), groupBy: jest.fn() },
  searchAnalyticsEvent: { create: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  subject: { findMany: jest.fn() },
};

jest.mock("../../config/database.config", () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock("../../services/media", () => ({
  resolveStorageUrl: (path: string | null | undefined) => path,
}));

jest.mock("../../services/search/searchCache", () => ({
  buildSearchCacheKey: jest.fn().mockResolvedValue("cache-key"),
  getCachedSearchResult: jest.fn().mockResolvedValue(null),
  setCachedSearchResult: jest.fn().mockResolvedValue(undefined),
}));

import { TutorSearchService } from "./tutorSearch.service";
import { SearchTutorsQueryInput } from "./tutorSearch.types";

function baseQuery(overrides: Partial<SearchTutorsQueryInput> = {}): SearchTutorsQueryInput {
  return { limit: 12, ...overrides };
}

const sampleTutor = (overrides: Partial<any> = {}) => ({
  id: "tutor-1",
  bio: "An experienced tutor who loves teaching mathematics to secondary students.",
  teachingMode: "ONLINE_ONLY",
  minRateXaf: 5000,
  maxRateXaf: 10000,
  compositeScore: 80,
  newTutorBoostExpiresAt: null,
  completedSessionsCount: 0,
  city: { id: "city-1", name: "Yaoundé" },
  neighbourhood: "Bastos",
  user: { firstName: "Jean", lastName: "Baptiste", profilePictureUrl: null, ratingSnapshot: null },
  availabilitySlots: [],
  tutorSubjects: [
    { subject: { id: "subject-1", name: "Mathematics" }, levels: [{ level: { id: "level-1", name: "Form 5" } }] },
  ],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // recordZeroResultEvent fire-and-forgets this — every zero-result test
  // path relies on it resolving (or being caught), not being undefined.
  mockPrisma.searchAnalyticsEvent.create.mockResolvedValue({});
});

describe("TutorSearchService.searchTutors — hard visibility gate", () => {
  it("always filters on kycStatus ACTIVE, introVideoVerified, and an open APPROVED subject", async () => {
    mockPrisma.tutorProfile.findMany.mockResolvedValue([sampleTutor()]);
    mockPrisma.tutorProfile.count.mockResolvedValue(1);

    await TutorSearchService.searchTutors(baseQuery());

    expect(mockPrisma.tutorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          kycStatus: "ACTIVE",
          introVideoVerified: true,
          tutorSubjects: { some: { status: "APPROVED", isOpenForBooking: true } },
        }),
      })
    );
  });

  it("never includes phone/email/address fields in the result payload", async () => {
    mockPrisma.tutorProfile.findMany.mockResolvedValue([sampleTutor()]);
    mockPrisma.tutorProfile.count.mockResolvedValue(1);

    const result = await TutorSearchService.searchTutors(baseQuery());

    const serialized = JSON.stringify(result.data);
    expect(serialized).not.toMatch(/phone|email|address/i);
    expect(result.data[0].lastNameInitial).toBe("B.");
  });
});

describe("TutorSearchService.searchTutors — query synonym matching", () => {
  it("expands a French subject synonym (Physique) into the English equivalent for subject-name matching", async () => {
    mockPrisma.tutorProfile.findMany.mockResolvedValue([]);
    mockPrisma.tutorProfile.count.mockResolvedValue(0);
    mockPrisma.tutorSubject.count.mockResolvedValue(1); // subject filter isn't set here though

    await TutorSearchService.searchTutors(baseQuery({ q: "Physique" }));

    const callArgs = mockPrisma.tutorProfile.findMany.mock.calls[0][0];
    const orTerms = callArgs.where.OR.filter((c: any) => c.tutorSubjects).map(
      (c: any) => c.tutorSubjects.some.subject.name.contains
    );
    expect(orTerms).toContain("physics");
    expect(orTerms).toContain("physique");
  });
});

describe("TutorSearchService.searchTutors — cursor pagination", () => {
  it("requests limit+1 rows and reports hasNextPage/nextCursor from the extra row", async () => {
    const rows = Array.from({ length: 13 }, (_, i) => sampleTutor({ id: `tutor-${i}` }));
    mockPrisma.tutorProfile.findMany.mockResolvedValue(rows);
    mockPrisma.tutorProfile.count.mockResolvedValue(50);

    const result = await TutorSearchService.searchTutors(baseQuery({ limit: 12 }));

    expect(mockPrisma.tutorProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 13 })
    );
    expect(result.data).toHaveLength(12);
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.nextCursor).toBe("tutor-11");
  });

  it("suggests refining when more than 50 tutors match", async () => {
    mockPrisma.tutorProfile.findMany.mockResolvedValue([sampleTutor()]);
    mockPrisma.tutorProfile.count.mockResolvedValue(51);

    const result = await TutorSearchService.searchTutors(baseQuery());

    expect(result.meta.refineNudge).toBe(true);
  });
});

describe("TutorSearchService.searchTutors — zero-result fallbacks", () => {
  it("falls back to a nearby city in the same region when the searched city has no results", async () => {
    mockPrisma.tutorProfile.findMany
      .mockResolvedValueOnce([]) // original city — empty
      .mockResolvedValueOnce([sampleTutor()]); // nearby city — has results
    mockPrisma.city.findUnique.mockResolvedValue({ regionId: "region-1" });
    mockPrisma.city.findFirst.mockResolvedValue({ id: "city-2", name: "Mbalmayo" });

    const result: any = await TutorSearchService.searchTutors(
      baseQuery({ cityId: "city-1" })
    );

    expect(result.fallback.type).toBe("nearby_city");
    expect(result.fallback.fallbackCityId).toBe("city-2");
    expect(result.data).toHaveLength(1);
  });

  it("reports no_tutors_for_subject when literally no one is approved for that subject", async () => {
    mockPrisma.tutorProfile.findMany.mockResolvedValue([]);
    mockPrisma.tutorSubject.count.mockResolvedValue(0);

    const result: any = await TutorSearchService.searchTutors(
      baseQuery({ subjectId: "subject-x" })
    );

    expect(result.fallback.type).toBe("no_tutors_for_subject");
  });

  it("suggests the single filter to drop when the combination is just overly restrictive", async () => {
    mockPrisma.tutorProfile.findMany.mockResolvedValue([]);
    // count() is called once per candidate relaxed-filter query, in order —
    // make the very first drop (minPrice) recover results.
    mockPrisma.tutorProfile.count.mockResolvedValueOnce(5);

    const result: any = await TutorSearchService.searchTutors(
      baseQuery({ minPrice: 100000, maxPrice: 200000 })
    );

    expect(result.fallback.type).toBe("restrictive_filters");
    expect(result.fallback.suggestedFilterToRemove).toBe("minPrice");
  });

  it("records a ZERO_RESULTS analytics event", async () => {
    mockPrisma.tutorProfile.findMany.mockResolvedValue([]);
    mockPrisma.tutorProfile.count.mockResolvedValue(0);

    await TutorSearchService.searchTutors(baseQuery(), { userId: "user-1" });

    expect(mockPrisma.searchAnalyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "user-1", eventType: "ZERO_RESULTS" }),
      })
    );
  });
});

describe("TutorSearchService.submitNotifyMe", () => {
  it("writes a DemandSignal row with isNotifyMe true", async () => {
    mockPrisma.demandSignal.create.mockResolvedValue({ id: "signal-1" });

    await TutorSearchService.submitNotifyMe(
      { subjectId: "subject-1", cityId: "city-1", query: "physics" },
      "user-1"
    );

    expect(mockPrisma.demandSignal.create).toHaveBeenCalledWith({
      data: {
        subjectId: "subject-1",
        cityId: "city-1",
        userId: "user-1",
        searchQuery: "physics",
        isNotifyMe: true,
      },
    });
  });
});

describe("TutorSearchService.recordSearchEvent", () => {
  it("writes a SearchAnalyticsEvent row", async () => {
    mockPrisma.searchAnalyticsEvent.create.mockResolvedValue({ id: "event-1" });

    await TutorSearchService.recordSearchEvent(
      { eventType: "RESULT_CLICKED", tutorProfileId: "tutor-1", position: 2 },
      "user-1"
    );

    expect(mockPrisma.searchAnalyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "RESULT_CLICKED",
          tutorProfileId: "tutor-1",
          position: 2,
        }),
      })
    );
  });
});

describe("TutorSearchService.getCtrByPosition", () => {
  it("computes CTR from click counts over resultCount-derived impressions", async () => {
    // 2 queries returned >0 results (impressions at position 0), only 1
    // returned >1 result (impressions at position 1).
    mockPrisma.searchAnalyticsEvent.findMany.mockResolvedValue([
      { resultCount: 1 },
      { resultCount: 2 },
    ]);
    mockPrisma.searchAnalyticsEvent.groupBy.mockResolvedValue([
      { position: 0, _count: { _all: 1 } },
    ]);

    const rows = await TutorSearchService.getCtrByPosition(30);

    expect(rows[0]).toEqual({ position: 0, impressions: 2, clicks: 1, ctr: 50 });
    expect(rows[1]).toEqual({ position: 1, impressions: 1, clicks: 0, ctr: 0 });
  });
});

describe("TutorSearchService.getDeadEndQueries", () => {
  it("excludes queries that led to at least one booking", async () => {
    mockPrisma.searchAnalyticsEvent.groupBy.mockResolvedValue([
      { query: "physics tutor", _count: { _all: 5 } },
      { query: "maths tutor", _count: { _all: 3 } },
    ]);
    mockPrisma.searchAnalyticsEvent.findMany.mockResolvedValue([{ query: "maths tutor" }]);

    const rows = await TutorSearchService.getDeadEndQueries(30, 20);

    expect(rows).toEqual([{ query: "physics tutor", searchCount: 5 }]);
  });
});

describe("TutorSearchService.getDemandSignals", () => {
  it("returns notify-me demand grouped by subject/city with names resolved", async () => {
    mockPrisma.demandSignal.groupBy.mockResolvedValue([
      { subjectId: "subject-1", cityId: "city-1", _count: { _all: 4 } },
    ]);
    mockPrisma.subject.findMany.mockResolvedValue([{ id: "subject-1", name: "Physics" }]);
    mockPrisma.city.findMany.mockResolvedValue([{ id: "city-1", name: "Douala" }]);

    const rows = await TutorSearchService.getDemandSignals();

    expect(rows).toEqual([
      { subjectId: "subject-1", subjectName: "Physics", cityId: "city-1", cityName: "Douala", count: 4 },
    ]);
  });
});
