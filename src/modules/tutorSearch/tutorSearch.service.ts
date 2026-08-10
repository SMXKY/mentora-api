import prisma from "../../config/database.config";
import meilisearch from "../../config/meilisearch.config";
import { resolveStorageUrl } from "../../services/media";
import {
  buildSearchCacheKey,
  getCachedSearchResult,
  setCachedSearchResult,
} from "../../services/search/searchCache";
import { TUTOR_INDEX_UID } from "../../services/search/meilisearchTutorIndex";
import { SearchOrigin } from "../../services/search/searchOrigin.resolver";
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
const REFINE_NUDGE_THRESHOLD = 50;
const CANDIDATE_POOL_SIZE = 500;

type TutorRow = Awaited<ReturnType<typeof fetchCandidatePage>>[number];

function hardVisibilityFilter() {
  return {
    deletedAt: null,
    kycStatus: KycStatus.ACTIVE,
    introVideoVerified: true,
    tutorSubjects: {
      some: {
        status: SubjectVerificationStatus.APPROVED,
        isOpenForBooking: true,
      },
    },
  };
}

function availabilityPresetRange(
  preset: "this_week" | "this_weekend" | "next_week"
): { from: Date; to: Date } {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const dayOfWeek = startOfToday.getDay();

  if (preset === "this_week") {
    const to = new Date(startOfToday);
    to.setDate(to.getDate() + (7 - dayOfWeek));
    return { from: startOfToday, to };
  }
  if (preset === "this_weekend") {
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
    const saturday = new Date(startOfToday);
    saturday.setDate(saturday.getDate() + daysUntilSaturday);
    const sundayEnd = new Date(saturday);
    sundayEnd.setDate(sundayEnd.getDate() + 2);
    return { from: saturday, to: sundayEnd };
  }
  const nextMonday = new Date(startOfToday);
  nextMonday.setDate(nextMonday.getDate() + ((8 - dayOfWeek) % 7 || 7));
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextSunday.getDate() + 7);
  return { from: nextMonday, to: nextSunday };
}

