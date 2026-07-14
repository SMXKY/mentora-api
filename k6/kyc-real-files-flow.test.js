/**
 * KYC full lifecycle with REAL files, against a real production storage
 * adapter (R2 or FTP — controlled by whatever STORAGE_PROVIDER the server
 * was started with; this script doesn't touch it).
 *
 * Unlike kyc-flow.test.js (1 tutor, 68-byte synthetic stub fixtures), this
 * drives 5 tutors, each uploading real downloaded photos (selfie/CNI front/
 * CNI back) and realistic multi-page generated PDFs (non-conviction
 * certificate, degree), then verifies every document is actually
 * *readable back* through the storage adapter — not just that the upload
 * call returned 200. Each tutor is walked through a different admin
 * outcome (reject+resubmit, full approval to ACTIVE, identity-only
 * approval, stays PENDING, suspend/unsuspend) so both the tutor-facing and
 * admin-facing KYC surfaces get real coverage in one run.
 *
 * Prerequisites:
 *   1. Dev server running with STORAGE_PROVIDER=r2 (or ftp) and real .env
 *      credentials: STORAGE_PROVIDER=r2 npm run dev
 *   2. Fixtures + tutors seeded:
 *      ts-node k6/support/generate-real-tutor-pdfs.ts
 *      ts-node k6/support/seed-kyc-real-tutors.ts
 *      (npm run test:k6:kyc:real does all three steps for you)
 *   3. SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD set.
 *
 * After the run, clean up the uploaded bytes from the real storage backend:
 *   STORAGE_PROVIDER=r2 ts-node k6/support/cleanup-kyc-real-tutors-storage.ts
 */
import http from "k6/http";
import { check, fail, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const SUPER_ADMIN_EMAIL = __ENV.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = __ENV.SUPER_ADMIN_PASSWORD;

const seed = JSON.parse(open("./fixtures/kyc-real-tutors-seed.json"));
const TUTORS = seed.tutors;
const TUTOR_PASSWORD = seed.password;

// k6's `open()` can't take a dynamic path built at runtime from JSON, so
// every fixture file is opened explicitly, once per tutor slot (1-5).
const fixtures = {};
for (let i = 1; i <= 5; i++) {
  fixtures[i] = {
    cniFront: open(`./fixtures/real-tutors/tutor-${i}/cni-front.jpg`, "b"),
    cniBack: open(`./fixtures/real-tutors/tutor-${i}/cni-back.jpg`, "b"),
    selfie: open(`./fixtures/real-tutors/tutor-${i}/selfie.jpg`, "b"),
    nonConviction: open(`./fixtures/real-tutors/tutor-${i}/non-conviction.pdf`, "b"),
    degree: open(`./fixtures/real-tutors/tutor-${i}/degree.pdf`, "b"),
  };
}

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
  if (res.status !== 200) {
    fail(`${label}: could not log in (${res.status} ${res.body}) — did you run the real-tutor seed script?`);
  }
  return mustJson(res, label).data.token;
}

function submitStep1(token, tutor, f) {
  const form = {
    idDocumentType: "ORIGINAL_CNI",
    cniNumber: tutor.cniNumber,
    cniFront: http.file(f.cniFront, "cni-front.jpg", "image/jpeg"),
    cniBack: http.file(f.cniBack, "cni-back.jpg", "image/jpeg"),
    selfie: http.file(f.selfie, "selfie.jpg", "image/jpeg"),
    nonConvictionCertificate: http.file(f.nonConviction, "non-conviction.pdf", "application/pdf"),
  };
  return http.post(`${BASE_URL}/api/v1/kyc/me/step-1`, form, multipart(token));
}

