/**
 * Mentora API — approve already-submitted tutor KYC applications from a JSON file
 * ==================================================================================
 *
 * Standalone follow-up to createAccountsFromJson.k6.js — for tutors that
 * have ALREADY been created and already submitted KYC (i.e. you ran the
 * create script, possibly with -e SKIP_APPROVAL=true, or a prior approval
 * attempt partially failed). Does not touch registration, profile, or KYC
 * submission at all — only:
 *   1. Logs in AS each tutor (their own email/password from the JSON) to
 *      fetch their applicationId (GET /kyc/me) and tutorSubjectIds
 *      (GET /kyc/me/subjects).
 *   2. Admin approve-identity (real checklist attestation, real endpoint).
 *   3. Admin approve-subject for every subject on that tutor.
 *   4. Opens each subject for booking with pricing (search's
 *      hardVisibilityFilter requires isOpenForBooking: true — a tutor isn't
 *      searchable without this even after KYC is fully approved).
 *
 * Safe to re-run: an already-ACTIVE tutor's subjects are already APPROVED,
 * so re-approving is a no-op status-wise (the approve-subject endpoint just
 * re-confirms an already-approved row) — nothing here is destructive.
 *
 * USAGE
 * -----
 *   k6 run \
 *     -e BASE_URL=https://mentora.api.tallamichael.online \
 *     -e ALLOW_NON_LOCAL_TARGET=true \
 *     -e STAGING_ADMIN_EMAIL=... -e STAGING_ADMIN_PASSWORD=... \
 *     -e TUTORS_JSON_PATH=./data/smoke-test-5.json \
 *     -e VUS=1 \
 *     prod-k6/approveTutorsFromJson.k6.js
 *
 * REQUIRED ENV VARS
 * ------------------
 *   STAGING_ADMIN_EMAIL / STAGING_ADMIN_PASSWORD — must hold the "Super
 *     Admin" role on the target.
 *   TUTORS_JSON_PATH — same JSON file (or a slice of it) used to create
 *     the tutors — only email/password/subjectIds/rates are read from it.
 *
 * OPTIONAL ENV VARS
 * ------------------
 *   BASE_URL                default: http://localhost:8080
 *   VUS                      default: 4
 *   START_INDEX              default: 0
 *   ALLOW_NON_LOCAL_TARGET   default: false
 */

import http from "k6/http";
import { check, group, sleep, fail } from "k6";
import { Counter } from "k6/metrics";
import { SharedArray } from "k6/data";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const API = `${BASE_URL}/api/v1`;

const STAGING_ADMIN_EMAIL = __ENV.STAGING_ADMIN_EMAIL;
const STAGING_ADMIN_PASSWORD = __ENV.STAGING_ADMIN_PASSWORD;
const TUTORS_JSON_PATH = __ENV.TUTORS_JSON_PATH;

const VUS = Number(__ENV.VUS || 4);
const START_INDEX = Number(__ENV.START_INDEX || 0);
const ALLOW_NON_LOCAL_TARGET = String(__ENV.ALLOW_NON_LOCAL_TARGET || "false") === "true";
const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || "30s";

if (!TUTORS_JSON_PATH) fail("TUTORS_JSON_PATH env var is required.");

const tutors = new SharedArray("tutors", function () {
  return JSON.parse(open(TUTORS_JSON_PATH));
});
const TOTAL_TUTORS = tutors.length;
const ITERATIONS_PER_VU = Math.ceil(TOTAL_TUTORS / VUS);

const ROUTE_NAMES = [
  "POST /auth/user/login",
  "GET /kyc/me",
  "GET /kyc/me/subjects",
  "POST /admin/kyc/applications/:id/approve-identity",
  "POST /admin/kyc/subjects/:tutorSubjectId/approve",
  "PATCH /tutors/me/subjects/:subjectId",
];

