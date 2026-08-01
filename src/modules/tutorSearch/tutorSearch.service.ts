import prisma from "../../config/database.config";
import { resolveStorageUrl } from "../../services/media";
import { expandSearchTerms } from "../../services/search/searchSynonyms";
import {
  buildSearchCacheKey,
  getCachedSearchResult,
  setCachedSearchResult,
} from "../../services/search/searchCache";
import {
  KycStatus,
  SubjectVerificationStatus,
  TeachingMode,
  AvailabilitySlotType,
  SearchEventType,
} from "../../generated/prisma";
import {
  SearchTutorsQueryInput,
  NotifyMeInput,
  RecordSearchEventInput,
} from "./tutorSearch.types";

const BIO_EXCERPT_LENGTH = 120;
// A "page" of tutors matching a query is never remotely large enough to
// warrant real full-text search infra — a gentle nudge appears past this,
// per spec, without ever hard-blocking further results.
const REFINE_NUDGE_THRESHOLD = 50;

type TutorRow = Awaited<ReturnType<typeof fetchCandidatePage>>[number];

// ── Hard, always-on visibility gate ─────────────────────────
// Every one of these three conditions is non-negotiable: pending/rejected/
// suspended/banned tutors, tutors without a verified intro video, and
// tutors with zero approved subjects are never returned, full stop —
// enforced here at the query level, not filtered after the fact.
function hardVisibilityFilter() {
  return {
    deletedAt: null,
    kycStatus: KycStatus.ACTIVE,
    introVideoVerified: true,
    tutorSubjects: { some: { status: SubjectVerificationStatus.APPROVED, isOpenForBooking: true } },
  };
}

function buildWhere(query: SearchTutorsQueryInput) {
  const where: any = hardVisibilityFilter();

  if (query.cityId) where.cityId = query.cityId;

  if (query.mode) {
    where.teachingMode =
      query.mode === TeachingMode.BOTH
        ? TeachingMode.BOTH
        : { in: [query.mode, TeachingMode.BOTH] };
  }

  if (query.minPrice !== undefined) where.maxRateXaf = { gte: query.minPrice };
  if (query.maxPrice !== undefined) where.minRateXaf = { lte: query.maxPrice };
  if (query.language) where.languages = { has: query.language };
  if (query.gender) where.user = { gender: query.gender };

  if (query.subjectId || query.levelId) {
    where.tutorSubjects = {
      some: {
        status: SubjectVerificationStatus.APPROVED,
        isOpenForBooking: true,
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.levelId && { levels: { some: { levelId: query.levelId } } }),
      },
    };
  }

  if (query.q) {
    const terms = expandSearchTerms(query.q);
    where.OR = [
      { user: { firstName: { contains: query.q, mode: "insensitive" } } },
      { bio: { contains: query.q, mode: "insensitive" } },
      { neighbourhood: { contains: query.q, mode: "insensitive" } },
      { city: { name: { contains: query.q, mode: "insensitive" } } },
      ...terms.map((term) => ({
        tutorSubjects: {
          some: {
            status: SubjectVerificationStatus.APPROVED,
            isOpenForBooking: true,
            subject: { name: { contains: term, mode: "insensitive" } },
          },
        },
      })),
    ];
  }

  return where;
}

const CANDIDATE_SELECT = {
  id: true,
  bio: true,
  teachingMode: true,
  minRateXaf: true,
  maxRateXaf: true,
  compositeScore: true,
  newTutorBoostExpiresAt: true,
  completedSessionsCount: true,
  city: { select: { id: true, name: true } },
  neighbourhood: true,
  // TutorRatingSnapshot is keyed off User.id, not TutorProfile.id. The
  // displayed avatar is always User.profilePictureUrl — the one photo
  // upload flow every role shares — not TutorProfile's own (legacy,
  // unused-for-display) column.
  user: { select: { firstName: true, lastName: true, profilePictureUrl: true, ratingSnapshot: true } },
  availabilitySlots: {
    where: { isActive: true },
    select: { slotType: true, specificDate: true },
  },
  tutorSubjects: {
    where: { status: SubjectVerificationStatus.APPROVED, isOpenForBooking: true },
    select: {
      subject: { select: { id: true, name: true } },
      levels: { select: { level: { select: { id: true, name: true } } } },
    },
    take: 5,
  },
} as const;

