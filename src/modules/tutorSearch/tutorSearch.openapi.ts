import { registry } from "../../docs/openapi.registry";
import { z } from "zod";
import {
  SearchTutorsQuerySchema,
  NotifyMeSchema,
  RecordSearchEventSchema,
  RankingWeightsSchema,
  BayesianConfigSchema,
  NewTutorBoostConfigSchema,
} from "./tutorSearch.types";

// ============================================================
// MODULE 10 — TUTOR DISCOVERY & SEARCH — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Search"];
const adminTags = ["Search — Admin"];
const basePath = "/api/v1/search";
const adminBasePath = "/api/v1/admin/search";
const bearer = { security: [{ bearerAuth: [] }] };

registry.registerPath({
  method: "get",
  path: `${basePath}/tutors`,
  tags,
  summary: "Search/discover tutors",
  description:
    "Public — no auth required, Guests get identical results to logged-in " +
    "users. Every result is gated on kycStatus=ACTIVE, a verified intro " +
    "video, and at least one APPROVED subject — enforced at the query " +
    "level, never filtered after the fact. With no query and no filters, " +
    "returns 'featured' tutors (top composite score). Query matches name/" +
    "subjects/levels/city/neighbourhood/languages/bio, case+accent-" +
    "insensitive, with EN/FR subject synonyms resolved (Maths<->" +
    "Mathematics, Physique<->Physics, etc.) and partial matches ('Phy' -> " +
    "Physics). Ranking is entirely by the precomputed compositeScore " +
    "column (see the nightly recompute job) — never recalculated at query " +
    "time. Cursor-paginated, 8 per page by default (infinite-scroll UI) — " +
    "meta.totalCount is Meilisearch's estimated total match count for the " +
    "query+filters, independent of pagination, so the UI can show 'N " +
    "tutors found' without loading every page. Zero results returns " +
    "a graceful fallback object instead of an empty array: nearby-city " +
    "results, a 'no tutors for this subject yet' message, or the single " +
    "most restrictive filter to relax — never a bare empty page.",
  request: { query: SearchTutorsQuerySchema },
  responses: {
    200: {
      description:
        "{ data: TutorResultCard[], meta: { nextCursor, hasNextPage, limit, totalCount, refineNudge, fallback? } } " +
        "— fallback is present only on a zero-result response: " +
        "{ type: 'nearby_city', fallbackCityId, fallbackCityName } | " +
        "{ type: 'no_tutors_for_subject' } | " +
        "{ type: 'restrictive_filters', suggestedFilterToRemove }.",
    },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/notify-me`,
  tags,
  summary: "Capture a 'notify me' demand signal on a zero-result search",
  description:
    "Writes a DemandSignal row (subjectId/cityId/query, isNotifyMe=true) " +
    "surfaced on the admin unmet-demand dashboard. Works for both Guests " +
    "(userId omitted) and authenticated users.",
  request: { body: { content: { "application/json": { schema: NotifyMeSchema } } } },
  responses: { 201: { description: "Captured" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/analytics/event`,
  tags,
  summary: "Record a search analytics event",
  description:
    "QUERY_SUBMITTED, RESULT_CLICKED, FILTER_CHANGED, ZERO_RESULTS, or " +
    "BOOKING_INITIATED — stored in SearchAnalyticsEvent for ranking-weight " +
    "tuning and CTR-by-position/dead-end-query review. Never exposed to " +
    "Tutors or Parents; admin-only read surface below.",
  request: {
    body: { content: { "application/json": { schema: RecordSearchEventSchema } } },
  },
  responses: { 201: { description: "Recorded" } },
});

// ── Admin: ranking configuration ────────────────────────────
registry.registerPath({
  method: "get",
  path: `${adminBasePath}/ranking-config`,
  tags: adminTags,
  summary: "Get the current ranking weights, Bayesian config, and new-tutor-boost config",
  ...bearer,
  responses: { 200: { description: "{ weights, bayesian, newTutorBoost }" } },
});

registry.registerPath({
  method: "patch",
  path: `${adminBasePath}/ranking-config/weights`,
  tags: adminTags,
  summary: "Update the composite-score ranking weights",
  description:
    "subjectMatch, availability, bayesianRating, responseRate, " +
    "profileCompleteness, proximity, activityRecency — defaults 25/25/20/" +
    "10/10/5/5. Takes effect on the next composite-score recompute (nightly " +
    "sweep, or the next time an affected tutor's signal changes), never " +
    "retroactively at query time.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: RankingWeightsSchema } } } },
  responses: { 200: { description: "Updated weights" } },
});

registry.registerPath({
  method: "patch",
  path: `${adminBasePath}/ranking-config/bayesian`,
  tags: adminTags,
  summary: "Update the Bayesian rating minimum review-count threshold (C)",
  ...bearer,
  request: { body: { content: { "application/json": { schema: BayesianConfigSchema } } } },
  responses: { 200: { description: "Updated config" } },
});

registry.registerPath({
  method: "patch",
  path: `${adminBasePath}/ranking-config/new-tutor-boost`,
  tags: adminTags,
  summary: "Update the new-tutor boost amount, duration, and session cap",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: NewTutorBoostConfigSchema } } },
  },
  responses: { 200: { description: "Updated config" } },
});

