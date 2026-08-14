/**
 * Mentora API — tutor search & pagination realism/load test
 * ============================================================
 *
 * Unlike permissionModule.k6.js, every route this script hits is PUBLIC
 * (no auth) and read-mostly (search, notify-me, analytics events) — there
 * is no fixture lifecycle to sequence and nothing to clean up, so this
 * runs as a single ramping-VU scenario instead of dependency-ordered
 * shared-iterations stages.
 *
 * "Realistic" here specifically means:
 *   - Filter values (subjectId/cityId/levelId, free-text q) are pulled from
 *     the live taxonomy in setup(), never random UUIDs that don't exist —
 *     a search for a subject that isn't real always returns zero results
 *     and would silently make every run look "fine" without ever
 *     exercising the actual ranking/pagination code paths.
 *   - Each VU iteration is a SESSION, not an isolated GET: submit a query
 *     (with a realistic 0-3 filter combination — real users rarely set
 *     every filter at once), record the matching search-analytics event
 *     Mentora's own frontend would fire, sleep for human think-time, then
 *     either page forward 1-3 times (following the real cursor) or click
 *     a result and sometimes simulate booking intent.
 *   - Load ramps up over time (ramping-vus) rather than a fixed iteration
 *     count, so the summary shows how p95 latency and error rate move as
 *     concurrency increases — the actual question a "does this hold up"
 *     stakeholder demo needs answered.
 *
 * USAGE
 * -----
 *   Local:
 *     k6 run k6/tutorSearch.k6.js
 *
 *   Staging/production:
 *     k6 run \
 *       -e BASE_URL=https://mentora.api.tallamichael.online \
 *       -e ALLOW_NON_LOCAL_TARGET=true \
 *       k6/tutorSearch.k6.js
 *
 * OPTIONAL ENV VARS
 * ------------------
 *   BASE_URL                default: http://localhost:8080
 *   MAX_VUS                 default: 40    — peak concurrent search sessions
 *   RAMP_UP_SECONDS          default: 60    — time to climb from 0 to MAX_VUS
 *   HOLD_SECONDS             default: 120   — time to hold at MAX_VUS
 *   RAMP_DOWN_SECONDS        default: 30    — time to drain back to 0
 *   ALLOW_NON_LOCAL_TARGET   default: false — safety rail, see setup()
 */

import http from "k6/http";
import { check, group, sleep, fail } from "k6";
import { Counter, Trend, Rate } from "k6/metrics";

// ============================================================
// CONFIG
// ============================================================

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const API = `${BASE_URL}/api/v1`;

const MAX_VUS = Number(__ENV.MAX_VUS || 40);
const RAMP_UP_SECONDS = Number(__ENV.RAMP_UP_SECONDS || 60);
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS || 120);
const RAMP_DOWN_SECONDS = Number(__ENV.RAMP_DOWN_SECONDS || 30);
const ALLOW_NON_LOCAL_TARGET = String(__ENV.ALLOW_NON_LOCAL_TARGET || "false") === "true";

const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || "20s";

function jsonHeaders() {
  return { headers: { "Content-Type": "application/json" }, timeout: REQUEST_TIMEOUT };
}

// Realistic free-text queries a real user might type that AREN'T just a
// subject name verbatim — exercises the "q" free-text path distinctly
// from the structured subjectId filter, including a couple of queries
// deliberately expected to return few/zero results (real search traffic
// always includes some of these).
const GENERIC_QUERIES = [
  "help with homework",
  "GCE preparation",
  "online tutor",
  "exam revision",
  "weekend lessons",
  "beginner French",
  "advanced maths",
  "quantum physics tutor", // intentionally unlikely to exist — zero-result path
];

const MODES = ["ONLINE_ONLY", "HOME_ONLY", "BOTH"];
const LANGUAGES = ["EN", "FR"];
const GENDERS = ["MALE", "FEMALE", "PREFER_NOT_TO_SAY"];
const AVAILABILITY_PRESETS = ["this_week", "this_weekend", "next_week"];
// XAF price bands roughly matching real agreedRateXaf scale seen elsewhere
// in the platform (booking rates in the low thousands per session).
const PRICE_BANDS = [
  [500, 2000],
  [1000, 3000],
  [2000, 5000],
  [3000, 8000],
  [5000, 15000],
];

// ============================================================
// METRICS
// ============================================================

