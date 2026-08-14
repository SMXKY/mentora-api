/**
 * Mentora API — tutor onboarding load test / stress-seed
 * ============================================================
 *
 * Exercises the REAL tutor onboarding pipeline end-to-end, through live
 * HTTP endpoints only — no direct database access anywhere in this file.
 * Every account this creates goes through the exact same code path a real
 * tutor signing up would: email-OTP registration, profile completion,
 * intro video upload, all four KYC steps, then real admin approval via the
 * real admin endpoints (same as a human reviewer would call). The purpose
 * is twofold, same as any load test that happens to create real data:
 *   1. Find bugs/bottlenecks in the onboarding + KYC + search-indexing
 *      pipeline under realistic concurrent load (this is what surfaced
 *      real bugs in a prior run of a script shaped like this one).
 *   2. Populate the target with a realistic volume of searchable tutors
 *      (real subjects, real Cameroonian names) to stress-test and
 *      visually validate /search/tutors and its pagination.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * -----------------------------------
 * KYC document uploads (cniFront/cniBack/selfie/nonConvictionCertificate,
 * intro video, credential document) use small, clearly-labeled placeholder
 * files from prod-k6/assets/ — plain solid-color images/video, not
 * AI-generated faces or anything designed to resemble a real government ID.
 * The admin-approval stage uses the SAME real checklist-attestation
 * endpoints a human reviewer uses; it does not forge review outcomes, it
 * just has a real admin (you, via SUPER_ADMIN_EMAIL/PASSWORD) approve a
 * known batch of test accounts through the real approval code path.
 *
 * SAFETY
 * ------
 * Same non-local-target guard as permissionModule.k6.js: refuses to run
 * against anything that isn't localhost unless ALLOW_NON_LOCAL_TARGET=true.
 * This creates thousands of real rows — confirm the target before running.
 *
 * USAGE
 * -----
 *   Dry run against local first:
 *     k6 run k6/permissionModule.k6.js   # sanity-check target is healthy
 *
 *   Small smoke test (10 tutors) against the real target:
 *     k6 run -e BASE_URL=https://mentora.api.tallamichael.online \
 *       -e ALLOW_NON_LOCAL_TARGET=true \
 *       -e SUPER_ADMIN_EMAIL=... -e SUPER_ADMIN_PASSWORD=... \
 *       -e TOTAL_TUTORS=10 -e VUS=2 \
 *       prod-k6/seedStressTutors.k6.js
 *
 *   Full run:
 *     k6 run -e BASE_URL=https://mentora.api.tallamichael.online \
 *       -e ALLOW_NON_LOCAL_TARGET=true \
 *       -e SUPER_ADMIN_EMAIL=... -e SUPER_ADMIN_PASSWORD=... \
 *       -e TOTAL_TUTORS=2000 -e VUS=4 \
 *       prod-k6/seedStressTutors.k6.js
 *
 *   Resuming after an interrupted run — see prod-k6/README.md for how to
 *   compute START_INDEX from the ndjson logs this script writes to stdout.
 *
 * REQUIRED ENV VARS
 * -----------------
 *   SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD — must hold kyc.approve +
 *     kyc.subjectsApprove (Super Admin has these via kyc.manage).
 *
 * OPTIONAL ENV VARS
 * ------------------
 *   BASE_URL                default: http://localhost:8080
 *   TOTAL_TUTORS             default: 2000
 *   VUS                      default: 4     — kept low deliberately: every
 *                            tutor sends one real transactional email
 *                            (registration OTP) through your real provider.
 *                            Raise only if you've confirmed your plan's
 *                            rate limit can take it (see prod-k6/README.md).
 *   START_INDEX              default: 0     — resume support, see README.
 *   ALLOW_NON_LOCAL_TARGET   default: false
 *   TEST_PASSWORD            default: a fixed placeholder — these accounts
 *                            are never meant to be logged into after the
 *                            run, a shared password is fine.
 */

import http from "k6/http";
import { check, group, sleep, fail } from "k6";
import { Counter, Trend } from "k6/metrics";
import { nameForIndex, COMBINATION_COUNT } from "./data/names.js";

// ============================================================
// CONFIG
// ============================================================

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const API = `${BASE_URL}/api/v1`;

const SUPER_ADMIN_EMAIL = __ENV.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = __ENV.SUPER_ADMIN_PASSWORD;