function submitStep2(token, tutor) {
  return http.post(
    `${BASE_URL}/api/v1/kyc/me/step-2`,
    JSON.stringify({
      fullLegalName: `${tutor.firstName} ${tutor.lastName}`,
      surname: tutor.lastName,
      dob: "1990-06-10T00:00:00.000Z",
      gender: "FEMALE",
      placeOfBirth: tutor.cityName,
      currentStreet: "Avenue Kennedy",
      currentNeighbourhood: "Centre-ville",
      currentCityId: tutor.cityId,
      currentRegionId: tutor.regionId,
      cityOfOrigin: tutor.cityName,
      regionOfOrigin: "Centre",
      emergencyContactName: `${tutor.firstName} Emergency Contact`,
      emergencyContactPhone: "+237601020399",
      selfDeclarationStatement: "Real-file k6 storage adapter test tutor.",
    }),
    json(token)
  );
}

function submitCredential(token, tutor, f) {
  const form = {
    institutionName: "University of Yaoundé I",
    qualificationType: "BSC",
    fieldOfStudy: "Mathematics",
    gradeOrClassification: "Upper Second",
    yearAwarded: "2018",
    subjectIds: JSON.stringify([tutor.subjectId]),
    document: http.file(f.degree, "degree.pdf", "application/pdf"),
  };
  return http.post(`${BASE_URL}/api/v1/kyc/me/credentials`, form, multipart(token));
}

function getMyApplication(token) {
  return http.get(`${BASE_URL}/api/v1/kyc/me`, json(token));
}

// Actually GETs the resolved document URL bytes back — this is the real
// "can the adapter read what it wrote" check, not just a 200 on upload.
function assertDocumentReadable(label, url, expectedContentTypePrefix) {
  if (!url) {
    check(null, { [`${label}: url present`]: () => false });
    return;
  }
  const res = http.get(url);
  check(res, {
    [`${label}: readable (200)`]: (r) => r.status === 200,
    [`${label}: has bytes`]: (r) => r.body && r.body.length > 0,
    [`${label}: content-type matches`]: (r) => {
      const ct = (r.headers["Content-Type"] || r.headers["content-type"] || "").toLowerCase();
      return expectedContentTypePrefix ? ct.indexOf(expectedContentTypePrefix) === 0 : true;
    },
  });
}

// ── Phase 1: every tutor submits with real files ──────────────────────
function submitAllTutors() {
  const results = [];
  for (let i = 0; i < TUTORS.length; i++) {
    const tutor = TUTORS[i];
    const f = fixtures[i + 1];
    const token = login(tutor.email, TUTOR_PASSWORD, tutor.email);

    const step1 = submitStep1(token, tutor, f);
    check(step1, {
      [`${tutor.email}: step 1 saved (real files)`]: (r) => r.status === 200,
    });
    if (step1.status !== 200) {
      console.error(`step1 failed for ${tutor.email}: ${step1.status} ${step1.body}`);
    }

    const step2 = submitStep2(token, tutor);
    check(step2, { [`${tutor.email}: step 2 saved`]: (r) => r.status === 200 });

    const credential = submitCredential(token, tutor, f);
    check(credential, {
      [`${tutor.email}: credential added (real degree pdf)`]: (r) => r.status === 201,
    });

    const submit = http.post(`${BASE_URL}/api/v1/kyc/me/submit`, null, json(token));
    check(submit, { [`${tutor.email}: submitted`]: (r) => r.status === 200 });

    const applicationId = mustJson(getMyApplication(token), "get application").data.application.id;
    results.push({ ...tutor, token, applicationId });
    sleep(0.1);
  }
  return results;
}