const ROUTE_NAMES = [
  "GET /search/tutors",
  "GET /search/tutors (invalid subjectId) -> 400",
  "GET /search/tutors (limit>50) -> 400",
  "GET /search/tutors (pagination page 2+)",
  "POST /search/analytics/event",
  "POST /search/notify-me",
];

function slugify(name) {
  return name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const routeCounters = {};
for (const name of ROUTE_NAMES) {
  const slug = slugify(name);
  routeCounters[name] = {
    pass: new Counter(`route_pass__${slug}`),
    fail: new Counter(`route_fail__${slug}`),
  };
}

function verify(routeName, res, expectations) {
  const counter = routeCounters[routeName];
  if (!counter) fail(`Unknown route name "${routeName}" — add it to ROUTE_NAMES.`);
  const passed = check(res, expectations, { route: routeName });
  if (passed) {
    counter.pass.add(1);
  } else {
    counter.fail.add(1);
    console.error(`[FAIL] ${routeName} -> status=${res.status} body=${(res.body || "").slice(0, 300)}`);
  }
  return passed;
}

// Realism metrics — the actual questions a "does search feel real" review
// cares about, not just pass/fail.
const resultCountTrend = new Trend("search_result_count");
const paginationDepthTrend = new Trend("search_pagination_depth");
const zeroResultRate = new Rate("search_zero_result_rate");

// ============================================================
// SETUP — fetch real taxonomy once, single-threaded, so every VU
// filters against subjects/cities/levels that actually exist.
// ============================================================

export function setup() {
  const isLocalTarget = /localhost|127\.0\.0\.1/.test(BASE_URL);
  if (!isLocalTarget && !ALLOW_NON_LOCAL_TARGET) {
    fail(
      `BASE_URL "${BASE_URL}" does not look like a local server. Re-run with ` +
        "-e ALLOW_NON_LOCAL_TARGET=true once you've confirmed this is the target " +
        "you actually intend to load-test — this hits real infrastructure at concurrency."
    );
  }

  console.log(`[setup] target: ${BASE_URL}`);

  const subjectsRes = http.get(`${API}/subjects`, jsonHeaders());
  const citiesRes = http.get(`${API}/cities`, jsonHeaders());
  const levelsRes = http.get(`${API}/levels`, jsonHeaders());

  const subjects = subjectsRes.status === 200 ? subjectsRes.json("data") || [] : [];
  const cities = citiesRes.status === 200 ? citiesRes.json("data") || [] : [];
  const levels = levelsRes.status === 200 ? levelsRes.json("data") || [] : [];

  if (subjects.length === 0) {
    fail("[setup] /subjects returned no rows — is the catalog seeded on this target?");
  }

  console.log(
    `[setup] taxonomy loaded — subjects=${subjects.length} cities=${cities.length} levels=${levels.length}`
  );

  return {
    subjectIds: subjects.map((s) => s.id),
    subjectNames: subjects.map((s) => s.name).filter(Boolean),
    cityIds: cities.map((c) => c.id),
    levelIds: levels.map((l) => l.id),
  };
}

// ============================================================
// HELPERS — build a realistic, varied (not maximal) filter set.
// Real users apply 0-3 filters, not all 8 at once.
// ============================================================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function maybe(probability) {
  return Math.random() < probability;
}

function buildRealisticQuery(data) {
  const query = { limit: pick([8, 8, 8, 20, 50]) }; // most sessions use the default page size

  // Free-text search ~40% of sessions: half the time a real subject name
  // (the common case — user typed what they're looking for), half the
  // time a generic phrase (including the deliberately-zero-result one).
  if (maybe(0.4)) {
    query.q = maybe(0.5) && data.subjectNames.length > 0 ? pick(data.subjectNames) : pick(GENERIC_QUERIES);
  }

  if (maybe(0.5) && data.subjectIds.length > 0) query.subjectId = pick(data.subjectIds);
  if (maybe(0.2) && data.levelIds.length > 0) query.levelId = pick(data.levelIds);
  if (maybe(0.3) && data.cityIds.length > 0) query.cityId = pick(data.cityIds);
  if (maybe(0.3)) query.mode = pick(MODES);
  if (maybe(0.25)) query.language = pick(LANGUAGES);
  if (maybe(0.15)) query.gender = pick(GENDERS);
  if (maybe(0.2)) query.availability = pick(AVAILABILITY_PRESETS);
  if (maybe(0.25)) {
    const [minPrice, maxPrice] = pick(PRICE_BANDS);
    query.minPrice = minPrice;
    query.maxPrice = maxPrice;
  }

  return query;
}