// Structured (non-text) filters only — city, mode, price, language, gender,
// availability, and explicit subjectId/levelId dropdown selections. Free-text
// (`q`) is handled separately by the tiered-ranking path below, since a plain
// `contains` OR clause can't express "exact beats prefix beats substring."
function buildStructuredWhere(query: SearchTutorsQueryInput) {
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
  if (query.gender)
    where.user = { ...(where.user ?? {}), gender: query.gender };

  if (query.availability || (query.availabilityFrom && query.availabilityTo)) {
    const range = query.availability
      ? availabilityPresetRange(query.availability)
      : {
          from: new Date(query.availabilityFrom!),
          to: new Date(query.availabilityTo!),
        };

    where.availabilitySlots = {
      some: {
        isActive: true,
        OR: [
          { slotType: AvailabilitySlotType.RECURRING },
          {
            slotType: AvailabilitySlotType.SPECIFIC_DATE,
            specificDate: { gte: range.from, lte: range.to },
          },
        ],
      },
    };
  }

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
  // neighbourhood intentionally not selected — never shown on any surface.
  user: {
    select: {
      firstName: true,
      lastName: true,
      profilePictureUrl: true,
      ratingSnapshot: true,
    },
  },
  availabilitySlots: {
    where: { isActive: true },
    select: { slotType: true, specificDate: true },
  },
  tutorSubjects: {
    where: {
      status: SubjectVerificationStatus.APPROVED,
      isOpenForBooking: true,
    },
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

// Meilisearch equivalent of a Prisma boolean-safe `has: undefined` check —
// a language filter with an undefined value throws there too, so this
// list is built conditionally the same way the old raw-SQL path did.
function buildMeilisearchFilter(query: SearchTutorsQueryInput): string[] {
  const filter: string[] = [];

  if (query.cityId) filter.push(`cityId = "${query.cityId}"`);
  if (query.subjectId) filter.push(`subjectIds = "${query.subjectId}"`);
  if (query.levelId) filter.push(`levelIds = "${query.levelId}"`);
  if (query.language) filter.push(`languages = "${query.language}"`);
  if (query.gender) filter.push(`gender = "${query.gender}"`);
  if (query.minPrice !== undefined) filter.push(`maxRateXaf >= ${query.minPrice}`);
  if (query.maxPrice !== undefined) filter.push(`minRateXaf <= ${query.maxPrice}`);

  if (query.mode) {
    filter.push(
      query.mode === TeachingMode.BOTH
        ? `teachingMode = "${TeachingMode.BOTH}"`
        : `(teachingMode = "${query.mode}" OR teachingMode = "${TeachingMode.BOTH}")`
    );
  }

  return filter;
}

// Geo only ever applies to an explicit home-session search — an ONLINE_ONLY
// or unset mode has no meaningful "distance" concept, and BOTH means "I
// don't mind either," not "I want in-person," so it stays out of geo sort
// too per the approved plan.
function shouldApplyGeoSort(query: SearchTutorsQueryInput): boolean {
  return query.mode === TeachingMode.HOME_ONLY;
}

/**
 * The single ranked candidate pool for a search, sourced from Meilisearch
 * instead of the old raw-SQL trigram-similarity query. Meilisearch's own
 * typo tolerance, French accent/stemming handling, and synonyms setting
 * (seeded from the old static dictionary, see meilisearchTutorIndex.ts)
 * replace the old tiered matchRank logic entirely. Proximity sort is
 * layered in ahead of compositeScore/boostScore only for home-session
 * searches with a resolved origin, see shouldApplyGeoSort().
 */
async function searchCandidatePool(
  query: SearchTutorsQueryInput,
  searchOrigin: SearchOrigin | null
): Promise<{ ids: string[]; estimatedTotalHits: number }> {
  const filter = buildMeilisearchFilter(query);
  const applyGeo = shouldApplyGeoSort(query) && searchOrigin !== null;

  let result;
  try {
    result = await meilisearch.index(TUTOR_INDEX_UID).search(query.q ?? "", {
      filter: filter.length > 0 ? filter.join(" AND ") : undefined,
      sort: applyGeo ? [`_geoPoint(${searchOrigin!.lat}, ${searchOrigin!.lng}):asc`] : undefined,
      limit: CANDIDATE_POOL_SIZE,
      attributesToRetrieve: ["id"],
    });
  } catch (err) {
    // The shared global error handler (error.controller.ts) logs the
    // wrapped AppError's own stack, not this original error, so without
    // this the real Meilisearch failure (index missing, connection
    // refused, bad filter syntax) never actually reaches the console.
    console.error({
      event: "meilisearch_search_failed",
      indexUid: TUTOR_INDEX_UID,
      query: query.q,
      filter,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  return {
    ids: result.hits.map((hit: any) => hit.id),
    estimatedTotalHits: result.estimatedTotalHits,
  };
}

/** Availability is time-relative ("this week" moves every day), so it is
 * deliberately not baked into the Meilisearch document as a static field
 * that would go stale between recomputes — it stays a Postgres post-filter
 * over the already-ranked Meilisearch candidate pool, same shape as the
 * old code's availability WHERE clause, just applied after ranking instead
 * of before. */
async function filterCandidatesByAvailability(
  candidateIds: string[],
  query: SearchTutorsQueryInput
): Promise<Set<string>> {
  if (!query.availability && !(query.availabilityFrom && query.availabilityTo)) {
    return new Set(candidateIds);
  }

  const range = query.availability
    ? availabilityPresetRange(query.availability)
    : { from: new Date(query.availabilityFrom!), to: new Date(query.availabilityTo!) };

  const rows = await prisma.tutorProfile.findMany({
    where: {
      id: { in: candidateIds },
      availabilitySlots: {
        some: {
          isActive: true,
          OR: [
            { slotType: AvailabilitySlotType.RECURRING },
            {
              slotType: AvailabilitySlotType.SPECIFIC_DATE,
              specificDate: { gte: range.from, lte: range.to },
            },
          ],
        },
      },
    },
    select: { id: true },
  });

  return new Set(rows.map((r) => r.id));
}

/** Slices the ranked id pool at the cursor, fetches full rows for just
 * that page from Postgres (Meilisearch only returns ids here, see
 * attributesToRetrieve above), then restores Meilisearch's rank order —
 * `id: { in: [...] }` does not guarantee result order matches the input
 * array. */
async function fetchPageForCandidateIds(
  rankedIds: string[],
  cursor: string | undefined,
  limit: number
): Promise<TutorRow[]> {
  const startIndex = cursor ? rankedIds.indexOf(cursor) + 1 : 0;
  const pageIds = rankedIds.slice(startIndex, startIndex + limit + 1);
  if (pageIds.length === 0) return [];

  const rows = await prisma.tutorProfile.findMany({
    where: { id: { in: pageIds } },
    select: CANDIDATE_SELECT,
  });

  const rowById = new Map(rows.map((r) => [r.id, r]));
  return pageIds.map((id) => rowById.get(id)).filter((r): r is TutorRow => !!r);
}

function computeAvailabilityStatus(
  slots: { slotType: AvailabilitySlotType; specificDate: Date | null }[]
): {
  status: "available_this_week" | "next_available" | "fully_booked";
  nextAvailableDate: string | null;
} {
  const now = Date.now();
  const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;

  if (slots.some((s) => s.slotType === AvailabilitySlotType.RECURRING)) {
    return { status: "available_this_week", nextAvailableDate: null };
  }

  const upcomingSpecificDates = slots
    .filter(
      (s) => s.slotType === AvailabilitySlotType.SPECIFIC_DATE && s.specificDate
    )
    .map((s) => s.specificDate as Date)
    .filter((d) => d.getTime() >= now)
    .sort((a, b) => a.getTime() - b.getTime());

  if (upcomingSpecificDates.length === 0)
    return { status: "fully_booked", nextAvailableDate: null };
  if (upcomingSpecificDates[0].getTime() <= weekFromNow)
    return { status: "available_this_week", nextAvailableDate: null };
  return {
    status: "next_available",
    nextAvailableDate: upcomingSpecificDates[0].toISOString(),
  };
}

function isNewTutorBoosted(tutor: {
  newTutorBoostExpiresAt: Date | null;
  completedSessionsCount: number;
}): boolean {
  return (
    !!tutor.newTutorBoostExpiresAt &&
    tutor.newTutorBoostExpiresAt.getTime() > Date.now() &&
    tutor.completedSessionsCount < 5
  );
}

// Cuts at the last full word before maxLength and appends an explicit
// ellipsis — a raw slice() can land mid-word with no visual indication
// the text was cut off, which is what was breaking the result card UI.
function truncateBio(bio: string, maxLength: number): string {
  const trimmed = bio.trim();
  if (trimmed.length <= maxLength) return trimmed;
  const sliced = trimmed.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(" ");
  const clean = lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced;
  return `${clean}…`;
}

function toResultCard(tutor: TutorRow) {
  const availability = computeAvailabilityStatus(tutor.availabilitySlots);
  const snapshot = tutor.user.ratingSnapshot;

  return {
    tutorProfileId: tutor.id,
    firstName: tutor.user.firstName,
    lastNameInitial: tutor.user.lastName
      ? `${tutor.user.lastName.charAt(0)}.`
      : "",
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
    teachingMode: tutor.teachingMode,
    priceMinXaf: tutor.minRateXaf,
    priceMaxXaf: tutor.maxRateXaf,
    availability: availability.status,
    nextAvailableDate: availability.nextAvailableDate,
    bioExcerpt:
      tutor.bio.trim().length > 0
        ? truncateBio(tutor.bio, BIO_EXCERPT_LENGTH)
        : null,
  };
}

async function findNearbyCityFallback(originalCityId: string) {
  const city = await prisma.city.findUnique({
    where: { id: originalCityId },
    select: { regionId: true },
  });
  if (!city) return null;
  return prisma.city.findFirst({
    where: {
      regionId: city.regionId,
      id: { not: originalCityId },
      isActive: true,
    },
    orderBy: { name: "asc" },
  });
}

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
    "availability",
  ];
  for (const key of droppableKeys) {
    if (query[key] === undefined) continue;
    const relaxed = { ...query, [key]: undefined };
    const count = await prisma.tutorProfile.count({
      where: buildStructuredWhere(relaxed),
    });
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
  async searchTutors(
    query: SearchTutorsQueryInput,
    context: {
      userId?: string;
      searcherCityId?: string | null;
      searchOrigin?: SearchOrigin | null;
    } = {}
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
      !query.gender &&
      !query.availability;

    if (isUnfiltered && !query.cityId && context.searcherCityId) {
      effectiveQuery.cityId = context.searcherCityId;
    }

    const cacheKey = await buildSearchCacheKey(
      effectiveQuery.cityId ?? null,
      { ...effectiveQuery, hasGeoOrigin: !!context.searchOrigin } as any
    );
    const cached = await getCachedSearchResult<any>(cacheKey);
    if (cached) return cached;

    const pool = await searchCandidatePool(effectiveQuery, context.searchOrigin ?? null);
    if (pool.ids.length === 0) {
      return this.buildZeroResultResponse(effectiveQuery, context.userId);
    }

    const eligibleIds = await filterCandidatesByAvailability(pool.ids, effectiveQuery);
    const rankedEligibleIds = pool.ids.filter((id) => eligibleIds.has(id));

    if (rankedEligibleIds.length === 0) {
      return this.buildZeroResultResponse(effectiveQuery, context.userId);
    }

    const candidates = await fetchPageForCandidateIds(
      rankedEligibleIds,
      query.cursor,
      query.limit
    );
    const hasNextPage = candidates.length > query.limit;
    const page = hasNextPage ? candidates.slice(0, query.limit) : candidates;

    if (page.length === 0) {
      const result = await this.buildZeroResultResponse(effectiveQuery, context.userId);
      await setCachedSearchResult(cacheKey, result);
      return result;
    }

    const result = {
      data: page.map(toResultCard),
      meta: {
        nextCursor: hasNextPage ? page[page.length - 1].id : null,
        hasNextPage,
        limit: query.limit,
        // Meilisearch's own estimate for the query+filters, independent of
        // the availability post-filter — lets the UI show "N tutors found"
        // up front while the list itself still loads/scrolls page by page.
        totalCount: pool.estimatedTotalHits,
        refineNudge: pool.estimatedTotalHits > REFINE_NUDGE_THRESHOLD,
      },
    };
    await setCachedSearchResult(cacheKey, result);
    return result;
  },

  async buildZeroResultResponse(
    query: SearchTutorsQueryInput,
    userId: string | undefined
  ) {
    await recordZeroResultEvent(query, userId);

    if (query.cityId) {
      const nearby = await findNearbyCityFallback(query.cityId);
      if (nearby) {
        const nearbyWhere = buildStructuredWhere({
          ...query,
          cityId: nearby.id,
          q: undefined,
        } as any);
        const nearbyResults = await fetchCandidatePage(
          nearbyWhere,
          undefined,
          query.limit
        );
        if (nearbyResults.length > 0) {
          return {
            data: nearbyResults.slice(0, query.limit).map(toResultCard),
            meta: {
              nextCursor: null,
              hasNextPage: false,
              limit: query.limit,
              totalCount: nearbyResults.length,
              refineNudge: false,
            },
            fallback: {
              type: "nearby_city" as const,
              fallbackCityId: nearby.id,
              fallbackCityName: nearby.name,
            },
          };
        }
      }
    }

    if (query.subjectId) {
      const anyoneForSubject = await prisma.tutorSubject.count({
        where: {
          subjectId: query.subjectId,
          status: SubjectVerificationStatus.APPROVED,
        },
      });
      if (anyoneForSubject === 0) {
        return {
          data: [],
          meta: {
            nextCursor: null,
            hasNextPage: false,
            limit: query.limit,
            totalCount: 0,
            refineNudge: false,
          },
          fallback: { type: "no_tutors_for_subject" as const },
        };
      }
    }

    const restrictiveFilter = await findMostRestrictiveFilter(query);
    return {
      data: [],
      meta: {
        nextCursor: null,
        hasNextPage: false,
        limit: query.limit,
        totalCount: 0,
        refineNudge: false,
      },
      fallback: restrictiveFilter
        ? {
            type: "restrictive_filters" as const,
            suggestedFilterToRemove: restrictiveFilter,
          }
        : {
            type: "restrictive_filters" as const,
            suggestedFilterToRemove: null,
          },
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

  async recordSearchEvent(
    input: RecordSearchEventInput,
    userId: string | undefined
  ) {
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

  async getCtrByPosition(windowDays = 30) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const [queries, clicks] = await Promise.all([
      prisma.searchAnalyticsEvent.findMany({
        where: {
          eventType: SearchEventType.QUERY_SUBMITTED,
          createdAt: { gte: since },
        },
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

    const clicksByPosition = new Map(
      clicks.map((c) => [c.position, c._count._all])
    );
    const maxPosition = Math.max(
      11,
      ...Array.from(clicksByPosition.keys()).map((p) => p ?? 0)
    );

    const rows = [];
    for (let position = 0; position <= maxPosition; position++) {
      const impressions = queries.filter(
        (q) => (q.resultCount ?? 0) > position
      ).length;
      const clickCount = clicksByPosition.get(position) ?? 0;
      rows.push({
        position,
        impressions,
        clicks: clickCount,
        ctr:
          impressions > 0
            ? Math.round((clickCount / impressions) * 10000) / 100
            : 0,
      });
    }
    return rows;
  },

  /** Most-searched query text, regardless of outcome — complements
   *  getDeadEndQueries (which only surfaces queries that never converted).
   *  Answers "what are people typing" for recruitment/content planning. */
  async getTopQueries(windowDays = 30, limit = 20) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const submitted = await prisma.searchAnalyticsEvent.groupBy({
      by: ["query"],
      where: {
        eventType: SearchEventType.QUERY_SUBMITTED,
        query: { not: null },
        createdAt: { gte: since },
      },
      _count: { _all: true },
    });

    return submitted
      .filter((s) => s.query)
      .sort((a, b) => b._count._all - a._count._all)
      .slice(0, limit)
      .map((s) => ({ query: s.query, searchCount: s._count._all }));
  },

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

  async getDemandSignals(limit = 50) {
    const signals = await prisma.demandSignal.groupBy({
      by: ["subjectId", "cityId"],
      where: { isNotifyMe: true },
      _count: { _all: true },
      orderBy: { _count: { subjectId: "desc" } },
      take: limit,
    });

    const subjectIds = signals
      .map((s) => s.subjectId)
      .filter((id): id is string => !!id);
    const cityIds = signals
      .map((s) => s.cityId)
      .filter((id): id is string => !!id);
    const [subjects, cities] = await Promise.all([
      subjectIds.length
        ? prisma.subject.findMany({
            where: { id: { in: subjectIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      cityIds.length
        ? prisma.city.findMany({
            where: { id: { in: cityIds } },
            select: { id: true, name: true },
          })
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

  /**
   * REQ-010-011 — the actual "should we recruit, and for what" report:
   * every real search's filters (subject, language, teaching mode, city)
   * tallied over a window, split into total volume vs. the zero-result
   * subset so admins can see both raw demand AND unmet demand per
   * dimension. `filters` is stored as an arbitrary JSON blob (see
   * RecordSearchEventSchema) — it's the exact same shape SearchScreen
   * sends on every QUERY_SUBMITTED/ZERO_RESULTS event, so no separate
   * aggregation table is needed; this just tallies it in memory.
   */
  async getSearchDemandBreakdown(windowDays = 30) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const events = await prisma.searchAnalyticsEvent.findMany({
      where: {
        eventType: { in: [SearchEventType.QUERY_SUBMITTED, SearchEventType.ZERO_RESULTS] },
        createdAt: { gte: since },
      },
      select: { eventType: true, filters: true },
    });

    const subjectCounts = new Map<string, { total: number; zeroResult: number }>();
    const cityCounts = new Map<string, { total: number; zeroResult: number }>();
    const languageCounts: Record<string, number> = {};
    const modeCounts: Record<string, number> = {};
    let zeroResultSearches = 0;

    for (const event of events) {
      const isZero = event.eventType === SearchEventType.ZERO_RESULTS;
      if (isZero) zeroResultSearches++;
      const filters = (event.filters as Record<string, unknown> | null) ?? {};

      const subjectId = typeof filters.subjectId === "string" ? filters.subjectId : null;
      if (subjectId) {
        const entry = subjectCounts.get(subjectId) ?? { total: 0, zeroResult: 0 };
        entry.total++;
        if (isZero) entry.zeroResult++;
        subjectCounts.set(subjectId, entry);
      }

      const cityId = typeof filters.cityId === "string" ? filters.cityId : null;
      if (cityId) {
        const entry = cityCounts.get(cityId) ?? { total: 0, zeroResult: 0 };
        entry.total++;
        if (isZero) entry.zeroResult++;
        cityCounts.set(cityId, entry);
      }

      const language = typeof filters.language === "string" ? filters.language : "unspecified";
      languageCounts[language] = (languageCounts[language] ?? 0) + 1;

      const mode = typeof filters.mode === "string" ? filters.mode : "unspecified";
      modeCounts[mode] = (modeCounts[mode] ?? 0) + 1;
    }

    const [subjects, cities] = await Promise.all([
      subjectCounts.size
        ? prisma.subject.findMany({
            where: { id: { in: Array.from(subjectCounts.keys()) } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      cityCounts.size
        ? prisma.city.findMany({
            where: { id: { in: Array.from(cityCounts.keys()) } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
    const cityNameById = new Map(cities.map((c) => [c.id, c.name]));

    return {
      windowDays,
      totalSearches: events.length,
      zeroResultSearches,
      bySubject: Array.from(subjectCounts.entries())
        .map(([subjectId, counts]) => ({
          subjectId,
          subjectName: subjectNameById.get(subjectId) ?? null,
          ...counts,
        }))
        .sort((a, b) => b.total - a.total),
      byCity: Array.from(cityCounts.entries())
        .map(([cityId, counts]) => ({
          cityId,
          cityName: cityNameById.get(cityId) ?? null,
          ...counts,
        }))
        .sort((a, b) => b.total - a.total),
      byLanguage: languageCounts,
      byMode: modeCounts,
    };
  },
};

export default TutorSearchService;