const TOTAL_TUTORS = Number(__ENV.TOTAL_TUTORS || 2000);
const VUS = Number(__ENV.VUS || 4);
const ITERATIONS_PER_VU = Math.ceil(TOTAL_TUTORS / VUS);
const START_INDEX = Number(__ENV.START_INDEX || 0);
const ALLOW_NON_LOCAL_TARGET = String(__ENV.ALLOW_NON_LOCAL_TARGET || "false") === "true";
const TEST_PASSWORD = __ENV.TEST_PASSWORD || "ProdK6Stress!2026";

const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || "30s";

if (TOTAL_TUTORS > COMBINATION_COUNT) {
  fail(
    `TOTAL_TUTORS (${TOTAL_TUTORS}) exceeds the name pool's combination count ` +
      `(${COMBINATION_COUNT}) — add more names to prod-k6/data/names.js first.`
  );
}

// ============================================================
// STATIC ASSETS — loaded once, in init context (k6 requires open()
// calls at module scope, not inside exported functions).
// ============================================================

const ASSET_DIR = "./assets";
const introVideoBin = open(`${ASSET_DIR}/placeholder-intro.mp4`, "b");
const cniFrontBin = open(`${ASSET_DIR}/placeholder-cni-front.jpg`, "b");
const cniBackBin = open(`${ASSET_DIR}/placeholder-cni-back.jpg`, "b");
const selfieBin = open(`${ASSET_DIR}/placeholder-selfie.jpg`, "b");
const certificatePdfBin = open(`${ASSET_DIR}/placeholder-certificate.pdf`, "b");

// ============================================================
// TAXONOMY-DEPENDENT VARIETY POOLS (structural, not identity-related)
// ============================================================

const TEACHING_MODES = ["ONLINE_ONLY", "ONLINE_ONLY", "ONLINE_ONLY", "HOME_ONLY", "BOTH"]; // weighted toward online
const LANGUAGES_POOL = [["EN"], ["FR"], ["EN", "FR"]];
const QUALIFICATION_TYPES = ["BSC", "MSC", "GCE_A_LEVEL", "HND", "TEACHING_CERTIFICATE"];
const PRICE_BANDS = [
  [1000, 3000],
  [2000, 5000],
  [3000, 8000],
  [5000, 15000],
];
const INSTITUTIONS = [
  "University of Buea", "University of Yaounde I", "University of Douala",
  "University of Dschang", "University of Bamenda", "ENS Yaounde",
  "Higher Teacher Training College Bambili",
];

// ============================================================
// METRICS
// ============================================================

const ROUTE_NAMES = [
  "POST /auth/register/email/request-otp",
  "GET /auth/dev/otp",
  "POST /auth/register/email/verify-otp",
  "POST /auth/register/complete",
  "PATCH /tutors/me",
  "POST /tutors/me/intro-video",
  "POST /kyc/me/step-1",
  "POST /kyc/me/step-2",
  "POST /kyc/me/credentials",
  "POST /kyc/me/submit",
  "GET /kyc/me/subjects",
  "POST /kyc/admin/applications/:id/approve-identity",
  "POST /kyc/admin/subjects/:tutorSubjectId/approve",
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

const tutorPipelineDuration = new Trend("tutor_pipeline_duration_ms");
const rejectPipelineFailures = new Counter("tutor_pipeline_failures");

function jsonHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return { headers, timeout: REQUEST_TIMEOUT };
}

