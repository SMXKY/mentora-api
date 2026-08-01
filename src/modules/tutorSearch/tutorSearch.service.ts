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
const REFINE_NUDGE_THRESHOLD = 50;
const FUZZY_SIMILARITY_THRESHOLD = 0.3;
const TEXT_CANDIDATE_POOL_SIZE = 500;

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

interface TextMatchRank {
  matchRank: number; // 0 exact subject, 1 prefix subject, 2 substring/synonym/level/name/bio/city, 3 fuzzy typo
  similarity: number;
}

/**
 * Tiered relevance for a free-text query: exact subject-name match beats
 * prefix beats substring/synonym beats fuzzy-typo-only. Tutors matched only
 * via name/bio/city/level text (not a subject name) land in tier 2 as well
 * — "good enough to show, not as precise as a subject match" — so a search
 * for "Jean" still surfaces tutors named Jean-Paul without pretending
 * that's as strong a signal as an exact subject match.
 */
async function rankTextMatches(
  rawQuery: string
): Promise<Map<string, TextMatchRank>> {
  const q = rawQuery.trim().toLowerCase();
  const synonymTerms = expandSearchTerms(rawQuery);

  const subjectRows = await prisma.$queryRaw<
    { tutor_profile_id: string; match_rank: number; sim: number }[]
  >`
    SELECT
      ts.tutor_profile_id,
      MIN(
        CASE
          WHEN lower(s.name) = ${q} THEN 0
          WHEN lower(s.name) LIKE ${q + "%"} THEN 1
          WHEN lower(s.name) LIKE ${"%" + q + "%"} THEN 2
          WHEN lower(s.name) = ANY(${synonymTerms}) THEN 2
          WHEN similarity(s.name, ${rawQuery}) > ${FUZZY_SIMILARITY_THRESHOLD} THEN 3
          ELSE 9
        END
      ) AS match_rank,
      MAX(similarity(s.name, ${rawQuery})) AS sim
    FROM tutor_subjects ts
    JOIN subjects s ON s.id = ts.subject_id
    WHERE ts.status = 'APPROVED' AND ts.is_open_for_booking = true
      AND (
        lower(s.name) LIKE ${"%" + q + "%"}
        OR lower(s.name) = ANY(${synonymTerms})
        OR similarity(s.name, ${rawQuery}) > ${FUZZY_SIMILARITY_THRESHOLD}
      )
    GROUP BY ts.tutor_profile_id
  `;

  const ranks = new Map<string, TextMatchRank>(
    subjectRows.map((r) => [
      r.tutor_profile_id,
      { matchRank: r.match_rank, similarity: r.sim ?? 0 },
    ])
  );

  // Build the OR clause conditionally — a language filter with `has:
  // undefined` is rejected by Prisma outright, it must be omitted from
  // the array entirely when the query isn't literally "EN" or "FR",
  // not included with an undefined value.
  const upperQuery = rawQuery.trim().toUpperCase();
  const isLanguageCode = upperQuery === "EN" || upperQuery === "FR";

  const secondaryOr: any[] = [
    { user: { firstName: { contains: rawQuery, mode: "insensitive" } } },
    { bio: { contains: rawQuery, mode: "insensitive" } },
    { city: { name: { contains: rawQuery, mode: "insensitive" } } },
    {
      tutorSubjects: {
        some: {
          status: SubjectVerificationStatus.APPROVED,
          isOpenForBooking: true,
          levels: {
            some: {
              level: { name: { contains: rawQuery, mode: "insensitive" } },
            },
          },
        },
      },
    },
  ];
  if (isLanguageCode) {
    secondaryOr.push({ languages: { has: upperQuery } });
  }

  const secondaryRows = await prisma.tutorProfile.findMany({
    where: {
      ...hardVisibilityFilter(),
      OR: secondaryOr,
    },
    select: { id: true },
  });

  for (const row of secondaryRows) {
    if (!ranks.has(row.id)) ranks.set(row.id, { matchRank: 2, similarity: 0 });
  }

  return ranks;
}

async function fetchCandidatePageWithTextRank(
  structuredWhere: any,
  ranks: Map<string, TextMatchRank>,
  cursor: string | undefined,
  limit: number
) {
  const candidates = await prisma.tutorProfile.findMany({
    where: { ...structuredWhere, id: { in: Array.from(ranks.keys()) } },
    select: CANDIDATE_SELECT,
    take: TEXT_CANDIDATE_POOL_SIZE,
  });

  const sorted = candidates.sort((a, b) => {
    const ra = ranks.get(a.id)!;
    const rb = ranks.get(b.id)!;
    if (ra.matchRank !== rb.matchRank) return ra.matchRank - rb.matchRank;
    if (ra.similarity !== rb.similarity) return rb.similarity - ra.similarity;
    return (Number(b.compositeScore) || 0) - (Number(a.compositeScore) || 0);
  });

  const startIndex = cursor ? sorted.findIndex((c) => c.id === cursor) + 1 : 0;
  return sorted.slice(startIndex, startIndex + limit + 1);
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
      !query.gender &&
      !query.availability;

    if (isUnfiltered && !query.cityId && context.searcherCityId) {
      effectiveQuery.cityId = context.searcherCityId;
    }

    const structuredWhere = buildStructuredWhere({
      ...effectiveQuery,
      q: undefined,
    } as any);

    // Text-ranked path — deliberately uncached (a ranked Map isn't cheap
    // to serialize/rehydrate correctly, and typed queries are cheap to
    // recompute); structured-only searches keep using Redis as before.
    if (effectiveQuery.q) {
      const ranks = await rankTextMatches(effectiveQuery.q);
      if (ranks.size === 0) {
        return this.buildZeroResultResponse(effectiveQuery, context.userId);
      }

      const candidates = await fetchCandidatePageWithTextRank(
        structuredWhere,
        ranks,
        query.cursor,
        query.limit
      );
      const hasNextPage = candidates.length > query.limit;
      const page = hasNextPage ? candidates.slice(0, query.limit) : candidates;

      if (page.length === 0) {
        return this.buildZeroResultResponse(effectiveQuery, context.userId);
      }

      return {
        data: page.map(toResultCard),
        meta: {
          nextCursor: hasNextPage ? page[page.length - 1].id : null,
          hasNextPage,
          limit: query.limit,
          refineNudge: ranks.size > REFINE_NUDGE_THRESHOLD,
        },
      };
    }

    const cacheKey = await buildSearchCacheKey(
      effectiveQuery.cityId ?? null,
      effectiveQuery as any
    );
    const cached = await getCachedSearchResult<any>(cacheKey);
    if (cached) return cached;

    const candidates = await fetchCandidatePage(
      structuredWhere,
      query.cursor,
      query.limit
    );
    const hasNextPage = candidates.length > query.limit;
    const page = hasNextPage ? candidates.slice(0, query.limit) : candidates;

    if (page.length === 0) {
      const result = await this.buildZeroResultResponse(
        effectiveQuery,
        context.userId
      );
      await setCachedSearchResult(cacheKey, result);
      return result;
    }

    const totalMatching = await prisma.tutorProfile.count({
      where: structuredWhere,
    });

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
};

export default TutorSearchService;