function slugify(name) {
  return name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
const routeCounters = {};
for (const name of ROUTE_NAMES) {
  const slug = slugify(name);
  routeCounters[name] = { pass: new Counter(`route_pass__${slug}`), fail: new Counter(`route_fail__${slug}`) };
}
function verify(routeName, res, expectations) {
  const counter = routeCounters[routeName];
  if (!counter) fail(`Unknown route name "${routeName}" — add it to ROUTE_NAMES.`);
  const passed = check(res, expectations, { route: routeName });
  if (passed) {
    counter.pass.add(1);
  } else {
    counter.fail.add(1);
    console.error(`[FAIL] ${routeName} -> status=${res.status} body=${(res.body || "").slice(0, 400)}`);
  }
  return passed;
}
function jsonHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return { headers, timeout: REQUEST_TIMEOUT };
}

const approvalFailures = new Counter("tutor_approval_failures");

export function setup() {
  if (!STAGING_ADMIN_EMAIL || !STAGING_ADMIN_PASSWORD) {
    fail("STAGING_ADMIN_EMAIL / STAGING_ADMIN_PASSWORD env vars are required.");
  }
  const isLocalTarget = /localhost|127\.0\.0\.1/.test(BASE_URL);
  if (!isLocalTarget && !ALLOW_NON_LOCAL_TARGET) {
    fail(`BASE_URL "${BASE_URL}" does not look local — re-run with -e ALLOW_NON_LOCAL_TARGET=true once confirmed.`);
  }

  console.log(`[setup] target: ${BASE_URL}`);
  console.log(`[setup] ${TOTAL_TUTORS} tutors loaded from ${TUTORS_JSON_PATH}, ${VUS} VUs, START_INDEX=${START_INDEX}`);

  const loginRes = http.post(
    `${API}/auth/admin/login`,
    JSON.stringify({ identifier: STAGING_ADMIN_EMAIL, password: STAGING_ADMIN_PASSWORD }),
    jsonHeaders()
  );
  if (loginRes.status !== 200) {
    fail(`[setup] admin login failed (status ${loginRes.status}): ${loginRes.body}`);
  }
  console.log("[setup] admin login confirmed.");

  return { adminToken: loginRes.json("data.token") };
}

export function approveTutorFromRecord(data) {
  const globalIndex = (__VU - 1) * ITERATIONS_PER_VU + __ITER;
  if (globalIndex >= TOTAL_TUTORS) return;
  if (globalIndex < START_INDEX) return;

  const t = tutors[globalIndex];
  let ok = true;
  let tutorToken;

  group("tutor login", () => {
    const res = http.post(
      `${API}/auth/user/login`,
      JSON.stringify({ identifier: t.email, password: t.password }),
      jsonHeaders()
    );
    ok = verify("POST /auth/user/login", res, {
      "status is 200": (r) => r.status === 200,
      "token present": (r) => !!r.json("data.token"),
    });
    if (ok) tutorToken = res.json("data.token");
  });
  if (!ok) return fail_(globalIndex, t);

  let applicationId;
  group("fetch application", () => {
    const res = http.get(`${API}/kyc/me`, jsonHeaders(tutorToken));
    ok = verify("GET /kyc/me", res, { "status is 200": (r) => r.status === 200, "id present": (r) => !!r.json("data.id") });
    if (ok) applicationId = res.json("data.id");
  });
  if (!ok) return fail_(globalIndex, t);

  let tutorSubjectIds = [];
  group("fetch subjects", () => {
    const res = http.get(`${API}/kyc/me/subjects`, jsonHeaders(tutorToken));
    ok = verify("GET /kyc/me/subjects", res, { "status is 200": (r) => r.status === 200 });
    if (ok) tutorSubjectIds = (res.json("data") || []).map((row) => row.id);
  });
  if (!ok || tutorSubjectIds.length === 0) return fail_(globalIndex, t);

  sleep(0.2);

  group("admin approve identity", () => {
    const res = http.post(
      `${API}/admin/kyc/applications/${applicationId}/approve-identity`,
      JSON.stringify({
        checklist: {
          cniNumberMatchesDocument: true,
          selfieMatchesCniPhoto: true,
          documentTypeMatchesDeclaration: true,
          degreeMatchesFieldOfStudy: true,
          subjectsSupportedByCredentials: true,
        },
      }),
      jsonHeaders(data.adminToken)
    );
    // Already-IDENTITY_APPROVED-or-later on a re-run isn't a failure worth
    // stopping the pipeline over — assertValidTransition would 409/400 on
    // an invalid transition, which just means this step is already done.
    ok = res.status === 200 || res.status === 400 || res.status === 409;
    verify("POST /admin/kyc/applications/:id/approve-identity", res, {
      "status is 200 or already-approved": () => ok,
    });
  });
  if (!ok) return fail_(globalIndex, t);

  let allApproved = true;
  for (const tutorSubjectId of tutorSubjectIds) {
    const body = t.trainWeight != null ? JSON.stringify({ trainWeight: t.trainWeight }) : JSON.stringify({});
    const res = http.post(`${API}/admin/kyc/subjects/${tutorSubjectId}/approve`, body, jsonHeaders(data.adminToken));
    const subOk = res.status === 200 || res.status === 400 || res.status === 409;
    verify("POST /admin/kyc/subjects/:tutorSubjectId/approve", res, { "status is 200 or already-approved": () => subOk });
    allApproved = subOk && allApproved;
  }
  if (!allApproved) return fail_(globalIndex, t);

  let allPricingSet = true;
  for (const subjectId of t.subjectIds) {
    const res = http.patch(
      `${API}/tutors/me/subjects/${subjectId}`,
      JSON.stringify({ ratePerOnlineHourXaf: t.ratePerOnlineHourXaf, ratePerHomeHourXaf: t.ratePerHomeHourXaf, isOpenForBooking: true }),
      jsonHeaders(tutorToken)
    );
    allPricingSet = verify("PATCH /tutors/me/subjects/:subjectId", res, { "status is 200": (r) => r.status === 200 }) && allPricingSet;
  }

  console.log(JSON.stringify({ event: "tutor_approved", index: globalIndex, email: t.email, pricingSet: allPricingSet, timestamp: new Date().toISOString() }));
}