function authHeader(token) {
  return { headers: { Authorization: `Bearer ${token}` }, timeout: REQUEST_TIMEOUT };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomCniNumber() {
  let n = "";
  for (let i = 0; i < 9; i++) n += Math.floor(Math.random() * 10);
  return n;
}

// ============================================================
// SETUP — runs once, single-threaded. Fetches real taxonomy,
// logs in as the KYC-approving admin, and precomputes the
// two-phase subject assignment for every tutor index up front
// (deterministic, so VUs never need to coordinate).
// ============================================================

export function setup() {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    fail("SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD env vars are required.");
  }

  const isLocalTarget = /localhost|127\.0\.0\.1/.test(BASE_URL);
  if (!isLocalTarget && !ALLOW_NON_LOCAL_TARGET) {
    fail(
      `BASE_URL "${BASE_URL}" does not look like a local server, and this script creates ` +
        "real accounts, real KYC applications, and sends real transactional emails. Re-run " +
        "with -e ALLOW_NON_LOCAL_TARGET=true once you've confirmed this is the right target."
    );
  }

  console.log(`[setup] target: ${BASE_URL}`);
  console.log(`[setup] plan: ${TOTAL_TUTORS} tutors, ${VUS} VUs, starting from index ${START_INDEX}`);

  const loginRes = http.post(
    `${API}/auth/login`,
    JSON.stringify({ identifier: SUPER_ADMIN_EMAIL, password: SUPER_ADMIN_PASSWORD }),
    jsonHeaders()
  );
  if (loginRes.status !== 200) {
    fail(`[setup] Super Admin login failed (status ${loginRes.status}): ${loginRes.body}`);
  }
  const adminToken = loginRes.json("data.token");

  const subjectsRes = http.get(`${API}/subjects`, jsonHeaders());
  const citiesRes = http.get(`${API}/cities`, jsonHeaders());
  const levelsRes = http.get(`${API}/levels`, jsonHeaders());

  const subjects = subjectsRes.status === 200 ? subjectsRes.json("data") || [] : [];
  const cities = citiesRes.status === 200 ? citiesRes.json("data") || [] : [];
  const levels = levelsRes.status === 200 ? levelsRes.json("data") || [] : [];

  if (subjects.length === 0) fail("[setup] /subjects returned no rows.");
  if (cities.length === 0) fail("[setup] /cities returned no rows.");
  if (levels.length === 0) fail("[setup] /levels returned no rows.");

  // Sanity-check the placeholder intro video comfortably exceeds whatever
  // this target's configured minimum duration is — otherwise every intro
  // video upload will fail with introVideoTooShort.
  const introCfgRes = http.get(`${API}/admin/kyc/intro-video-config`, jsonHeaders(adminToken));
  if (introCfgRes.status === 200) {
    const minSeconds = introCfgRes.json("data.minDurationSeconds");
    console.log(`[setup] configured intro video minimum: ${minSeconds}s (placeholder asset is 65s)`);
    if (minSeconds && minSeconds > 60) {
      console.warn(
        `[setup] WARNING: configured min duration (${minSeconds}s) is close to or exceeds the ` +
          "65s placeholder asset — regenerate a longer placeholder-intro.mp4 before running for real."
      );
    }
  }

  // Verify the dev OTP peek endpoint is actually reachable before burning
  // any real accounts on a design that can't complete registration.
  const otpProbeRes = http.get(`${API}/auth/dev/otp?identity=setup-probe@example.com`, jsonHeaders(adminToken));
  if (otpProbeRes.status === 404) {
    fail(
      "[setup] GET /auth/dev/otp is not registered on this target (NODE_ENV=production disables " +
        "it — see auth.route.ts). Registration cannot complete without reading a real inbox. Stopping " +
        "before creating any accounts — this needs a different registration path on this target."
    );
  }

  // ---- Two-phase subject assignment, precomputed for every index ----
  // Phase 1: first subjects.length tutors each cover exactly one subject,
  // in taxonomy order, guaranteeing full coverage before any randomization.
  // Phase 2: remaining tutors get 1-2 subjects, weighted toward whatever
  // looks like a "core" subject by name (Math/English/French show up far
  // more often in real demand than a niche elective).
  const CORE_KEYWORDS = ["math", "english", "french", "science"];
  function subjectWeight(name) {
    const lower = (name || "").toLowerCase();
    return CORE_KEYWORDS.some((k) => lower.includes(k)) ? 4 : 1;
  }
  const weightedSubjectPool = [];
  subjects.forEach((s) => {
    const w = subjectWeight(s.name);
    for (let i = 0; i < w; i++) weightedSubjectPool.push(s.id);
  });

  const subjectAssignments = [];
  for (let i = 0; i < TOTAL_TUTORS; i++) {
    if (i < subjects.length) {
      subjectAssignments.push({ subjectIds: [subjects[i].id], phase: 1 });
    } else {
      const count = Math.random() < 0.3 ? 2 : 1;
      const chosen = new Set();
      while (chosen.size < count) chosen.add(pick(weightedSubjectPool));
      subjectAssignments.push({ subjectIds: Array.from(chosen), phase: 2 });
    }
  }

  console.log(
    `[setup] ready — subjects=${subjects.length} cities=${cities.length} levels=${levels.length} ` +
      `(phase 1 covers indices 0-${subjects.length - 1}, phase 2 covers the rest)`
  );

  return { adminToken, subjects, cities, levels, subjectAssignments };
}