// ── Admin: analytics ─────────────────────────────────────────
registry.registerPath({
  method: "get",
  path: `${adminBasePath}/analytics/ctr-by-position`,
  tags: adminTags,
  summary: "Click-through rate per result position",
  description:
    "Impressions at position X are approximated from QUERY_SUBMITTED " +
    "events whose resultCount exceeded X (there is no separate per-" +
    "position impression event) — used to spot ranking-signal problems " +
    "(e.g. position 1 under-performing position 3). ?windowDays defaults to 30.",
  ...bearer,
  responses: { 200: { description: "[{ position, impressions, clicks, ctr }]" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/analytics/dead-end-queries`,
  tags: adminTags,
  summary: "Queries with no resulting booking in the trailing window",
  description: "?windowDays defaults to 30, flagged for product review.",
  ...bearer,
  responses: { 200: { description: "[{ query, searchCount }]" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/analytics/top-queries`,
  tags: adminTags,
  summary: "Most-searched query text, regardless of outcome",
  description:
    "Complements dead-end-queries (which only surfaces queries that never " +
    "converted to a booking) — this is raw search volume by query text, " +
    "for spotting what people are typing overall. ?windowDays defaults to " +
    "30, ?limit defaults to 20.",
  ...bearer,
  responses: { 200: { description: "[{ query, searchCount }]" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/analytics/demand-signals`,
  tags: adminTags,
  summary: "Unmet-demand dashboard — most-requested subject/city combinations",
  description: "Sourced from DemandSignal rows captured by the zero-result 'notify me' flow.",
  ...bearer,
  responses: { 200: { description: "[{ subjectId, subjectName, cityId, cityName, count }]" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/analytics/demand-breakdown`,
  tags: adminTags,
  summary: "REQ-010-011 — search habits by subject, city, language, and teaching mode",
  description:
    "The recruitment-planning report: every real search's filters over " +
    "the trailing window (?windowDays defaults to 30), tallied by subject " +
    "and city (each split into total volume vs. the zero-result subset, " +
    "so unmet demand is visible alongside raw demand), plus a flat " +
    "language and teaching-mode breakdown (ONLINE_ONLY/HOME_ONLY/BOTH/" +
    "unspecified) — answers 'do we need to recruit tutors, and for what " +
    "subject/language/mode' directly from real user search behavior.",
  ...bearer,
  responses: {
    200: {
      description:
        "{ windowDays, totalSearches, zeroResultSearches, " +
        "bySubject: [{ subjectId, subjectName, total, zeroResult }], " +
        "byCity: [{ cityId, cityName, total, zeroResult }], " +
        "byLanguage: { [language]: count }, byMode: { [mode]: count } }",
    },
  },
});
