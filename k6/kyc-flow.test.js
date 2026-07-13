/**
 * KYC / Tutor Onboarding end-to-end flow (k6).
 *
 * Prerequisites:
 *   1. Dev server running with real .env credentials: npm run dev
 *   2. Seeded tutor (100%-complete profile) + fixtures:
 *      ts-node k6/support/seed-kyc-test-tutor.ts
 *      (npm run test:k6:kyc does both steps for you)
 *   3. SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD set — the super admin role
 *      carries every kyc.* permission.
 *
 * Covers the full lifecycle in one continuous run: submit -> reject ->
 * resubmit -> resubmit's own submit -> identity approved -> subject
 * approved (tutor goes ACTIVE) -> suspend -> login blocked while
 * suspended -> unsuspend -> login restored.
 */
import http from "k6/http";
import encoding from "k6/encoding";
import { check, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const SUPER_ADMIN_EMAIL = __ENV.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = __ENV.SUPER_ADMIN_PASSWORD;

const seed = JSON.parse(open("./fixtures/kyc-seed.json"));
const TUTOR_EMAIL = seed.email;
const TUTOR_PASSWORD = "K6KycTutorTest#12345";

const photo = open("./fixtures/kyc-photo.png", "b");
const pdf = open("./fixtures/kyc-document.pdf", "b");

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ["rate==1.0"] },
};

const json = (token) => ({
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
});
// No Content-Type override for multipart — k6 sets its own boundary header.
const multipart = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

function mustJson(res, label) {
  const body = res.json();
  if (!body) fail(`${label}: response was not JSON (status ${res.status}, body: ${res.body})`);
  return body;
}