// ============================================================
// MAIN PIPELINE — one full tutor, real endpoints only.
// ============================================================

export function createAndActivateTutor(data) {
  const globalIndex = (__VU - 1) * ITERATIONS_PER_VU + __ITER;
  if (globalIndex >= TOTAL_TUTORS) return; // ceil() padding past the real total
  if (globalIndex < START_INDEX) return; // resume support

  const startedAt = Date.now();
  const name = nameForIndex(globalIndex);
  const assignment = data.subjectAssignments[globalIndex];
  const city = pick(data.cities);
  const email = `prodk6-tutor-${globalIndex}-${Date.now()}@k6.mentora.test`;

  let ok = true;

  // ---- 1. Registration (real email OTP flow — only path that can create a Tutor-role account) ----
  group("register", () => {
    const otpRes = http.post(
      `${API}/auth/register/email/request-otp`,
      JSON.stringify({ email }),
      jsonHeaders()
    );
    ok = verify("POST /auth/register/email/request-otp", otpRes, { "status is 200": (r) => r.status === 200 }) && ok;
    if (!ok) return;

    const peekRes = http.get(`${API}/auth/dev/otp?identity=${encodeURIComponent(email)}`, jsonHeaders(data.adminToken));
    ok = verify("GET /auth/dev/otp", peekRes, { "status is 200": (r) => r.status === 200 }) && ok;
    if (!ok) return;
    const code = peekRes.json("data.code");

    const verifyRes = http.post(
      `${API}/auth/register/email/verify-otp`,
      JSON.stringify({ email, code }),
      jsonHeaders()
    );
    ok = verify("POST /auth/register/email/verify-otp", verifyRes, {
      "status is 200": (r) => r.status === 200,
      "registrationToken present": (r) => !!r.json("data.registrationToken"),
    }) && ok;
    if (!ok) return;
    const registrationToken = verifyRes.json("data.registrationToken");

    const completeRes = http.post(
      `${API}/auth/register/complete`,
      JSON.stringify({
        registrationToken,
        role: "Tutor",
        password: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD,
      }),
      jsonHeaders()
    );
    ok = verify("POST /auth/register/complete", completeRes, {
      "status is 201": (r) => r.status === 201,
      "token present": (r) => !!r.json("data.token"),
    }) && ok;
    if (ok) data._tutorToken = completeRes.json("data.token");
  });
  if (!ok) return finishFailed(globalIndex, name, startedAt);

  const tutorToken = data._tutorToken;

  // ---- 2. Profile completion ----
  group("profile", () => {
    const res = http.patch(
      `${API}/tutors/me`,
      JSON.stringify({
        bio: `Experienced tutor specializing in ${name.fullName.split(" ")[0]}'s favorite subjects. ` +
          "Patient, exam-focused, and available for flexible scheduling.",
        teachingMode: pick(TEACHING_MODES),
        cityId: city.id,
        languages: pick(LANGUAGES_POOL),
        yearsOfExperience: 1 + Math.floor(Math.random() * 12),
      }),
      jsonHeaders(tutorToken)
    );
    ok = verify("PATCH /tutors/me", res, { "status is 200": (r) => r.status === 200 }) && ok;
  });
  if (!ok) return finishFailed(globalIndex, name, startedAt);

  // ---- 3. Intro video (auto-verifies on upload, see tutor.service.ts) ----
  group("intro video", () => {
    const res = http.post(
      `${API}/tutors/me/intro-video`,
      { video: http.file(introVideoBin, "intro.mp4", "video/mp4") },
      authHeader(tutorToken)
    );
    ok = verify("POST /tutors/me/intro-video", res, { "status is 200": (r) => r.status === 200 }) && ok;
  });
  if (!ok) return finishFailed(globalIndex, name, startedAt);

  // ---- 4. KYC step 1 — identity documents ----
  group("kyc step 1", () => {
    const res = http.post(
      `${API}/kyc/me/step-1`,
      {
        idDocumentType: "ORIGINAL_CNI",
        cniNumber: randomCniNumber(),
        cniFront: http.file(cniFrontBin, "cni-front.jpg", "image/jpeg"),
        cniBack: http.file(cniBackBin, "cni-back.jpg", "image/jpeg"),
        selfie: http.file(selfieBin, "selfie.jpg", "image/jpeg"),
        nonConvictionCertificate: http.file(certificatePdfBin, "non-conviction.pdf", "application/pdf"),
      },
      authHeader(tutorToken)
    );
    ok = verify("POST /kyc/me/step-1", res, {
      "status is 200": (r) => r.status === 200,
      "application id present": (r) => !!r.json("data.id"),
    }) && ok;
    if (ok) data._applicationId = res.json("data.id");
  });
  if (!ok) return finishFailed(globalIndex, name, startedAt);

  // ---- 5. KYC step 2 — background info ----
  group("kyc step 2", () => {
    const dobYear = 1970 + Math.floor(Math.random() * 30); // ages ~25-55
    const res = http.post(
      `${API}/kyc/me/step-2`,
      JSON.stringify({
        fullLegalName: name.fullName,
        surname: name.lastName,
        dob: new Date(dobYear, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 27)).toISOString(),
        gender: name.gender,
        placeOfBirth: city.name,
        currentStreet: `Rue ${1 + Math.floor(Math.random() * 200)}`,
        currentNeighbourhood: "Centre-ville",
        currentCityId: city.id,
        currentRegionId: city.regionId,
        cityOfOrigin: city.name,
        regionOfOrigin: city.regionId,
        emergencyContactName: `${nameForIndex((globalIndex + 1) % COMBINATION_COUNT).fullName}`,
        emergencyContactPhone: `+2376${Math.floor(10000000 + Math.random() * 89999999)}`,
      }),
      jsonHeaders(tutorToken)
    );
    ok = verify("POST /kyc/me/step-2", res, { "status is 200": (r) => r.status === 200 }) && ok;
  });
  if (!ok) return finishFailed(globalIndex, name, startedAt);

  // ---- 6. KYC step 3 — credential + subject(s) ----
  group("kyc credentials", () => {
    const subjectsPayload = assignment.subjectIds.map((subjectId) => ({
      subjectId,
      levelIds: [pick(data.levels).id],
    }));
    const res = http.post(
      `${API}/kyc/me/credentials`,
      {
        institutionName: pick(INSTITUTIONS),
        qualificationType: pick(QUALIFICATION_TYPES),
        fieldOfStudy: "Education",
        yearAwarded: String(2005 + Math.floor(Math.random() * 18)),
        subjects: JSON.stringify(subjectsPayload),
        document: http.file(certificatePdfBin, "credential.pdf", "application/pdf"),
      },
      authHeader(tutorToken)
    );
    ok = verify("POST /kyc/me/credentials", res, { "status is 201": (r) => r.status === 201 }) && ok;
  });
  if (!ok) return finishFailed(globalIndex, name, startedAt);

  // ---- 7. Submit application ----
  group("kyc submit", () => {
    const res = http.post(`${API}/kyc/me/submit`, null, jsonHeaders(tutorToken));
    ok = verify("POST /kyc/me/submit", res, { "status is 200": (r) => r.status === 200 || r.status === 201 }) && ok;
  });
  if (!ok) return finishFailed(globalIndex, name, startedAt);

  // ---- 8. Fetch tutorSubject ids for the admin-approval calls below ----
  let tutorSubjectIds = [];
  group("fetch subjects", () => {
    const res = http.get(`${API}/kyc/me/subjects`, jsonHeaders(tutorToken));
    ok = verify("GET /kyc/me/subjects", res, { "status is 200": (r) => r.status === 200 }) && ok;
    if (ok) tutorSubjectIds = (res.json("data") || []).map((row) => row.id);
  });
  if (!ok || tutorSubjectIds.length === 0) return finishFailed(globalIndex, name, startedAt);

  sleep(0.3); // brief pause before switching to the admin identity, mirrors real review latency

  // ---- 9. Admin: approve identity (real checklist attestation, real endpoint) ----
  group("admin approve identity", () => {
    const res = http.post(
      `${API}/admin/kyc/applications/${data._applicationId}/approve-identity`,
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
    ok = verify("POST /kyc/admin/applications/:id/approve-identity", res, { "status is 200": (r) => r.status === 200 }) && ok;
  });
  if (!ok) return finishFailed(globalIndex, name, startedAt);

  // ---- 10. Admin: approve every subject on this tutor (first approval while identity-approved activates the tutor) ----
  let allSubjectsApproved = true;
  for (const tutorSubjectId of tutorSubjectIds) {
    const res = http.post(`${API}/admin/kyc/subjects/${tutorSubjectId}/approve`, JSON.stringify({}), jsonHeaders(data.adminToken));
    allSubjectsApproved = verify("POST /kyc/admin/subjects/:tutorSubjectId/approve", res, { "status is 200": (r) => r.status === 200 }) && allSubjectsApproved;
  }
  if (!allSubjectsApproved) return finishFailed(globalIndex, name, startedAt);

  // ---- 11. Open each subject for booking with realistic pricing (search's hardVisibilityFilter requires isOpenForBooking: true) ----
  const [minPrice, maxPrice] = pick(PRICE_BANDS);
  let allPricingSet = true;
  for (let i = 0; i < assignment.subjectIds.length; i++) {
    const res = http.patch(
      `${API}/tutors/me/subjects/${assignment.subjectIds[i]}`,
      JSON.stringify({
        ratePerOnlineHourXaf: minPrice,
        ratePerHomeHourXaf: maxPrice,
        isOpenForBooking: true,
      }),
      jsonHeaders(tutorToken)
    );
    allPricingSet = verify("PATCH /tutors/me/subjects/:subjectId", res, { "status is 200": (r) => r.status === 200 }) && allPricingSet;
  }

  const durationMs = Date.now() - startedAt;
  tutorPipelineDuration.add(durationMs);

  console.log(
    JSON.stringify({
      event: "tutor_created",
      index: globalIndex,
      phase: assignment.phase,
      email,
      fullName: name.fullName,
      subjectIds: assignment.subjectIds,
      cityId: city.id,
      pricingSet: allPricingSet,
      durationMs,
      timestamp: new Date().toISOString(),
    })
  );
}

