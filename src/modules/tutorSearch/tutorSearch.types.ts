import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ============================================================
// Module 10 — Tutor Discovery & Search — zod schemas & types
// ============================================================

export const TeachingModeFilterEnum = z.enum(["ONLINE_ONLY", "HOME_ONLY", "BOTH"]);
export const LanguageFilterEnum = z.enum(["EN", "FR"]);
export const GenderFilterEnum = z.enum(["MALE", "FEMALE", "PREFER_NOT_TO_SAY"]);
export const AvailabilityPresetEnum = z.enum(["this_week", "this_weekend", "next_week"]);

export const SearchTutorsQuerySchema = z
  .object({
    q: z.string().trim().min(1).optional(),
    subjectId: z.string().uuid().optional(),
    levelId: z.string().uuid().optional(),
    cityId: z.string().uuid().optional(),
    mode: TeachingModeFilterEnum.optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    language: LanguageFilterEnum.optional(),
    gender: GenderFilterEnum.optional(),
    availability: AvailabilityPresetEnum.optional(),
    availabilityFrom: z.string().datetime().optional(),
    availabilityTo: z.string().datetime().optional(),
    // GPS origin for home-session geo sort, sent by the client when it
    // has location permission. See searchOrigin.resolver.ts, this is the
    // highest-priority tier ahead of the IP-based fallback.
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(8),
  })
  .openapi("SearchTutorsQuery");
export type SearchTutorsQueryInput = z.infer<typeof SearchTutorsQuerySchema>;

export const NotifyMeSchema = z
  .object({
    subjectId: z.string().uuid().optional(),
    cityId: z.string().uuid().optional(),
    query: z.string().trim().max(255).optional(),
  })
  .openapi("SearchNotifyMe");
export type NotifyMeInput = z.infer<typeof NotifyMeSchema>;

export const SearchAnalyticsEventTypeEnum = z.enum([
  "QUERY_SUBMITTED",
  "RESULT_CLICKED",
  "FILTER_CHANGED",
  "ZERO_RESULTS",
  "BOOKING_INITIATED",
]);

export const RecordSearchEventSchema = z
  .object({
    eventType: SearchAnalyticsEventTypeEnum,
    query: z.string().trim().max(255).optional(),
    filters: z.record(z.string(), z.any()).optional(),
    resultCount: z.number().int().min(0).optional(),
    position: z.number().int().min(0).optional(),
    tutorProfileId: z.string().uuid().optional(),
  })
  .openapi("RecordSearchEvent");
export type RecordSearchEventInput = z.infer<typeof RecordSearchEventSchema>;

// ── Admin: ranking configuration ────────────────────────────
export const RankingWeightsSchema = z
  .object({
    subjectMatch: z.number().min(0).max(100),
    availability: z.number().min(0).max(100),
    bayesianRating: z.number().min(0).max(100),
    responseRate: z.number().min(0).max(100),
    profileCompleteness: z.number().min(0).max(100),
    proximity: z.number().min(0).max(100),
    activityRecency: z.number().min(0).max(100),
  })
  .openapi("SearchRankingWeights");
export type RankingWeightsInput = z.infer<typeof RankingWeightsSchema>;

export const BayesianConfigSchema = z
  .object({
    minReviewCount: z.number().int().min(1),
  })
  .openapi("SearchBayesianConfig");
export type BayesianConfigInput = z.infer<typeof BayesianConfigSchema>;

export const NewTutorBoostConfigSchema = z
  .object({
    boostPoints: z.number().min(0).max(100),
    boostDurationDays: z.number().int().min(1),
    boostMaxSessions: z.number().int().min(1),
  })
  .openapi("SearchNewTutorBoostConfig");
export type NewTutorBoostConfigInput = z.infer<typeof NewTutorBoostConfigSchema>;