function login(identifier, password, isAdmin) {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/${isAdmin ? "admin" : "user"}/login`,
    JSON.stringify({ identifier, password }),
    { headers: { "Content-Type": "application/json" } }
  );
  return res;
}

function loginOrFail(identifier, password, label, isAdmin) {
  const res = login(identifier, password, isAdmin);
  check(res, { [`${label}: login 200`]: (r) => r.status === 200 });
  if (res.status !== 200) fail(`${label}: could not log in — did you run the seed script?`);
  return mustJson(res, label).data.token;
}

function submitStep1(token) {
  const form = {
    idDocumentType: "ORIGINAL_CNI",
    cniNumber: "123456789",
    cniFront: http.file(photo, "cni-front.png", "image/png"),
    cniBack: http.file(photo, "cni-back.png", "image/png"),
    selfie: http.file(photo, "selfie.png", "image/png"),
    nonConvictionCertificate: http.file(pdf, "non-conviction.pdf", "application/pdf"),
  };
  return http.post(`${BASE_URL}/api/v1/kyc/me/step-1`, form, multipart(token));
}

function submitStep2(token) {
  return http.post(
    `${BASE_URL}/api/v1/kyc/me/step-2`,
    JSON.stringify({
      fullLegalName: "Kyc Tester",
      surname: "Tester",
      dob: "1995-05-20T00:00:00.000Z",
      gender: "MALE",
      placeOfBirth: "Yaoundé",
      currentStreet: "Rue 123",
      currentNeighbourhood: "Bastos",
      currentCityId: seed.cityId,
      currentRegionId: seed.regionId,
      cityOfOrigin: "Douala",
      regionOfOrigin: "Littoral",
      emergencyContactName: "Jane Tester",
      emergencyContactPhone: "+237601020305",
      selfDeclarationStatement: "I have five years of teaching experience.",
    }),
    json(token)
  );
}

function submitCredential(token) {
  const form = {
    institutionName: "University of Yaoundé I",
    qualificationType: "BSC",
    fieldOfStudy: "Mathematics",
    gradeOrClassification: "Upper Second",
    yearAwarded: "2018",
    subjectIds: JSON.stringify([seed.subjectId]),
    document: http.file(pdf, "degree.pdf", "application/pdf"),
  };
  return http.post(`${BASE_URL}/api/v1/kyc/me/credentials`, form, multipart(token));
}

function getMyApplication(token) {
  return http.get(`${BASE_URL}/api/v1/kyc/me`, json(token));
}

export default function () {
  const tutorToken = loginOrFail(TUTOR_EMAIL, TUTOR_PASSWORD, "tutor");

  // ── Wizard: steps 1-3 ──
  const step1 = submitStep1(tutorToken);
  check(step1, { "step 1 saved": (r) => r.status === 200 });

  const step2 = submitStep2(tutorToken);
  check(step2, { "step 2 saved": (r) => r.status === 200 });

  const credential = submitCredential(tutorToken);
  check(credential, { "credential added": (r) => r.status === 201 });

  // ── Submit -> reject -> resubmit -> submit again ──
  const submit1 = http.post(`${BASE_URL}/api/v1/kyc/me/submit`, null, json(tutorToken));
  check(submit1, {
    "first submission 200": (r) => r.status === 200,
    "first submission is PENDING": (r) => r.json().data.status === "PENDING",
  });

  const adminToken = loginOrFail(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, "admin", true);

  const queueBeforeReject = http.get(`${BASE_URL}/api/v1/admin/kyc/queue`, json(adminToken));
  check(queueBeforeReject, {
    "queue 200": (r) => r.status === 200,
    "queue contains our application": (r) =>
      r.json().data.some((a) => a.tutorProfile.userId === getUserId(tutorToken)),
  });

  const appBeforeReject = mustJson(getMyApplication(tutorToken), "get application").data
    .application;

  const reject = http.post(
    `${BASE_URL}/api/v1/admin/kyc/applications/${appBeforeReject.id}/reject`,
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
  check(reject, { "reject 200": (r) => r.status === 200 });

  const afterReject = getMyApplication(tutorToken);
  check(afterReject, {
    "tutor sees REJECTED status": (r) => r.json().data.kycStatus === "REJECTED",
    "tutor sees the rejection flag": (r) => r.json().data.rejectionFlags.length > 0,
  });

  const resubmit = http.post(`${BASE_URL}/api/v1/kyc/me/resubmit`, null, json(tutorToken));
  check(resubmit, {
    "resubmit 200": (r) => r.status === 200,
    "resubmit creates version 2": (r) => r.json().data.version === 2,
  });

  const submit2 = http.post(`${BASE_URL}/api/v1/kyc/me/submit`, null, json(tutorToken));
  check(submit2, {
    "resubmission submit 200": (r) => r.status === 200,
    "resubmission is PENDING again": (r) => r.json().data.status === "PENDING",
  });

  // ── Identity approval ──
  const currentApp = mustJson(getMyApplication(tutorToken), "get application v2").data
    .application;

  const detail = http.get(
    `${BASE_URL}/api/v1/admin/kyc/applications/${currentApp.id}`,
    json(adminToken)
  );
  check(detail, { "application detail 200": (r) => r.status === 200 });

  const approveIdentity = http.post(
    `${BASE_URL}/api/v1/admin/kyc/applications/${currentApp.id}/approve-identity`,
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
  check(approveIdentity, { "approve identity 200": (r) => r.status === 200 });

  const incompleteChecklist = http.post(
    `${BASE_URL}/api/v1/admin/kyc/applications/${currentApp.id}/approve-identity`,
    JSON.stringify({
      checklist: {
        cniNumberMatchesDocument: true,
        selfieMatchesCniPhoto: false,
        documentTypeMatchesDeclaration: true,
        degreeMatchesFieldOfStudy: true,
        subjectsSupportedByCredentials: true,
      },
    }),
    json(adminToken)
  );
  check(incompleteChecklist, {
    "approve with incomplete checklist is rejected": (r) => r.status === 400,
  });

  // ── Subject approval -> tutor goes ACTIVE ──
  const subjectQueue = http.get(`${BASE_URL}/api/v1/admin/kyc/subjects/queue`, json(adminToken));
  check(subjectQueue, { "subject queue 200": (r) => r.status === 200 });
  const allSubjects = [
    ...subjectQueue.json().data.recommendApprove,
    ...subjectQueue.json().data.recommendReview,
    ...subjectQueue.json().data.newDocumentationRequired,
  ];
  const ourSubject = allSubjects.find(
    (s) => s.tutorSubject.subjectId === seed.subjectId
  );
  check(null, { "our subject appears in the queue": () => !!ourSubject });

  if (ourSubject) {
    const approveSubject = http.post(
      `${BASE_URL}/api/v1/admin/kyc/subjects/${ourSubject.tutorSubject.id}/approve`,
      JSON.stringify({ trainWeight: 85 }),
      json(adminToken)
    );
    check(approveSubject, { "approve subject 200": (r) => r.status === 200 });
  }

  const afterSubjectApproval = getMyApplication(tutorToken);
  check(afterSubjectApproval, {
    "tutor is ACTIVE after first subject approval": (r) =>
      r.json().data.kycStatus === "ACTIVE",
  });

  // ── Suspend / unsuspend ──
  const tutorProfileId = currentApp.tutorProfileId;

  const suspendTooShort = http.post(
    `${BASE_URL}/api/v1/admin/kyc/tutors/${tutorProfileId}/suspend`,
    JSON.stringify({ reason: "too short" }),
    json(adminToken)
  );
  check(suspendTooShort, {
    "suspend rejects a reason under 20 chars": (r) => r.status === 400,
  });

  const suspend = http.post(
    `${BASE_URL}/api/v1/admin/kyc/tutors/${tutorProfileId}/suspend`,
    JSON.stringify({ reason: "Repeated no-shows reported by multiple parents" }),
    json(adminToken)
  );
  check(suspend, { "suspend 200": (r) => r.status === 200 });

  const suspendedLogin = login(TUTOR_EMAIL, TUTOR_PASSWORD);
  check(suspendedLogin, {
    "suspended tutor cannot log in": (r) => r.status === 403,
  });

  const unsuspend = http.post(
    `${BASE_URL}/api/v1/admin/kyc/tutors/${tutorProfileId}/unsuspend`,
    null,
    json(adminToken)
  );
  check(unsuspend, { "unsuspend 200": (r) => r.status === 200 });

  const loginAfterUnsuspend = login(TUTOR_EMAIL, TUTOR_PASSWORD);
  check(loginAfterUnsuspend, {
    "tutor can log in again after unsuspend": (r) => r.status === 200,
  });
}

function getUserId(token) {
  const payload = token.split(".")[1];
  const decoded = JSON.parse(encoding.b64decode(payload, "rawurl", "s"));
  return decoded.id;
}
