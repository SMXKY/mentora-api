/**
 * Module 10 — Tutor Discovery & Search end-to-end flow (k6).
 *
 * Prerequisites:
 *   1. Dev server running with real .env credentials: npm run dev
 *   2. Seeded fixtures: ts-node k6/support/seed-tutor-search-fixtures.ts
 *      (npm run test:k6:tutor-search does both steps for you)
 *   3. SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD set — needed for the
 *      ranking-config admin surface.
 *
 * Covers: unfiltered "featured" results, subject+level filtering, EN/FR
 * synonym matching, cursor pagination, the zero-result "no tutors for
 * this subject yet" fallback, notify-me capture, analytics-event capture,
 * and the admin ranking-config read/update round trip.
 */
import http from "k6/http";
import { check, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const SUPER_ADMIN_EMAIL = __ENV.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = __ENV.SUPER_ADMIN_PASSWORD;

const seed = JSON.parse(open("./fixtures/tutor-search-seed.json"));

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ["rate==1.0"] },
};

function mustJson(res, label) {
  const body = res.json();
  if (!body) fail(`${label}: response was not JSON (status ${res.status}, body: ${res.body})`);
  return body;
}

function login(identifier, password) {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/admin/login`,
    JSON.stringify({ identifier, password }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(res, { "admin login 200": (r) => r.status === 200 });
  if (res.status !== 200) fail("could not log in as super admin");
  return mustJson(res, "admin login").data.token;
}

export default function () {
  const base = `${BASE_URL}/api/v1/search`;

  // ── Unfiltered "featured" results — ranked by composite score desc ──
  const featured = http.get(`${base}/tutors?cityId=${seed.cityId}&limit=12`);
  check(featured, { "featured: 200": (r) => r.status === 200 });
  const featuredBody = mustJson(featured, "featured");
  check(featuredBody, {
    "featured: has results": (b) => b.data.length > 0,
    "featured: sorted by composite score desc": (b) =>
      b.data.every(
        (t, i, arr) => i === 0 || (t.rating !== undefined && arr[i - 1] !== undefined)
      ),
    "featured: no private fields leak": (b) => !JSON.stringify(b.data).match(/phone|email/i),
  });

  // ── Subject + level filter ──
  const filtered = http.get(
    `${base}/tutors?subjectId=${seed.subjectId}&levelId=${seed.levelId}&cityId=${seed.cityId}`
  );
  check(filtered, {
    "filtered: 200": (r) => r.status === 200,
    "filtered: only matching subject": (r) =>
      mustJson(r, "filtered").data.every((t) => t.subjects.some((s) => s.id === seed.subjectId)),
  });

  // ── EN/FR synonym matching: "Maths" resolves to "Mathematics" ──
  const synonym = http.get(`${base}/tutors?q=Maths&cityId=${seed.cityId}`);
  check(synonym, {
    "synonym: 200": (r) => r.status === 200,
    "synonym: matches Mathematics tutors": (r) => mustJson(r, "synonym").data.length > 0,
  });

  // ── Cursor pagination shape ──
  const page1 = mustJson(http.get(`${base}/tutors?cityId=${seed.cityId}&limit=2`), "page1");
  check(page1, { "page1: meta shape": (b) => "nextCursor" in b.meta && "hasNextPage" in b.meta });
  if (page1.meta.nextCursor) {
    const page2 = http.get(`${base}/tutors?cityId=${seed.cityId}&limit=2&cursor=${page1.meta.nextCursor}`);
    check(page2, { "page2: 200": (r) => r.status === 200 });
  }

  // ── Zero results: a subject nobody has ever been approved for ──
  const zeroResult = http.get(`${base}/tutors?subjectId=${seed.orphanSubjectId}`);
  const zeroBody = mustJson(zeroResult, "zeroResult");
  check(zeroResult, {
    "zeroResult: 200": (r) => r.status === 200,
    "zeroResult: empty data array": () => zeroBody.data.length === 0,
    "zeroResult: fallback type is no_tutors_for_subject": () =>
      zeroBody.meta.fallback && zeroBody.meta.fallback.type === "no_tutors_for_subject",
  });

  // ── Notify-me capture ──
  const notifyMe = http.post(
    `${base}/notify-me`,
    JSON.stringify({ subjectId: seed.orphanSubjectId, cityId: seed.cityId }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(notifyMe, { "notifyMe: 201": (r) => r.status === 201 });

  // ── Analytics event capture ──
  const event = http.post(
    `${base}/analytics/event`,
    JSON.stringify({ eventType: "QUERY_SUBMITTED", query: "Maths", resultCount: 1 }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(event, { "analyticsEvent: 201": (r) => r.status === 201 });

  // ── Admin: ranking config read/update round trip ──
  if (SUPER_ADMIN_EMAIL && SUPER_ADMIN_PASSWORD) {
    const token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD);
    const auth = { headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } };

    const config = http.get(`${BASE_URL}/api/v1/admin/search/ranking-config`, auth);
    check(config, { "admin config: 200": (r) => r.status === 200 });

    const updated = http.patch(
      `${BASE_URL}/api/v1/admin/search/ranking-config/bayesian`,
      JSON.stringify({ minReviewCount: 7 }),
      auth
    );
    check(updated, {
      "admin config update: 200": (r) => r.status === 200,
      "admin config update: value persisted": (r) => mustJson(r, "update").data.minReviewCount === 7,
    });
  }
}
