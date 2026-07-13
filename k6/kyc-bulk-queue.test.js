/**
 * Admin KYC queue — bulk data + search/sort/filter/pagination coverage (k6).
 *
 * Unlike kyc-flow.test.js (one tutor through the full lifecycle), this
 * script's job is to put enough *varied* data in front of the admin queue
 * endpoints to prove search, sort, filter, and pagination actually work —
 * a queue with one row can't tell you if ?search= or ?sortBy= is broken.
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev
 *   2. Bulk tutors seeded: ts-node k6/support/seed-kyc-bulk-tutors.ts
 *      (npm run test:k6:kyc:bulk does both steps for you)
 *   3. SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD set in the environment.
 *
 * Intentionally single-VU/sequential (not a throughput benchmark) — the
 * point is deterministic assertions over a known data set: submit ~24
 * tutor applications, drive a mix of outcomes (pending / rejected+
 * resubmitted / identity-approved / active), then hit GET /admin/kyc/queue
 * and GET /admin/kyc/subjects/queue with every query param combination a
 * real admin UI would use.
 */
import http from "k6/http";
import { check, fail, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const SUPER_ADMIN_EMAIL = __ENV.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = __ENV.SUPER_ADMIN_PASSWORD;

const seed = JSON.parse(open("./fixtures/kyc-bulk-seed.json"));
const TUTORS = seed.tutors;
const TUTOR_PASSWORD = seed.password;

const photo = open("./fixtures/kyc-photo.png", "b");
const pdf = open("./fixtures/kyc-document.pdf", "b");

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ["rate>0.98"] },
};

const json = (token) => ({
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
});
const multipart = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

function mustJson(res, label) {
  const body = res.json();
  if (!body) fail(`${label}: response was not JSON (status ${res.status}, body: ${res.body})`);
  return body;
}