async function fetchCandidatePage(
  where: any,
  cursor: string | undefined,
  limit: number
) {
  return prisma.tutorProfile.findMany({
    where,
    select: CANDIDATE_SELECT,
    orderBy: [{ compositeScore: "desc" }, { id: "asc" }],
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });
}

function computeAvailabilityStatus(
  slots: { slotType: AvailabilitySlotType; specificDate: Date | null }[]
): { status: "available_this_week" | "next_available" | "fully_booked"; nextAvailableDate: string | null } {
  const now = Date.now();
  const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;

  // A recurring weekly slot always has an occurrence within the next 7
  // days by definition — no per-slot date to check.
  if (slots.some((s) => s.slotType === AvailabilitySlotType.RECURRING)) {
    return { status: "available_this_week", nextAvailableDate: null };
  }

  const upcomingSpecificDates = slots
    .filter((s) => s.slotType === AvailabilitySlotType.SPECIFIC_DATE && s.specificDate)
    .map((s) => s.specificDate as Date)
    .filter((d) => d.getTime() >= now)
    .sort((a, b) => a.getTime() - b.getTime());

  if (upcomingSpecificDates.length === 0) {
    return { status: "fully_booked", nextAvailableDate: null };
  }
  if (upcomingSpecificDates[0].getTime() <= weekFromNow) {
    return { status: "available_this_week", nextAvailableDate: null };
  }
  return {
    status: "next_available",
    nextAvailableDate: upcomingSpecificDates[0].toISOString(),
  };
}

function isNewTutorBoosted(tutor: { newTutorBoostExpiresAt: Date | null; completedSessionsCount: number }): boolean {
  return (
    !!tutor.newTutorBoostExpiresAt &&
    tutor.newTutorBoostExpiresAt.getTime() > Date.now() &&
    tutor.completedSessionsCount < 5
  );
}

function toResultCard(tutor: TutorRow) {
  const availability = computeAvailabilityStatus(tutor.availabilitySlots);
  const snapshot = tutor.user.ratingSnapshot;

  return {
    tutorProfileId: tutor.id,
    firstName: tutor.user.firstName,
    lastNameInitial: tutor.user.lastName ? `${tutor.user.lastName.charAt(0)}.` : "",
    profilePictureUrl: resolveStorageUrl(tutor.user.profilePictureUrl),
    isVerified: true,
    isNew: isNewTutorBoosted(tutor),
    rating: {
      bayesian: snapshot ? Number(snapshot.bayesianRating) : null,
      raw: snapshot ? Number(snapshot.rawAverage) : null,
      reviewCount: snapshot?.totalReviewCount ?? 0,
    },
    subjects: tutor.tutorSubjects.map((ts) => ({
      ...ts.subject,
      levels: ts.levels.map((l) => l.level),
    })),
    city: tutor.city,
    neighbourhood: tutor.neighbourhood,
    teachingMode: tutor.teachingMode,
    priceMinXaf: tutor.minRateXaf,
    priceMaxXaf: tutor.maxRateXaf,
    availability: availability.status,
    nextAvailableDate: availability.nextAvailableDate,
    bioExcerpt: tutor.bio.slice(0, BIO_EXCERPT_LENGTH),
  };
}

async function findNearbyCityFallback(originalCityId: string) {
  const city = await prisma.city.findUnique({
    where: { id: originalCityId },
    select: { regionId: true },
  });
  if (!city) return null;

  const nearbyCity = await prisma.city.findFirst({
    where: { regionId: city.regionId, id: { not: originalCityId }, isActive: true },
    orderBy: { name: "asc" },
  });
  return nearbyCity;
}

/** Re-runs the query dropping one filter at a time, reporting whichever
 * single filter's removal first recovers results — the "most restrictive
 * filter" the zero-results screen highlights. */
async function findMostRestrictiveFilter(
  query: SearchTutorsQueryInput
): Promise<string | null> {
  const droppableKeys: (keyof SearchTutorsQueryInput)[] = [
    "minPrice",
    "maxPrice",
    "language",
    "gender",
    "mode",
    "levelId",
    "subjectId",
    "cityId",
  ];
  for (const key of droppableKeys) {
    if (query[key] === undefined) continue;
    const relaxed = { ...query, [key]: undefined };
    const count = await prisma.tutorProfile.count({ where: buildWhere(relaxed) });
    if (count > 0) return key;
  }
  return null;
}