function finishFailed(globalIndex, name, startedAt) {
  rejectPipelineFailures.add(1);
  console.error(
    JSON.stringify({
      event: "tutor_pipeline_failed",
      index: globalIndex,
      fullName: name.fullName,
      durationMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    })
  );
}

// ============================================================
// SCENARIOS
// ============================================================

export const options = {
  scenarios: {
    create_tutors: {
      executor: "per-vu-iterations",
      exec: "createAndActivateTutor",
      vus: VUS,
      iterations: ITERATIONS_PER_VU,
      maxDuration: "6h",
    },
  },
  thresholds: {
    tutor_pipeline_failures: [`count<${Math.ceil(TOTAL_TUTORS * 0.1)}`], // fail run if >10% of tutors never complete
  },
};

// ============================================================
// SUMMARY
// ============================================================

export function handleSummary(summaryData) {
  const lines = [];
  lines.push("");
  lines.push("================ MENTORA API — TUTOR STRESS-SEED SUMMARY ================");
  lines.push(`Target: ${BASE_URL}`);
  lines.push(`Requested: ${TOTAL_TUTORS} tutors, ${VUS} VUs, START_INDEX=${START_INDEX}`);

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
  lines.push(`TOTAL calls: ${totalPass} passed, ${totalFail} failed`);

  const pipelineFailures = metrics["tutor_pipeline_failures"];
  const pipelineDuration = metrics["tutor_pipeline_duration_ms"];
  const completedCount = (pipelineDuration && pipelineDuration.values && pipelineDuration.values.count) || 0;
  const failedCount = (pipelineFailures && pipelineFailures.values && pipelineFailures.values.count) || 0;

  lines.push("");
  lines.push(`Tutors fully completed:  ${completedCount}`);
  lines.push(`Tutor pipelines failed:  ${failedCount}`);
  if (pipelineDuration && pipelineDuration.values) {
    lines.push(`Avg time per tutor:      ${(pipelineDuration.values.avg / 1000).toFixed(1)}s`);
  }

  lines.push("");
  lines.push("To resume an interrupted run, see prod-k6/README.md for computing START_INDEX");
  lines.push("from the tutor_created ndjson lines this run printed to stdout.");
  lines.push("===========================================================================");
  lines.push("");

  return {
    stdout: lines.join("\n"),
    "prod-k6/logs/k6-seed-summary.json": JSON.stringify(summaryData, null, 2),
  };
}