function fail_(globalIndex, t) {
  approvalFailures.add(1);
  console.error(JSON.stringify({ event: "tutor_approval_failed", index: globalIndex, email: t.email, timestamp: new Date().toISOString() }));
}

export const options = {
  scenarios: {
    approve_tutors: {
      executor: "per-vu-iterations",
      exec: "approveTutorFromRecord",
      vus: VUS,
      iterations: ITERATIONS_PER_VU,
      maxDuration: "6h",
    },
  },
  thresholds: {
    tutor_approval_failures: [`count<${Math.max(1, Math.ceil(TOTAL_TUTORS * 0.1))}`],
  },
};

export function handleSummary(summaryData) {
  const lines = [];
  lines.push("");
  lines.push("================ MENTORA API — APPROVE FROM JSON SUMMARY ================");
  lines.push(`Target: ${BASE_URL}`);
  lines.push(`Records: ${TOTAL_TUTORS} from ${TUTORS_JSON_PATH}, ${VUS} VUs, START_INDEX=${START_INDEX}`);

  const metrics = summaryData.metrics || {};
  const routeNames = Object.keys(routeCounters).sort();
  let totalPass = 0, totalFail = 0;
  const failedRoutes = [];
  for (const name of routeNames) {
    const slug = slugify(name);
    const pass = (metrics[`route_pass__${slug}`]?.values?.count) || 0;
    const failCount = (metrics[`route_fail__${slug}`]?.values?.count) || 0;
    totalPass += pass;
    totalFail += failCount;
    if (failCount > 0) failedRoutes.push(name);
    lines.push(`  [${failCount > 0 ? "FAIL" : "PASS"}] ${name.padEnd(55)} pass=${pass}${failCount > 0 ? `  fail=${failCount}` : ""}`);
  }
  lines.push("-------------------------------------------------------------------");
  lines.push(`TOTAL calls: ${totalPass} passed, ${totalFail} failed`);

  const failed = metrics["tutor_approval_failures"]?.values?.count || 0;
  lines.push("");
  lines.push(`Tutor approvals failed: ${failed}`);
  lines.push("===========================================================================");

  return { stdout: lines.join("\n"), "prod-k6/logs/k6-approve-summary.json": JSON.stringify(summaryData, null, 2) };
}