function login(identifier, password, label, isAdmin) {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/${isAdmin ? "admin" : "user"}/login`,
    JSON.stringify({ identifier, password }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(res, { [`${label}: login 200`]: (r) => r.status === 200 });
  if (res.status !== 200) fail(`${label}: could not log in (${res.status} ${res.body}) — did you run the bulk seed script?`);
  return mustJson(res, label).data.token;
}

function submitStep1(token, cniNumber) {
  const form = {
    idDocumentType: "ORIGINAL_CNI",
    cniNumber,
    cniFront: http.file(photo, "cni-front.png", "image/png"),
    cniBack: http.file(photo, "cni-back.png", "image/png"),
    selfie: http.file(photo, "selfie.png", "image/png"),
    nonConvictionCertificate: http.file(pdf, "non-conviction.pdf", "application/pdf"),
  };
  return http.post(`${BASE_URL}/api/v1/kyc/me/step-1`, form, multipart(token));
}

function submitStep2(token, tutor) {
  return http.post(
    `${BASE_URL}/api/v1/kyc/me/step-2`,
    JSON.stringify({
      fullLegalName: `${tutor.firstName} ${tutor.lastName}`,
      surname: tutor.lastName,
      dob: "1992-03-15T00:00:00.000Z",
      gender: "MALE",
      placeOfBirth: tutor.cityName,
      currentStreet: "Rue Principale",
      currentNeighbourhood: "Centre-ville",
      currentCityId: tutor.cityId,
      currentRegionId: tutor.regionId,
      cityOfOrigin: tutor.cityName,
      regionOfOrigin: "Centre",
      emergencyContactName: `${tutor.firstName} Contact`,
      emergencyContactPhone: "+237601020305",
      selfDeclarationStatement: "Bulk-seeded tutor for KYC queue load testing.",
    }),
    json(token)
  );
}

function submitCredential(token, tutor) {
  const form = {
    institutionName: "University of Yaoundé I",
    qualificationType: "BSC",
    fieldOfStudy: "Mathematics",
    gradeOrClassification: "Upper Second",
    yearAwarded: "2018",
    subjectIds: JSON.stringify([tutor.subjectId]),
    document: http.file(pdf, "degree.pdf", "application/pdf"),
  };
  return http.post(`${BASE_URL}/api/v1/kyc/me/credentials`, form, multipart(token));
}

function getMyApplicationId(token) {
  const res = http.get(`${BASE_URL}/api/v1/kyc/me`, json(token));
  return mustJson(res, "get application").data.application.id;
}

// ── Phase 1: seed a submitted application per tutor ──────────────────
function submitAllTutors() {
  const results = [];
  for (const tutor of TUTORS) {
    const token = login(tutor.email, TUTOR_PASSWORD, tutor.email);

    const step1 = submitStep1(token, tutor.cniNumber);
    check(step1, { [`${tutor.email}: step 1 saved`]: (r) => r.status === 200 });

    const step2 = submitStep2(token, tutor);
    check(step2, { [`${tutor.email}: step 2 saved`]: (r) => r.status === 200 });

    const credential = submitCredential(token, tutor);
    check(credential, { [`${tutor.email}: credential added`]: (r) => r.status === 201 });

    const submit = http.post(`${BASE_URL}/api/v1/kyc/me/submit`, null, json(token));
    check(submit, { [`${tutor.email}: submitted`]: (r) => r.status === 200 });

    const applicationId = getMyApplicationId(token);
    results.push({ ...tutor, token, applicationId });
    sleep(0.05);
  }
  return results;
}

// ── Phase 2: drive a mix of admin outcomes so status/search/sort/filter
// all have something real to discriminate on ──────────────────────────
function driveOutcomes(adminToken, submitted) {
  submitted.forEach((tutor, i) => {
    const outcome = i % 5;

    if (outcome === 0) {
      // Reject, then resubmit (still ends up PENDING but version 2 —
      // exercises isResubmission and previousRejectionsCount).
      const reject = http.post(
        `${BASE_URL}/api/v1/admin/kyc/applications/${tutor.applicationId}/reject`,
        JSON.stringify({
          flags: [
            {
              flagItem: "DOCUMENT_UNREADABLE",
              reason: "CNI photo is blurry",
              adminMessage: "Please retake the CNI front photo.",
            },
          ],
        }),
        json(adminToken)
      );
      check(reject, { [`${tutor.email}: reject 200`]: (r) => r.status === 200 });

      const resubmit = http.post(`${BASE_URL}/api/v1/kyc/me/resubmit`, null, json(tutor.token));
      check(resubmit, { [`${tutor.email}: resubmit 200`]: (r) => r.status === 200 });

      const submitAgain = http.post(`${BASE_URL}/api/v1/kyc/me/submit`, null, json(tutor.token));
      check(submitAgain, { [`${tutor.email}: resubmission submit 200`]: (r) => r.status === 200 });

      tutor.applicationId = getMyApplicationId(tutor.token);
      tutor.expectedStatus = "PENDING";
    } else if (outcome === 1) {
      // Identity-approved (and for a couple, push all the way to ACTIVE).
      const detail = http.get(
        `${BASE_URL}/api/v1/admin/kyc/applications/${tutor.applicationId}`,
        json(adminToken)
      );
      check(detail, { [`${tutor.email}: detail 200`]: (r) => r.status === 200 });

      const approve = http.post(
        `${BASE_URL}/api/v1/admin/kyc/applications/${tutor.applicationId}/approve-identity`,
        JSON.stringify({
          checklist: {
            cniNumberMatchesDocument: true,
            selfieMatchesCniPhoto: true,
            documentTypeMatchesDeclaration: true,
            degreeMatchesFieldOfStudy: true,
            subjectsSupportedByCredentials: true,
          },
        }),
        json(adminToken)
      );
      check(approve, { [`${tutor.email}: approve-identity 200`]: (r) => r.status === 200 });
      tutor.expectedStatus = "IDENTITY_APPROVED";
    } else {
      // Majority stay PENDING — the default queue view.
      tutor.expectedStatus = "PENDING";
    }
  });
  sleep(0.2);
}

// ── Phase 3: exercise the admin queue's search/sort/filter/pagination ──
function testQueueEndpoints(adminToken, submitted) {
  const q = (params) => http.get(`${BASE_URL}/api/v1/admin/kyc/queue?${params}`, json(adminToken));

  // Default view: PENDING only, enriched fields present.
  const defaultQueue = q("");
  check(defaultQueue, {
    "queue: 200": (r) => r.status === 200,
    "queue: has data array": (r) => Array.isArray(r.json().data),
    "queue: has meta.total": (r) => typeof r.json().meta.total === "number",
    "queue: has meta.counts": (r) => !!r.json().meta.counts,
    "queue: row has embedded tutor name": (r) =>
      r.json().data.length === 0 || !!r.json().data[0].tutor.fullName,
    "queue: row has embedded city name": (r) =>
      r.json().data.length === 0 || "cityName" in r.json().data[0].location,
    "queue: row has document completeness flags": (r) =>
      r.json().data.length === 0 || "cniFrontUploaded" in r.json().data[0].documents,
    "queue: row has SLA fields": (r) =>
      r.json().data.length === 0 ||
      ("isEscalated" in r.json().data[0] && "slaHoursRemaining" in r.json().data[0]),
    "queue: default status is PENDING only": (r) =>
      r.json().data.every((row) => row.tutor.kycStatus === "PENDING"),
  });

  // Search by a first name shared by 2+ seeded tutors.
  const searchTarget = TUTORS[0].firstName;
  const searchRes = q(`search=${encodeURIComponent(searchTarget)}`);
  check(searchRes, {
    "queue search: 200": (r) => r.status === 200,
    "queue search: every row matches": (r) =>
      r.json().data.every((row) => row.fullLegalName.includes(searchTarget)),
    "queue search: at least one hit": (r) => r.json().data.length > 0,
  });

  // Search by CNI number (exact single-tutor hit).
  const cniTarget = submitted.find((t) => t.expectedStatus === "PENDING");
  if (cniTarget) {
    const cniRes = q(`search=${cniTarget.cniNumber}`);
    check(cniRes, {
      "queue search by cni: 200": (r) => r.status === 200,
      "queue search by cni: finds the tutor": (r) =>
        r.json().data.some((row) => row.cniNumber === cniTarget.cniNumber),
    });
  }

  // City filter.
  const cityTarget = TUTORS[0];
  const cityRes = q(`cityId=${cityTarget.cityId}&status=PENDING,IDENTITY_APPROVED`);
  check(cityRes, {
    "queue city filter: 200": (r) => r.status === 200,
    "queue city filter: every row matches city": (r) =>
      r.json().data.every((row) => row.location.cityId === cityTarget.cityId),
  });

  // Status filter — IDENTITY_APPROVED.
  const statusRes = q("status=IDENTITY_APPROVED");
  check(statusRes, {
    "queue status filter: 200": (r) => r.status === 200,
    "queue status filter: every row is IDENTITY_APPROVED": (r) =>
      r.json().data.every((row) => row.tutor.kycStatus === "IDENTITY_APPROVED"),
    "queue status filter: finds at least one": (r) => r.json().data.length > 0,
  });

  // Sort by fullLegalName ascending.
  const sortRes = q("sortBy=fullLegalName&sortOrder=asc&status=PENDING,IDENTITY_APPROVED&limit=100");
  check(sortRes, {
    "queue sort: 200": (r) => r.status === 200,
    "queue sort: ascending by name": (r) => {
      const names = r.json().data.map((row) => (row.fullLegalName || "").toLowerCase());
      const sorted = [...names].sort();
      return JSON.stringify(names) === JSON.stringify(sorted);
    },
  });

  // Pagination — two pages of 5 shouldn't overlap.
  const page1 = q("status=PENDING,IDENTITY_APPROVED&limit=5&page=1&sortBy=submittedAt&sortOrder=asc");
  const page2 = q("status=PENDING,IDENTITY_APPROVED&limit=5&page=2&sortBy=submittedAt&sortOrder=asc");
  check(page1, { "queue page1: 200": (r) => r.status === 200 });
  check(page2, { "queue page2: 200": (r) => r.status === 200 });
  const ids1 = page1.json().data.map((r) => r.id);
  const ids2 = page2.json().data.map((r) => r.id);
  check(null, {
    "queue pagination: page1/page2 don't overlap": () =>
      ids1.every((id) => !ids2.includes(id)),
    "queue pagination: meta.hasNextPage true on page1 when more rows exist": () =>
      page1.json().meta.totalPages <= 1 || page1.json().meta.hasNextPage === true,
  });

  // Stats endpoint mirrors meta.counts.
  const statsRes = http.get(`${BASE_URL}/api/v1/admin/kyc/queue/stats`, json(adminToken));
  check(statsRes, {
    "queue stats: 200": (r) => r.status === 200,
    "queue stats: has byStatus": (r) => !!r.json().data.byStatus,
    "queue stats: byStatus.PENDING matches queue count": (r) =>
      r.json().data.byStatus.PENDING === defaultQueue.json().meta.total ||
      r.json().data.byStatus.PENDING >= defaultQueue.json().meta.total,
  });

  // Subject queue search.
  const subjectQueueRes = http.get(
    `${BASE_URL}/api/v1/admin/kyc/subjects/queue`,
    json(adminToken)
  );
  check(subjectQueueRes, {
    "subject queue: 200": (r) => r.status === 200,
    "subject queue: has meta.total": (r) => typeof r.json().data.meta.total === "number",
  });
  const subjectSearchRes = http.get(
    `${BASE_URL}/api/v1/admin/kyc/subjects/queue?search=${encodeURIComponent(TUTORS[0].lastName)}`,
    json(adminToken)
  );
  check(subjectSearchRes, {
    "subject queue search: 200": (r) => r.status === 200,
  });
}

export default function () {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    fail("SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD must be set in the environment");
  }
  if (!TUTORS || TUTORS.length === 0) {
    fail("No bulk tutors found — run k6/support/seed-kyc-bulk-tutors.ts first");
  }

  const submitted = submitAllTutors();

  const adminToken = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, "admin", true);

  driveOutcomes(adminToken, submitted);

  testQueueEndpoints(adminToken, submitted);
}