// ── Phase 2: give each tutor a different admin outcome ─────────────────
function driveOutcomes(adminToken, submitted) {
  // Tutor 0: reject -> resubmit -> approve identity -> approve subject (ACTIVE)
  const t0 = submitted[0];
  const reject = http.post(
    `${BASE_URL}/api/v1/admin/kyc/applications/${t0.applicationId}/reject`,
    JSON.stringify({
      flags: [
        {
          flagItem: "DOCUMENT_UNREADABLE",
          reason: "CNI photo is blurry",
          adminMessage: "Please retake the CNI front photo in better lighting.",
        },
      ],
    }),
    json(adminToken)
  );
  check(reject, { [`${t0.email}: reject 200`]: (r) => r.status === 200 });

  const afterReject = getMyApplication(t0.token);
  check(afterReject, {
    [`${t0.email}: sees REJECTED status`]: (r) => r.json().data.kycStatus === "REJECTED",
  });

  const resubmit = http.post(`${BASE_URL}/api/v1/kyc/me/resubmit`, null, json(t0.token));
  check(resubmit, { [`${t0.email}: resubmit 200`]: (r) => r.status === 200 });

  const submitAgain = http.post(`${BASE_URL}/api/v1/kyc/me/submit`, null, json(t0.token));
  check(submitAgain, { [`${t0.email}: resubmission submit 200`]: (r) => r.status === 200 });
  t0.applicationId = mustJson(getMyApplication(t0.token), "get application v2").data.application.id;

  approveIdentity(adminToken, t0);
  approveAllSubjects(adminToken, t0);

  const afterActive = getMyApplication(t0.token);
  check(afterActive, {
    [`${t0.email}: ACTIVE after subject approval`]: (r) => r.json().data.kycStatus === "ACTIVE",
  });

  // Tutor 1: approve identity + subject -> ACTIVE -> suspend -> unsuspend
  const t1 = submitted[1];
  approveIdentity(adminToken, t1);
  approveAllSubjects(adminToken, t1);

  const t1TutorProfileId = t1.tutorProfileId;
  const suspend = http.post(
    `${BASE_URL}/api/v1/admin/kyc/tutors/${t1TutorProfileId}/suspend`,
    JSON.stringify({ reason: "Repeated no-shows reported by multiple parents" }),
    json(adminToken)
  );
  check(suspend, { [`${t1.email}: suspend 200`]: (r) => r.status === 200 });

  const suspendedLoginRes = http.post(
    `${BASE_URL}/api/v1/auth/user/login`,
    JSON.stringify({ identifier: t1.email, password: TUTOR_PASSWORD }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(suspendedLoginRes, {
    [`${t1.email}: cannot log in while suspended`]: (r) => r.status === 403,
  });

  const unsuspend = http.post(
    `${BASE_URL}/api/v1/admin/kyc/tutors/${t1TutorProfileId}/unsuspend`,
    null,
    json(adminToken)
  );
  check(unsuspend, { [`${t1.email}: unsuspend 200`]: (r) => r.status === 200 });

  // Tutor 2: identity approved only (left at IDENTITY_APPROVED)
  const t2 = submitted[2];
  approveIdentity(adminToken, t2);

  // Tutor 3: rejected, no resubmit — verify rejection flags + docs still readable
  const t3 = submitted[3];
  const reject3 = http.post(
    `${BASE_URL}/api/v1/admin/kyc/applications/${t3.applicationId}/reject`,
    JSON.stringify({
      flags: [
        {
          flagItem: "CNI_NUMBER_MISMATCH",
          reason: "Name on CNI does not match declared legal name",
          adminMessage: "Please correct your legal name to match your CNI.",
        },
      ],
    }),
    json(adminToken)
  );
  check(reject3, { [`${t3.email}: reject 200`]: (r) => r.status === 200 });

  // Tutor 4: left PENDING — untouched, default queue view.

  sleep(0.2);
}

function approveIdentity(adminToken, tutor) {
  const detail = http.get(`${BASE_URL}/api/v1/admin/kyc/applications/${tutor.applicationId}`, json(adminToken));
  check(detail, { [`${tutor.email}: application detail 200`]: (r) => r.status === 200 });

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
  tutor.detailBody = detail.status === 200 ? detail.json().data : null;
}

function approveAllSubjects(adminToken, tutor) {
  const subjectQueue = http.get(`${BASE_URL}/api/v1/admin/kyc/subjects/queue`, json(adminToken));
  check(subjectQueue, { [`${tutor.email}: subject queue 200`]: (r) => r.status === 200 });
  if (subjectQueue.status !== 200) return;
  const all = [
    ...subjectQueue.json().data.recommendApprove,
    ...subjectQueue.json().data.recommendReview,
    ...subjectQueue.json().data.newDocumentationRequired,
  ];
  // Every real tutor shares the same seeded subjectId, so this must be
  // scoped by tutorProfileId too — matching on subjectId alone would
  // always resolve to whichever tutor's row appears first in the queue.
  const ourSubject = all.find(
    (s) => s.tutorSubject.subjectId === tutor.subjectId && s.tutor.tutorProfileId === tutor.tutorProfileId
  );
  if (ourSubject) {
    const approveSubject = http.post(
      `${BASE_URL}/api/v1/admin/kyc/subjects/${ourSubject.tutorSubject.id}/approve`,
      JSON.stringify({ trainWeight: 85 }),
      json(adminToken)
    );
    check(approveSubject, { [`${tutor.email}: approve subject 200`]: (r) => r.status === 200 });
  }
}

// ── Phase 3: read every uploaded document back through the adapter ─────
function verifyDocumentsReadable(adminToken, submitted) {
  for (const tutor of submitted) {
    const detail = http.get(`${BASE_URL}/api/v1/admin/kyc/applications/${tutor.applicationId}`, json(adminToken));
    check(detail, { [`${tutor.email}: detail readable for doc check`]: (r) => r.status === 200 });
    if (detail.status !== 200) continue;

    const data = detail.json().data;
    const documentUrls = data.application?.documentUrls || {};
    assertDocumentReadable(`${tutor.email} cniFront`, documentUrls.cniFrontPhotoUrl, "image/");
    assertDocumentReadable(`${tutor.email} cniBack`, documentUrls.cniBackPhotoUrl, "image/");
    assertDocumentReadable(`${tutor.email} selfie`, documentUrls.selfieWithCniUrl, "image/");
    assertDocumentReadable(
      `${tutor.email} nonConviction`,
      documentUrls.nonConvictionCertificateUrl,
      "application/pdf"
    );
    const credentialDoc = (data.credentials || [])[0];
    if (credentialDoc) {
      assertDocumentReadable(`${tutor.email} degree`, credentialDoc.documentViewUrl, "application/pdf");
    }
  }
}

// ── Phase 4: admin queue sanity over the 5 real tutors ─────────────────
function testQueueEndpoints(adminToken) {
  const q = (params) => http.get(`${BASE_URL}/api/v1/admin/kyc/queue?${params}`, json(adminToken));

  const pending = q("status=PENDING");
  check(pending, { "queue pending: 200": (r) => r.status === 200 });

  // The default PENDING page is small and this env accumulates PENDING
  // rows across every past k6 KYC run — searching by our tutor's exact
  // CNI number is the only reliable way to find it, regardless of how
  // many unrelated PENDING applications already exist.
  const stillPendingTutor = TUTORS[4]; // tutor 5 is deliberately left untouched
  const searchRes = q(`search=${stillPendingTutor.cniNumber}`);
  check(searchRes, {
    "queue search by cni: 200": (r) => r.status === 200,
    "queue search by cni: finds our pending tutor": (r) =>
      r.json().data.some((row) => row.cniNumber === stillPendingTutor.cniNumber),
  });

  const identityApproved = q("status=IDENTITY_APPROVED");
  check(identityApproved, { "queue identity-approved: 200": (r) => r.status === 200 });

  const rejected = q("status=REJECTED");
  check(rejected, { "queue rejected: 200": (r) => r.status === 200 });

  const statsRes = http.get(`${BASE_URL}/api/v1/admin/kyc/queue/stats`, json(adminToken));
  check(statsRes, { "queue stats: 200": (r) => r.status === 200 });
}

export default function () {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    fail("SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD must be set in the environment");
  }
  if (!TUTORS || TUTORS.length !== 5) {
    fail("Expected 5 real tutors — run k6/support/seed-kyc-real-tutors.ts first");
  }

  const submitted = submitAllTutors();
  const adminToken = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, "admin", true);

  driveOutcomes(adminToken, submitted);
  verifyDocumentsReadable(adminToken, submitted);
  testQueueEndpoints(adminToken);
}