async function recordZeroResultEvent(
  query: SearchTutorsQueryInput,
  userId: string | undefined
) {
  await prisma.searchAnalyticsEvent
    .create({
      data: {
        userId,
        eventType: SearchEventType.ZERO_RESULTS,
        query: query.q,
        filters: query as any,
        resultCount: 0,
      },
    })
    .catch(() => {});
}

export const TutorSearchService = {
  /**
   * Query params drive filtering; searcherCityId (resolved by the caller
   * from the requesting user's profile/student, when authenticated) is
   * only used as the default city for the no-query "featured tutors" case
   * and the empty-query default — it never overrides an explicit cityId
   * filter. Ranking is entirely by the precomputed compositeScore column
   * (see src/services/search/compositeScore.ts + the nightly job) — never
   * recomputed at query time, per spec.
   */
  async searchTutors(
    query: SearchTutorsQueryInput,
    context: { userId?: string; searcherCityId?: string | null } = {}
  ) {
    const effectiveQuery = { ...query };
    const isUnfiltered =
      !query.q &&
      !query.subjectId &&
      !query.levelId &&
      !query.mode &&
      query.minPrice === undefined &&
      query.maxPrice === undefined &&
      !query.language &&
      !query.gender;

    // Featured tutors: no query, no filters — default to the searcher's
    // city if we know it, across all subjects.
    if (isUnfiltered && !query.cityId && context.searcherCityId) {
      effectiveQuery.cityId = context.searcherCityId;
    }

    const where = buildWhere(effectiveQuery);
    const cacheKey = await buildSearchCacheKey(effectiveQuery.cityId ?? null, effectiveQuery as any);
    const cached = await getCachedSearchResult<any>(cacheKey);
    if (cached) return cached;

    const candidates = await fetchCandidatePage(where, query.cursor, query.limit);
    const hasNextPage = candidates.length > query.limit;
    const page = hasNextPage ? candidates.slice(0, query.limit) : candidates;

    if (page.length === 0) {
      const result = await this.buildZeroResultResponse(effectiveQuery, context.userId);
      await setCachedSearchResult(cacheKey, result);
      return result;
    }

    const totalMatching = await prisma.tutorProfile.count({ where });

    const result = {
      data: page.map(toResultCard),
      meta: {
        nextCursor: hasNextPage ? page[page.length - 1].id : null,
        hasNextPage,
        limit: query.limit,
        refineNudge: totalMatching > REFINE_NUDGE_THRESHOLD,
      },
    };
    await setCachedSearchResult(cacheKey, result);
    return result;
  },

  async buildZeroResultResponse(query: SearchTutorsQueryInput, userId: string | undefined) {
    await recordZeroResultEvent(query, userId);

    // Zero results in a specific city → try the nearest city in the same
    // region before giving up.
    if (query.cityId) {
      const nearby = await findNearbyCityFallback(query.cityId);
      if (nearby) {
        const nearbyWhere = buildWhere({ ...query, cityId: nearby.id });
        const nearbyResults = await fetchCandidatePage(nearbyWhere, undefined, query.limit);
        if (nearbyResults.length > 0) {
          return {
            data: nearbyResults.slice(0, query.limit).map(toResultCard),
            meta: { nextCursor: null, hasNextPage: false, limit: query.limit, refineNudge: false },
            fallback: {
              type: "nearby_city" as const,
              fallbackCityId: nearby.id,
              fallbackCityName: nearby.name,
            },
          };
        }
      }
    }

    // Zero results for a subject with literally no approved tutors
    // anywhere, regardless of other filters.
    if (query.subjectId) {
      const anyoneForSubject = await prisma.tutorSubject.count({
        where: { subjectId: query.subjectId, status: SubjectVerificationStatus.APPROVED },
      });
      if (anyoneForSubject === 0) {
        return {
          data: [],
          meta: { nextCursor: null, hasNextPage: false, limit: query.limit, refineNudge: false },
          fallback: { type: "no_tutors_for_subject" as const },
        };
      }
    }

    // Otherwise, an overly restrictive filter combination.
    const restrictiveFilter = await findMostRestrictiveFilter(query);
    return {
      data: [],
      meta: { nextCursor: null, hasNextPage: false, limit: query.limit, refineNudge: false },
      fallback: restrictiveFilter
        ? { type: "restrictive_filters" as const, suggestedFilterToRemove: restrictiveFilter }
        : { type: "restrictive_filters" as const, suggestedFilterToRemove: null },
    };
  },

  async submitNotifyMe(input: NotifyMeInput, userId: string | undefined) {
    return prisma.demandSignal.create({
      data: {
        subjectId: input.subjectId,
        cityId: input.cityId,
        userId,
        searchQuery: input.query,
        isNotifyMe: true,
      },
    });
  },

  async recordSearchEvent(input: RecordSearchEventInput, userId: string | undefined) {
    return prisma.searchAnalyticsEvent.create({
      data: {
        userId,
        eventType: input.eventType as SearchEventType,
        query: input.query,
        filters: input.filters as any,
        resultCount: input.resultCount,
        position: input.position,
        tutorProfileId: input.tutorProfileId,
      },
    });
  },

  // ── Admin analytics — never exposed to Tutors or Parents ────

  /** CTR per result position: impressions at position X are approximated
   * as "a QUERY_SUBMITTED whose resultCount was large enough for position
   * X to exist" (positions are 0-indexed within a 12-per-page result set)
   * — there's no separate per-position impression event, so this is the
   * closest honest signal the current event log supports. */
  async getCtrByPosition(windowDays = 30) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const [queries, clicks] = await Promise.all([
      prisma.searchAnalyticsEvent.findMany({
        where: { eventType: SearchEventType.QUERY_SUBMITTED, createdAt: { gte: since } },
        select: { resultCount: true },
      }),
      prisma.searchAnalyticsEvent.groupBy({
        by: ["position"],
        where: {
          eventType: SearchEventType.RESULT_CLICKED,
          createdAt: { gte: since },
          position: { not: null },
        },
        _count: { _all: true },
      }),
    ]);

    const clicksByPosition = new Map(clicks.map((c) => [c.position, c._count._all]));
    const maxPosition = Math.max(11, ...Array.from(clicksByPosition.keys()).map((p) => p ?? 0));

    const rows = [];
    for (let position = 0; position <= maxPosition; position++) {
      const impressions = queries.filter((q) => (q.resultCount ?? 0) > position).length;
      const clickCount = clicksByPosition.get(position) ?? 0;
      rows.push({
        position,
        impressions,
        clicks: clickCount,
        ctr: impressions > 0 ? Math.round((clickCount / impressions) * 10000) / 100 : 0,
      });
    }
    return rows;
  },

  /** Queries people actually typed that never led to a booking within the
   * window — a product-review signal, not an automatic action. */
  async getDeadEndQueries(windowDays = 30, limit = 20) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const [submitted, booked] = await Promise.all([
      prisma.searchAnalyticsEvent.groupBy({
        by: ["query"],
        where: {
          eventType: SearchEventType.QUERY_SUBMITTED,
          query: { not: null },
          createdAt: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.searchAnalyticsEvent.findMany({
        where: {
          eventType: SearchEventType.BOOKING_INITIATED,
          createdAt: { gte: since },
        },
        select: { query: true },
      }),
    ]);
    const bookedQueries = new Set(booked.map((b) => b.query).filter(Boolean));

    return submitted
      .filter((s) => s.query && !bookedQueries.has(s.query))
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, limit)
      .map((s) => ({ query: s.query, searchCount: s._count._all }));
  },

  /** The unmet-demand dashboard — subjects/cities people asked to be
   * notified about, most-requested first. */
  async getDemandSignals(limit = 50) {
    const signals = await prisma.demandSignal.groupBy({
      by: ["subjectId", "cityId"],
      where: { isNotifyMe: true },
      _count: { _all: true },
      orderBy: { _count: { subjectId: "desc" } },
      take: limit,
    });

    const subjectIds = signals.map((s) => s.subjectId).filter((id): id is string => !!id);
    const cityIds = signals.map((s) => s.cityId).filter((id): id is string => !!id);
    const [subjects, cities] = await Promise.all([
      subjectIds.length
        ? prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      cityIds.length
        ? prisma.city.findMany({ where: { id: { in: cityIds } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);
    const subjectById = new Map(subjects.map((s) => [s.id, s.name]));
    const cityById = new Map(cities.map((c) => [c.id, c.name]));

    return signals.map((s) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectId ? subjectById.get(s.subjectId) ?? null : null,
      cityId: s.cityId,
      cityName: s.cityId ? cityById.get(s.cityId) ?? null : null,
      count: s._count._all,
    }));
  },
};

export default TutorSearchService;
