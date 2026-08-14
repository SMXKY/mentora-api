/**
 * Mentora API — create tutor accounts + submit KYC from a pre-built JSON file
 * ============================================================================
 *
 * Consumes a JSON array of tutor records (schema documented in
 * prod-k6/README.md) and a local folder of photos, and for each record:
 *   1. POST /auth/staging/create — creates the account (no OTP, no email).
 *   2. PATCH /tutors/me — profile completion.
 *   3. PATCH /users/me/profile-picture — the record's own photo.
 *   4. POST /tutors/me/intro-video — placeholder video (not your photo set).
 *   5. KYC steps 1-3 — placeholder CNI/certificate documents, the record's
 *      own photo reused as the selfie, background info + credentials from
 *      the JSON.
 *   6. POST /kyc/me/submit.
 *   7. Admin approve-identity + approve-subject(s) + open each subject for
 *      booking — included because a tutor isn't searchable without it (see
 *      hardVisibilityFilter in tutorSearch.service.ts). Drop steps 7 by
 *      setting -e SKIP_APPROVAL=true if you want creation+KYC-submission
 *      only, with approval done separately later.
 *
 * This script does not generate names, subjects, or images — all of that
 * comes from your JSON file and photo folder.
 *
 * USAGE
 * -----
 *   k6 run \
 *     -e BASE_URL=https://mentora.api.tallamichael.online \
 *     -e ALLOW_NON_LOCAL_TARGET=true \
 *     -e STAGING_ADMIN_EMAIL=... -e STAGING_ADMIN_PASSWORD=... \
 *     -e TUTORS_JSON_PATH=./data/tutors.json \
 *     -e PHOTOS_DIR=./assets/tutor-photos \
 *     -e VUS=4 \
 *     prod-k6/createAccountsFromJson.k6.js 2>&1 | tee prod-k6/logs/run-$(date +%Y%m%d-%H%M%S).log
 *
 * REQUIRED ENV VARS
 * ------------------
 *   STAGING_ADMIN_EMAIL / STAGING_ADMIN_PASSWORD — must be an account holding
 *     the "Super Admin" role on the target server, or every staging/create
 *     call 403s.
 *   TUTORS_JSON_PATH — path to your generated JSON array.
 *   PHOTOS_DIR — folder containing every photoFileName referenced in the JSON.
 *
 * OPTIONAL ENV VARS
 * ------------------
 *   BASE_URL                default: http://localhost:8080
 *   VUS                      default: 4
 *   START_INDEX              default: 0 — resume support, same as
 *                            seedStressTutors.k6.js (see README).
 *   SKIP_APPROVAL             default: false
 *   ALLOW_NON_LOCAL_TARGET   default: false
 */