function toQueryString(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

function recordEvent(eventType, extra) {
  const res = http.post(
    `${API}/search/analytics/event`,
    JSON.stringify({ eventType, ...extra }),
    jsonHeaders()
  );
  verify("POST /search/analytics/event", res, {
    "status is 201": (r) => r.status === 201,
  });
}

// ============================================================
// MAIN SCENARIO — one realistic search session per iteration.
// ============================================================

export function searchSession(data) {
  const filters = buildRealisticQuery(data);

  let res;
  group("search > GET /tutors (initial query)", () => {
    res = http.get(`${API}/search/tutors?${toQueryString(filters)}`, jsonHeaders());
    verify("GET /search/tutors", res, {
      "status is 200": (r) => r.status === 200,
      "data is array": (r) => Array.isArray(r.json("data")),
      "limit respected": (r) => (r.json("data") || []).length <= filters.limit,
    });
  });

  if (res.status !== 200) return;

  const results = res.json("data") || [];
  const meta = res.json("meta") || {};
  resultCountTrend.add(results.length);
  zeroResultRate.add(results.length === 0);

  recordEvent("QUERY_SUBMITTED", { query: filters.q, filters, resultCount: results.length });

  // Human think-time before reacting to the results page.
  sleep(1 + Math.random() * 2);

  if (results.length === 0) {
    group("search > zero-result follow-up", () => {
      recordEvent("ZERO_RESULTS", { query: filters.q, filters, resultCount: 0 });
      // Real UI offers "notify me" on a dead-end search — some fraction of
      // users actually take it.
      if (maybe(0.3)) {
        const notifyRes = http.post(
          `${API}/search/notify-me`,
          JSON.stringify({ subjectId: filters.subjectId, cityId: filters.cityId, query: filters.q }),
          jsonHeaders()
        );
        verify("POST /search/notify-me", notifyRes, {
          "status is 201": (r) => r.status === 201,
        });
      }
    });
    return;
  }

  // Click a result at a realistic position (real users click near the top
  // far more often than page 3) — weight toward low indices.
  const clickIndex = Math.min(results.length - 1, Math.floor(Math.random() * Math.random() * results.length));
  recordEvent("RESULT_CLICKED", {
    query: filters.q,
    filters,
    resultCount: results.length,
    position: clickIndex,
    tutorProfileId: results[clickIndex]?.id,
  });

  sleep(1 + Math.random() * 3);

  if (maybe(0.15)) {
    recordEvent("BOOKING_INITIATED", {
      resultCount: results.length,
      position: clickIndex,
      tutorProfileId: results[clickIndex]?.id,
    });
  }

  // Page forward 0-3 times through real cursors, mimicking a user
  // scrolling further when the first page didn't have what they wanted.
  let cursor = meta.nextCursor;
  let hasNextPage = meta.hasNextPage;
  let pagesFollowed = 0;
  const maxPagesThisSession = Math.floor(Math.random() * 4); // 0-3

  while (hasNextPage && cursor && pagesFollowed < maxPagesThisSession) {
    sleep(0.5 + Math.random() * 1.5); // scroll/read time between pages
    const pageFilters = { ...filters, cursor };
    const pageRes = http.get(`${API}/search/tutors?${toQueryString(pageFilters)}`, jsonHeaders());
    const ok = verify("GET /search/tutors (pagination page 2+)", pageRes, {
      "status is 200": (r) => r.status === 200,
      "no duplicate of previous cursor": (r) => r.json("meta.nextCursor") !== cursor,
    });
    if (!ok) break;
    pagesFollowed += 1;
    cursor = pageRes.json("meta.nextCursor");
    hasNextPage = pageRes.json("meta.hasNextPage");

    if (maybe(0.2)) recordEvent("FILTER_CHANGED", { filters, resultCount: (pageRes.json("data") || []).length });
  }

  paginationDepthTrend.add(pagesFollowed);
}

// ============================================================
// VALIDATION EDGE CASES — run at low frequency alongside the main
// session traffic so every run also proves input validation still
// rejects bad requests correctly, not just that happy-path search works.
// ============================================================

export function validationEdgeCases() {
  group("search > invalid subjectId -> 400", () => {
    const res = http.get(`${API}/search/tutors?subjectId=not-a-uuid`, jsonHeaders());
    verify("GET /search/tutors (invalid subjectId) -> 400", res, {
      "status is 400": (r) => r.status === 400,
    });
  });

  group("search > limit over max -> 400", () => {
    const res = http.get(`${API}/search/tutors?limit=51`, jsonHeaders());
    verify("GET /search/tutors (limit>50) -> 400", res, {
      "status is 400": (r) => r.status === 400,
    });
  });
}

// ============================================================
// SCENARIOS
// ============================================================

export const options = {
  scenarios: {
    search_sessions: {
      executor: "ramping-vus",
      exec: "searchSession",
      startVUs: 0,
      stages: [
        { duration: `${RAMP_UP_SECONDS}s`, target: MAX_VUS },
        { duration: `${HOLD_SECONDS}s`, target: MAX_VUS },
        { duration: `${RAMP_DOWN_SECONDS}s`, target: 0 },
      ],
      gracefulRampDown: "10s",
    },
    validation_edge_cases: {
      executor: "constant-vus",
      exec: "validationEdgeCases",
      vus: 1,
      duration: `${RAMP_UP_SECONDS + HOLD_SECONDS + RAMP_DOWN_SECONDS}s`,
    },
  },
  thresholds: {
    // Validation/shape checks should never fail regardless of load.
    checks: ["rate>0.98"],
    "http_req_duration{route:GET /search/tutors (initial query)}": ["p(95)<1500"],
  },
};

// ============================================================
// SUMMARY
// ============================================================

export function handleSummary(summaryData) {
  const lines = [];
  lines.push("");
  lines.push("================ MENTORA API — TUTOR SEARCH LOAD TEST ================");
  lines.push(`Target: ${BASE_URL}`);
  lines.push(`Peak VUs: ${MAX_VUS}  Ramp: ${RAMP_UP_SECONDS}s up / ${HOLD_SECONDS}s hold / ${RAMP_DOWN_SECONDS}s down`);

  const metrics = summaryData.metrics || {};
  const routeNames = Object.keys(routeCounters).sort();

  let totalPass = 0;
  let totalFail = 0;
  const failedRoutes = [];

  for (const name of routeNames) {
    const slug = slugify(name);
    const passMetric = metrics[`route_pass__${slug}`];
    const failMetric = metrics[`route_fail__${slug}`];
    const pass = (passMetric && passMetric.values && passMetric.values.count) || 0;
    const failCount = (failMetric && failMetric.values && failMetric.values.count) || 0;
    totalPass += pass;
    totalFail += failCount;
    const status = failCount > 0 ? "FAIL" : "PASS";
    if (failCount > 0) failedRoutes.push(name);
    lines.push(`  [${status}] ${name.padEnd(55)} pass=${pass}${failCount > 0 ? `  fail=${failCount}` : ""}`);
  }

  lines.push("-------------------------------------------------------------------");
  lines.push(`TOTAL: ${totalPass} passed, ${totalFail} failed across ${routeNames.length} routes`);

  const resultCount = metrics["search_result_count"];
  const paginationDepth = metrics["search_pagination_depth"];
  const zeroRate = metrics["search_zero_result_rate"];
  const reqDuration = metrics["http_req_duration"];

  lines.push("");
  lines.push("SEARCH REALISM METRICS");
  if (resultCount && resultCount.values) {
    lines.push(`  avg results per query:      ${resultCount.values.avg?.toFixed(1)}`);
  }
  if (paginationDepth && paginationDepth.values) {
    lines.push(`  avg pages followed/session: ${paginationDepth.values.avg?.toFixed(2)}`);
  }
  if (zeroRate && zeroRate.values) {
    lines.push(`  zero-result rate:           ${(zeroRate.values.rate * 100).toFixed(1)}%`);
  }
  if (reqDuration && reqDuration.values) {
    lines.push(`  search latency p95:         ${reqDuration.values["p(95)"]?.toFixed(0)}ms`);
    lines.push(`  search latency avg:         ${reqDuration.values.avg?.toFixed(0)}ms`);
  }

  if (failedRoutes.length > 0) {
    lines.push("");
    lines.push("ROUTES WITH FAILURES (see [FAIL] lines above in stdout for response bodies):");
    failedRoutes.forEach((r) => lines.push(`  - ${r}`));
  } else {
    lines.push("");
    lines.push("All routes passed every check. Nothing failed.");
  }
  lines.push("========================================================================");
  lines.push("");

  const report = lines.join("\n");

  return {
    stdout: report,
    "k6-tutorSearch-summary.json": JSON.stringify(summaryData, null, 2),
  };
}
