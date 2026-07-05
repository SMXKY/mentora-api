/**
 * Smoke test for the catalog lookups, Student self-service, Parent →
 * children, and Tutor public-profile endpoints.
 *
 * Prerequisites: dev server running (npm run dev). Reuses the KYC test
 * tutor fixture (k6/support/seed-kyc-test-tutor.ts) to verify the public
 * GET /tutors/:id endpoint against a tutor that has actually gone ACTIVE
 * through the real KYC flow — run `npm run test:k6:kyc` at least once
 * first, or this tutor won't be ACTIVE yet (public profile check is
 * skipped gracefully if so, not failed).
 */
import http from "k6/http";
import { check, fail, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const seed = JSON.parse(open("./fixtures/kyc-seed.json"));

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ["rate==1.0"] },
};

const json = (token) => ({
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
});

function mustJson(res, label) {
  const body = res.json();
  if (!body) fail(`${label}: response was not JSON (status ${res.status}, body: ${res.body})`);
  return body;
}

function registerUser(tag, role) {
  const email = `${tag}.${Date.now()}@mentora.test`;
  const password = "K6ProfilesTest#12345";

  let reqOtp;
  for (let attempt = 0; attempt < 6; attempt++) {
    reqOtp = http.post(
      `${BASE_URL}/api/v1/auth/register/email/request-otp`,
      JSON.stringify({ email }),
      { headers: { "Content-Type": "application/json" } }
    );
    if (reqOtp.status === 200) break;
    sleep(8 + attempt * 8);
  }
  check(reqOtp, { [`${tag}: request-otp 200`]: (r) => r.status === 200 });

  const peek = http.get(
    `${BASE_URL}/api/v1/auth/dev/otp?identity=${encodeURIComponent(email)}`
  );
  const code = mustJson(peek, "otp peek").data.code;

  const verify = http.post(
    `${BASE_URL}/api/v1/auth/register/email/verify-otp`,
    JSON.stringify({ email, code }),
    { headers: { "Content-Type": "application/json" } }
  );
  const registrationToken = mustJson(verify, "verify-otp").data.registrationToken;

  const complete = http.post(
    `${BASE_URL}/api/v1/auth/register/complete`,
    JSON.stringify({ registrationToken, role, password, confirmPassword: password }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(complete, { [`${tag}: register complete 201`]: (r) => r.status === 201 });
  return mustJson(complete, "register complete").data.token;
}

export default function () {
  // ── Catalog lookups (public) ──
  const regions = http.get(`${BASE_URL}/api/v1/regions`);
  check(regions, { "regions 200": (r) => r.status === 200 });

  const cities = http.get(`${BASE_URL}/api/v1/cities?regionId=${seed.regionId}`);
  check(cities, {
    "cities 200": (r) => r.status === 200,
    "cities filtered by region": (r) =>
      r.json().data.every((c) => c.regionId === seed.regionId),
  });

  const subjects = http.get(`${BASE_URL}/api/v1/subjects?search=Math`);
  check(subjects, { "subjects 200": (r) => r.status === 200 });

  const levels = http.get(`${BASE_URL}/api/v1/levels`);
  check(levels, { "levels 200": (r) => r.status === 200 });

  // ── Student self-service ──
  const studentToken = registerUser("student", "Student");

  const beforeProfile = http.get(`${BASE_URL}/api/v1/students/me`, json(studentToken));
  check(beforeProfile, {
    "student: no profile yet returns null": (r) =>
      r.status === 200 && r.json().data.profile === null,
  });

  const createStudent = http.patch(
    `${BASE_URL}/api/v1/students/me`,
    JSON.stringify({ firstName: "K6 Student" }),
    json(studentToken)
  );
  check(createStudent, { "student: create profile 200": (r) => r.status === 200 });

  const addSubject = http.post(
    `${BASE_URL}/api/v1/students/me/subjects`,
    JSON.stringify({ subjectId: seed.subjectId }),
    json(studentToken)
  );
  check(addSubject, { "student: add subject 201": (r) => r.status === 201 });

  const afterProfile = mustJson(
    http.get(`${BASE_URL}/api/v1/students/me`, json(studentToken)),
    "student profile after subject"
  );
  check({ status: 200 }, {
    "student: subject appears on profile": () =>
      afterProfile.data.profile.subjects.some((s) => s.subjectId === seed.subjectId),
  });

  const removeSubject = http.del(
    `${BASE_URL}/api/v1/students/me/subjects/${seed.subjectId}`,
    null,
    json(studentToken)
  );
  check(removeSubject, { "student: remove subject 200": (r) => r.status === 200 });

  // ── Parent → children ──
  const parentToken = registerUser("parent", "Parent");

  const createChild = http.post(
    `${BASE_URL}/api/v1/parents/me/students`,
    JSON.stringify({ firstName: "K6 Child" }),
    json(parentToken)
  );
  check(createChild, { "parent: create child 201": (r) => r.status === 201 });
  const childId = createChild.json().data.id;

  const listChildren = http.get(`${BASE_URL}/api/v1/parents/me/students`, json(parentToken));
  check(listChildren, {
    "parent: list children 200": (r) => r.status === 200,
    "parent: child appears in list": (r) => r.json().data.some((c) => c.id === childId),
  });

  const updateChild = http.patch(
    `${BASE_URL}/api/v1/parents/me/students/${childId}`,
    JSON.stringify({ examOrGoal: "GCE A-Level" }),
    json(parentToken)
  );
  check(updateChild, { "parent: update child 200": (r) => r.status === 200 });

  const removeChild = http.del(
    `${BASE_URL}/api/v1/parents/me/students/${childId}`,
    null,
    json(parentToken)
  );
  check(removeChild, { "parent: remove child 200": (r) => r.status === 200 });

  const listAfterRemove = http.get(
    `${BASE_URL}/api/v1/parents/me/students`,
    json(parentToken)
  );
  check(listAfterRemove, {
    "parent: removed child no longer listed": (r) =>
      !r.json().data.some((c) => c.id === childId),
  });

  // ── Tutor self-service (fresh tutor, not yet ACTIVE) ──
  const tutorToken = registerUser("tutor", "Tutor");

  const createTutorProfile = http.patch(
    `${BASE_URL}/api/v1/tutors/me`,
    JSON.stringify({ bio: "K6 test tutor bio", teachingMode: "BOTH", cityId: seed.cityId }),
    json(tutorToken)
  );
  check(createTutorProfile, { "tutor: create profile 200": (r) => r.status === 200 });

  const pricingBeforeClaim = http.patch(
    `${BASE_URL}/api/v1/tutors/me/subjects/${seed.subjectId}`,
    JSON.stringify({ ratePerOnlineSessionXaf: 5000 }),
    json(tutorToken)
  );
  check(pricingBeforeClaim, {
    "tutor: pricing an unclaimed subject is rejected": (r) => r.status === 404,
  });

  // ── Public tutor profile — reuses the KYC-flow-tested tutor ──
  // Its status depends on run order: ACTIVE if `npm run test:k6:kyc` ran
  // most recently (its own seed step leaves this tutor ACTIVE at the end),
  // otherwise still INCOMPLETE/PENDING from a fresh reseed. Both are
  // valid, mutually exclusive outcomes for the same fixture — assert
  // whichever is actually true rather than requiring a specific run order.
  const fixtureProfile = http.get(`${BASE_URL}/api/v1/tutors/${seed.tutorProfileId}`);
  if (fixtureProfile.status === 200) {
    check(fixtureProfile, {
      "public profile hides KYC internals": (r) => r.json().data.kycStatus === undefined,
      "public profile exposes the approved subject": (r) =>
        r.json().data.tutorSubjects.some((s) => s.subject.id === seed.subjectId),
    });
  } else {
    check(fixtureProfile, {
      "fixture tutor not ACTIVE yet — 404 as expected": (r) => r.status === 404,
    });
  }

  const publicProfileForFreshTutor = http.get(
    `${BASE_URL}/api/v1/tutors/${JSON.parse(createTutorProfile.body).data.id}`
  );
  check(publicProfileForFreshTutor, {
    "public profile 404s for a non-ACTIVE tutor": (r) => r.status === 404,
  });
}