import http from "k6/http";
import { check, group, sleep, fail } from "k6";
import { Counter, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";

// ============================================================
// CONFIG
// ============================================================

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const API = `${BASE_URL}/api/v1`;

const STAGING_ADMIN_EMAIL = __ENV.STAGING_ADMIN_EMAIL;
const STAGING_ADMIN_PASSWORD = __ENV.STAGING_ADMIN_PASSWORD;
const TUTORS_JSON_PATH = __ENV.TUTORS_JSON_PATH;
const PHOTOS_DIR = (__ENV.PHOTOS_DIR || "./assets/tutor-photos").replace(/\/+$/, "");

const VUS = Number(__ENV.VUS || 4);
const START_INDEX = Number(__ENV.START_INDEX || 0);
const SKIP_APPROVAL = String(__ENV.SKIP_APPROVAL || "false") === "true";
const ALLOW_NON_LOCAL_TARGET = String(__ENV.ALLOW_NON_LOCAL_TARGET || "false") === "true";
const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || "30s";

if (!TUTORS_JSON_PATH) fail("TUTORS_JSON_PATH env var is required.");

// ============================================================
// DATA — the tutor record array, shared (not duplicated) across VUs.
// ============================================================

const tutors = new SharedArray("tutors", function () {
  return JSON.parse(open(TUTORS_JSON_PATH));
});

const TOTAL_TUTORS = tutors.length;
const ITERATIONS_PER_VU = Math.ceil(TOTAL_TUTORS / VUS);

// ============================================================
// STATIC PLACEHOLDER ASSETS (not from your photo set — these are the
// generic document/video placeholders, unchanged from before).
// ============================================================

const ASSET_DIR = "./assets";
const introVideoBin = open(`${ASSET_DIR}/placeholder-intro.mp4`, "b");
const cniFrontBin = open(`${ASSET_DIR}/placeholder-cni-front.jpg`, "b");
const cniBackBin = open(`${ASSET_DIR}/placeholder-cni-back.jpg`, "b");
const certificatePdfBin = open(`${ASSET_DIR}/placeholder-certificate.pdf`, "b");

// ============================================================
// PHOTO PRELOAD — every unique photoFileName referenced in the JSON,
// opened once here at init context (required — k6 only allows open()
// during initialization, not inside the exported iteration function).
// ============================================================

const photoBinByFileName = {};
for (const t of tutors) {
  if (t.photoFileName && !(t.photoFileName in photoBinByFileName)) {
    photoBinByFileName[t.photoFileName] = open(`${PHOTOS_DIR}/${t.photoFileName}`, "b");
  }
}

// ============================================================
// METRICS
// ============================================================

const ROUTE_NAMES = [
  "POST /auth/staging/create",
  "PATCH /tutors/me",
  "PATCH /users/me/profile-picture",
  "POST /tutors/me/intro-video",
  "POST /kyc/me/step-1",
  "POST /kyc/me/step-2",
  "POST /kyc/me/credentials",
  "POST /kyc/me/submit",
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

const pipelineDuration = new Trend("tutor_pipeline_duration_ms");
const pipelineFailures = new Counter("tutor_pipeline_failures");

function jsonHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return { headers, timeout: REQUEST_TIMEOUT };
}
function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` }, timeout: REQUEST_TIMEOUT };
}

// ============================================================
// SETUP
// ============================================================

export function setup() {
  if (!STAGING_ADMIN_EMAIL || !STAGING_ADMIN_PASSWORD) {
    fail("STAGING_ADMIN_EMAIL / STAGING_ADMIN_PASSWORD env vars are required.");
  }

  const isLocalTarget = /localhost|127\.0\.0\.1/.test(BASE_URL);
  if (!isLocalTarget && !ALLOW_NON_LOCAL_TARGET) {
    fail(
      `BASE_URL "${BASE_URL}" does not look like a local server, and this script creates ` +
        "real accounts and real KYC applications. Re-run with -e ALLOW_NON_LOCAL_TARGET=true " +
        "once you've confirmed this is the right target."
    );
  }

  console.log(`[setup] target: ${BASE_URL}`);
  console.log(`[setup] ${TOTAL_TUTORS} tutors loaded from ${TUTORS_JSON_PATH}, ${VUS} VUs, START_INDEX=${START_INDEX}`);
  console.log(`[setup] ${Object.keys(photoBinByFileName).length} unique photos preloaded from ${PHOTOS_DIR}`);

  const loginRes = http.post(
    `${API}/auth/login`,
    JSON.stringify({ identifier: STAGING_ADMIN_EMAIL, password: STAGING_ADMIN_PASSWORD }),
    jsonHeaders()
  );
  if (loginRes.status !== 200) {
    fail(`[setup] admin login failed (status ${loginRes.status}): ${loginRes.body}`);
  }
  const adminToken = loginRes.json("data.token");

  // Confirm the staging endpoint is actually reachable/authorized for this
  // account before burning any real accounts on a config that's wrong.
  const probeRes = http.post(
    `${API}/auth/staging/create`,
    JSON.stringify({
      email: `staging-probe-${Date.now()}@k6.mentora.test`,
      firstName: "Probe",
      lastName: "Probe",
      role: "Student",
      password: "ProbeCheck!2026",
    }),
    jsonHeaders(adminToken)
  );
  if (probeRes.status === 404) {
    fail(
      "[setup] POST /auth/staging/create is not registered on this target — " +
        "STAGING_AUTH=true must be set in the target's env, and the app restarted, " +
        "before this script can run."
    );
  }
  if (probeRes.status === 403) {
    fail(
      "[setup] POST /auth/staging/create rejected this admin account (403) — " +
        "STAGING_ADMIN_EMAIL must be an account holding the Super Admin role on this target."
    );
  }
  if (probeRes.status !== 201) {
    fail(`[setup] staging/create probe failed unexpectedly (status ${probeRes.status}): ${probeRes.body}`);
  }
  console.log("[setup] staging/create endpoint confirmed reachable and authorized.");

  return { adminToken };
}

// ============================================================
// MAIN PIPELINE
// ============================================================

export function createTutorFromRecord(data) {
  const globalIndex = (__VU - 1) * ITERATIONS_PER_VU + __ITER;
  if (globalIndex >= TOTAL_TUTORS) return;
  if (globalIndex < START_INDEX) return;

  const t = tutors[globalIndex];
  const startedAt = Date.now();
  let ok = true;
  let tutorToken;

  group("staging create", () => {
    const res = http.post(
      `${API}/auth/staging/create`,
      JSON.stringify({ email: t.email, firstName: t.firstName, lastName: t.lastName, role: "Tutor", password: t.password }),
      jsonHeaders(data.adminToken)
    );
    ok = verify("POST /auth/staging/create", res, {
      "status is 201": (r) => r.status === 201,
      "token present": (r) => !!r.json("data.token"),
    });
    if (ok) tutorToken = res.json("data.token");
  });
  if (!ok) return finishFailed(globalIndex, t, startedAt);

  group("profile", () => {
    const res = http.patch(
      `${API}/tutors/me`,
      JSON.stringify({
        bio: t.bio,
        teachingMode: t.teachingMode,
        cityId: t.cityId,
        languages: t.languages,
        yearsOfExperience: t.yearsOfExperience,
      }),
      jsonHeaders(tutorToken)
    );
    ok = verify("PATCH /tutors/me", res, { "status is 200": (r) => r.status === 200 });
  });
  if (!ok) return finishFailed(globalIndex, t, startedAt);

  const photoBin = photoBinByFileName[t.photoFileName];
  if (!photoBin) {
    console.error(`[FAIL] missing photo file for index ${globalIndex}: ${t.photoFileName}`);
    return finishFailed(globalIndex, t, startedAt);
  }

  group("profile picture", () => {
    const res = http.patch(
      `${API}/users/me/profile-picture`,
      { profilePicture: http.file(photoBin, t.photoFileName, "image/jpeg") },
      authHeader(tutorToken)
    );
    ok = verify("PATCH /users/me/profile-picture", res, { "status is 200": (r) => r.status === 200 });
  });
  if (!ok) return finishFailed(globalIndex, t, startedAt);

  group("intro video", () => {
    const res = http.post(
      `${API}/tutors/me/intro-video`,
      { video: http.file(introVideoBin, "intro.mp4", "video/mp4") },
      authHeader(tutorToken)
    );
    ok = verify("POST /tutors/me/intro-video", res, { "status is 200": (r) => r.status === 200 });
  });
  if (!ok) return finishFailed(globalIndex, t, startedAt);

  let applicationId;
  group("kyc step 1", () => {
    const res = http.post(
      `${API}/kyc/me/step-1`,
      {
        idDocumentType: "ORIGINAL_CNI",
        cniNumber: t.cniNumber,
        cniFront: http.file(cniFrontBin, "cni-front.jpg", "image/jpeg"),
        cniBack: http.file(cniBackBin, "cni-back.jpg", "image/jpeg"),
        selfie: http.file(photoBin, t.photoFileName, "image/jpeg"),
        nonConvictionCertificate: http.file(certificatePdfBin, "non-conviction.pdf", "application/pdf"),
      },
      authHeader(tutorToken)
    );
    ok = verify("POST /kyc/me/step-1", res, {
      "status is 200": (r) => r.status === 200,
      "application id present": (r) => !!r.json("data.id"),
    });
    if (ok) applicationId = res.json("data.id");
  });
  if (!ok) return finishFailed(globalIndex, t, startedAt);

  group("kyc step 2", () => {
    const res = http.post(
      `${API}/kyc/me/step-2`,
      JSON.stringify({
        fullLegalName: t.fullLegalName,
        surname: t.lastName,
        dob: new Date(t.dob).toISOString(),
        gender: t.gender,
        placeOfBirth: t.placeOfBirth,
        currentStreet: t.currentStreet,
        currentNeighbourhood: t.currentNeighbourhood,
        currentCityId: t.cityId,
        currentRegionId: t.currentRegionId,
        cityOfOrigin: t.cityOfOrigin,
        regionOfOrigin: t.regionOfOrigin,
        emergencyContactName: t.emergencyContactName,
        emergencyContactPhone: t.emergencyContactPhone,
      }),
      jsonHeaders(tutorToken)
    );
    ok = verify("POST /kyc/me/step-2", res, { "status is 200": (r) => r.status === 200 });
  });
  if (!ok) return finishFailed(globalIndex, t, startedAt);

  group("kyc credentials", () => {
    const subjectsPayload = t.subjectIds.map((subjectId) => ({ subjectId, levelIds: t.levelIds }));
    const res = http.post(
      `${API}/kyc/me/credentials`,
      {
        institutionName: t.institutionName,
        qualificationType: t.qualificationType,
        fieldOfStudy: t.fieldOfStudy,
        yearAwarded: String(t.yearAwarded),
        subjects: JSON.stringify(subjectsPayload),
        document: http.file(certificatePdfBin, "credential.pdf", "application/pdf"),
      },
      authHeader(tutorToken)
    );
    ok = verify("POST /kyc/me/credentials", res, { "status is 201": (r) => r.status === 201 });
  });
  if (!ok) return finishFailed(globalIndex, t, startedAt);

  group("kyc submit", () => {
    const res = http.post(`${API}/kyc/me/submit`, null, jsonHeaders(tutorToken));
    ok = verify("POST /kyc/me/submit", res, { "status is 200": (r) => r.status === 200 || r.status === 201 });
  });
  if (!ok) return finishFailed(globalIndex, t, startedAt);

  if (SKIP_APPROVAL) {
    console.log(JSON.stringify({ event: "tutor_created", index: globalIndex, email: t.email, approved: false, durationMs: Date.now() - startedAt }));
    pipelineDuration.add(Date.now() - startedAt);
    return;
  }

  let tutorSubjectIds = [];
  group("fetch subjects", () => {
    const res = http.get(`${API}/kyc/me/subjects`, jsonHeaders(tutorToken));
    ok = verify("GET /kyc/me/subjects", res, { "status is 200": (r) => r.status === 200 });
    if (ok) tutorSubjectIds = (res.json("data") || []).map((row) => row.id);
  });
  if (!ok || tutorSubjectIds.length === 0) return finishFailed(globalIndex, t, startedAt);

  sleep(0.3);

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
    ok = verify("POST /admin/kyc/applications/:id/approve-identity", res, { "status is 200": (r) => r.status === 200 });
  });
  if (!ok) return finishFailed(globalIndex, t, startedAt);

  let allApproved = true;
  for (const tutorSubjectId of tutorSubjectIds) {
    const body = t.trainWeight != null ? JSON.stringify({ trainWeight: t.trainWeight }) : JSON.stringify({});
    const res = http.post(`${API}/admin/kyc/subjects/${tutorSubjectId}/approve`, body, jsonHeaders(data.adminToken));
    allApproved = verify("POST /admin/kyc/subjects/:tutorSubjectId/approve", res, { "status is 200": (r) => r.status === 200 }) && allApproved;
  }
  if (!allApproved) return finishFailed(globalIndex, t, startedAt);

  let allPricingSet = true;
  for (const subjectId of t.subjectIds) {
    const res = http.patch(
      `${API}/tutors/me/subjects/${subjectId}`,
      JSON.stringify({ ratePerOnlineHourXaf: t.ratePerOnlineHourXaf, ratePerHomeHourXaf: t.ratePerHomeHourXaf, isOpenForBooking: true }),
      jsonHeaders(tutorToken)
    );
    allPricingSet = verify("PATCH /tutors/me/subjects/:subjectId", res, { "status is 200": (r) => r.status === 200 }) && allPricingSet;
  }

  const durationMs = Date.now() - startedAt;
  pipelineDuration.add(durationMs);
  console.log(JSON.stringify({ event: "tutor_created", index: globalIndex, email: t.email, approved: true, pricingSet: allPricingSet, durationMs, timestamp: new Date().toISOString() }));
}

function finishFailed(globalIndex, t, startedAt) {
  pipelineFailures.add(1);
  console.error(JSON.stringify({ event: "tutor_pipeline_failed", index: globalIndex, email: t.email, durationMs: Date.now() - startedAt, timestamp: new Date().toISOString() }));
}

// ============================================================
// SCENARIOS
// ============================================================

export const options = {
  scenarios: {
    create_tutors: {
      executor: "per-vu-iterations",
      exec: "createTutorFromRecord",
      vus: VUS,
      iterations: ITERATIONS_PER_VU,
      maxDuration: "6h",
    },
  },
  thresholds: {
    tutor_pipeline_failures: [`count<${Math.max(1, Math.ceil(TOTAL_TUTORS * 0.1))}`],
  },
};

export function handleSummary(summaryData) {
  const lines = [];
  lines.push("");
  lines.push("================ MENTORA API — CREATE FROM JSON SUMMARY ================");
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

  const completed = metrics["tutor_pipeline_duration_ms"]?.values?.count || 0;
  const failed = metrics["tutor_pipeline_failures"]?.values?.count || 0;
  lines.push("");
  lines.push(`Tutors fully completed: ${completed}`);
  lines.push(`Tutor pipelines failed: ${failed}`);
  lines.push("===========================================================================");

  return { stdout: lines.join("\n"), "prod-k6/logs/k6-json-create-summary.json": JSON.stringify(summaryData, null, 2) };
}
