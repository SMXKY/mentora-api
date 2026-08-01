/**
 * Modules 11/13/16 — Booking, Payment/Escrow, and Lesson Confirmation &
 * Disputes end-to-end flow (k6).
 *
 * Prerequisites:
 *   1. Dev server running with real .env credentials: npm run dev
 *      (FAPSHI_IS_LIVE must be "false" — this test relies on Fapshi's
 *      documented sandbox test-number outcomes being simulated in-process)
 *   2. Seeded tutor + parent + student profile + availability + rates:
 *      ts-node k6/support/seed-booking-fixtures.ts
 *      (npm run test:k6:booking does both steps for you)
 *   3. SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD set — used to resolve the
 *      dispute in the second flow.
 *
 * Flow A (happy path): request -> accept -> wallet top-up -> wallet
 * checkout -> escrow hold -> home check-in/check-out (both sides) ->
 * booker confirms -> escrow released to tutor wallet -> receipt generated
 * -> double-blind reviews submitted and revealed on both sides.
 *
 * Flow B (dispute path): request -> accept -> direct-MoMo checkout ->
 * check-in/check-out -> booker opens a dispute -> tutor responds -> admin
 * resolves PARENT_FAVOR -> escrow refunded to the parent's wallet.
 */
import http from "k6/http";
import { check, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const SUPER_ADMIN_EMAIL = __ENV.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = __ENV.SUPER_ADMIN_PASSWORD;

const seed = JSON.parse(open("./fixtures/booking-seed.json"));
const TEST_PASSWORD = "K6BookingFlowTest#12345";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ["rate==1.0"] },
};

const json = (token) => ({ headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });

function mustJson(res, label) {
  const body = res.json();
  if (!body) fail(`${label}: response was not JSON (status ${res.status}, body: ${res.body})`);
  return body;
}

function login(identifier, password, isAdmin) {
  return http.post(
    `${BASE_URL}/api/v1/auth/${isAdmin ? "admin" : "user"}/login`,
    JSON.stringify({ identifier, password }),
    { headers: { "Content-Type": "application/json" } }
  );
}

function loginOrFail(identifier, password, label, isAdmin) {
  const res = login(identifier, password, isAdmin);
  check(res, { [`${label}: login 200`]: (r) => r.status === 200 });
  if (res.status !== 200) fail(`${label}: could not log in — did you run the seed script?`);
  return mustJson(res, label).data.token;
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function hhmm(d) {
  return d.toISOString().slice(11, 16);
}

function requestBooking(token, tutorProfileId, startOffsetMinutes, sessionType) {
  const start = new Date(Date.now() + startOffsetMinutes * 60000);
  const res = http.post(
    `${BASE_URL}/api/v1/bookings`,
    JSON.stringify({
      tutorProfileId,
      studentProfileId: seed.studentProfileId,
      subjectId: seed.subjectId,
      levelId: seed.levelId,
      sessionType,
      sessionDate: ymd(start),
      sessionStartTime: hhmm(start),
      durationMinutes: 30,
      messageToTutor: "k6 flow test booking",
    }),
    json(token)
  );
  return res;
}

export default function () {
  const tutorToken = loginOrFail(seed.tutorEmail, TEST_PASSWORD, "tutor");
  const tutor2Token = loginOrFail(seed.tutor2Email, TEST_PASSWORD, "tutor2");
  const parentToken = loginOrFail(seed.parentEmail, TEST_PASSWORD, "parent");

  // ============================================================
  // Flow A — happy path: wallet checkout -> confirm -> review
  // ============================================================
  const createA = requestBooking(parentToken, seed.tutorProfileId, 1, "HOME");
  check(createA, { "[A] create booking 201": (r) => r.status === 201 });
  const bookingA = mustJson(createA, "[A] create").data.booking;

  const acceptA = http.post(`${BASE_URL}/api/v1/bookings/${bookingA.id}/accept`, null, json(tutorToken));
  check(acceptA, { "[A] accept 200": (r) => r.status === 200 });

  const topup = http.post(
    `${BASE_URL}/api/v1/payments/wallet/topup`,
    JSON.stringify({ amountXaf: 20000, phone: seed.momoSuccessPhone }),
    json(parentToken)
  );
  check(topup, { "[A] wallet topup 200": (r) => r.status === 200 });

  const checkoutA = http.post(
    `${BASE_URL}/api/v1/payments/bookings/${bookingA.id}/checkout/wallet`,
    null,
    json(parentToken)
  );
  check(checkoutA, {
    "[A] wallet checkout 200": (r) => r.status === 200,
    "[A] checkout status SUCCESSFUL": (r) => mustJson(r, "[A] checkout").data.status === "SUCCESSFUL",
  });

  const tutorCheckInA = http.post(`${BASE_URL}/api/v1/bookings/${bookingA.id}/check-in`, null, json(tutorToken));
  check(tutorCheckInA, { "[A] tutor check-in 200": (r) => r.status === 200 });
  const bookerCheckInA = http.post(`${BASE_URL}/api/v1/bookings/${bookingA.id}/check-in`, null, json(parentToken));
  check(bookerCheckInA, {
    "[A] booker check-in 200": (r) => r.status === 200,
    "[A] status IN_PROGRESS after both check in": (r) => mustJson(r, "[A] booker check-in").data.booking.status === "IN_PROGRESS",
  });

  const tutorCheckOutA = http.post(`${BASE_URL}/api/v1/bookings/${bookingA.id}/check-out`, null, json(tutorToken));
  check(tutorCheckOutA, {
    "[A] tutor check-out 200": (r) => r.status === 200,
    "[A] status AWAITING_CONFIRMATION after tutor checks out": (r) =>
      mustJson(r, "[A] tutor check-out").data.booking.status === "AWAITING_CONFIRMATION",
  });

  const confirmA = http.post(`${BASE_URL}/api/v1/bookings/${bookingA.id}/confirm`, null, json(parentToken));
  check(confirmA, {
    "[A] confirm 200": (r) => r.status === 200,
    "[A] status CONFIRMED": (r) => mustJson(r, "[A] confirm").data.booking.status === "CONFIRMED",
  });

  const tutorWalletAfter = http.get(`${BASE_URL}/api/v1/payments/wallet`, json(tutorToken));
  check(tutorWalletAfter, {
    "[A] tutor wallet credited with net amount": (r) => mustJson(r, "[A] tutor wallet").data.wallet.balanceXaf >= 6800,
  });

  const receipts = http.get(`${BASE_URL}/api/v1/payments/receipts`, json(parentToken));
  check(receipts, {
    "[A] a receipt was generated": (r) => mustJson(r, "[A] receipts").data.receipts.length > 0,
  });

  const reviewByParent = http.post(
    `${BASE_URL}/api/v1/reviews/bookings/${bookingA.id}/review`,
    JSON.stringify({ overallRating: 5, wouldRebook: true, writtenReview: "Great session!" }),
    json(parentToken)
  );
  check(reviewByParent, { "[A] parent review 201": (r) => r.status === 201 });

  const reviewByTutor = http.post(
    `${BASE_URL}/api/v1/reviews/bookings/${bookingA.id}/review`,
    JSON.stringify({ overallRating: 5, wouldRebook: true }),
    json(tutorToken)
  );
  check(reviewByTutor, {
    "[A] tutor review 201": (r) => r.status === 201,
    "[A] both reviews revealed once both submitted": (r) => mustJson(r, "[A] tutor review").data.review.status === "REVEALED",
  });

  const tutorReviews = http.get(`${BASE_URL}/api/v1/reviews/tutors/${seed.tutorProfileId}`);
  check(tutorReviews, {
    "[A] tutor's revealed review is publicly listed": (r) => mustJson(r, "[A] tutor reviews").data.data.length > 0,
  });

  // ============================================================
  // Flow B — dispute path: direct-MoMo checkout -> dispute -> resolve
  // ============================================================
  // Booked with the second seeded tutor (a distinct calendar) rather than
  // offsetting the time — the check-in window only opens within 15 minutes
  // of the real scheduled start, so a second near-now HOME booking can't
  // share flow A's tutor without colliding with flow A's occupied slot.
  const createB = requestBooking(parentToken, seed.tutorProfileId2, 1, "HOME");
  check(createB, { "[B] create booking 201": (r) => r.status === 201 });
  const bookingB = mustJson(createB, "[B] create").data.booking;

  const acceptB = http.post(`${BASE_URL}/api/v1/bookings/${bookingB.id}/accept`, null, json(tutor2Token));
  check(acceptB, { "[B] accept 200": (r) => r.status === 200 });

  const checkoutB = http.post(
    `${BASE_URL}/api/v1/payments/bookings/${bookingB.id}/checkout/direct-momo`,
    JSON.stringify({ phone: seed.momoSuccessPhone }),
    json(parentToken)
  );
  check(checkoutB, {
    "[B] direct-momo checkout 200": (r) => r.status === 200,
    "[B] checkout status SUCCESSFUL": (r) => mustJson(r, "[B] checkout").data.status === "SUCCESSFUL",
  });

  const tutorCheckInB = http.post(`${BASE_URL}/api/v1/bookings/${bookingB.id}/check-in`, null, json(tutor2Token));
  check(tutorCheckInB, { "[B] tutor check-in 200": (r) => r.status === 200 });
  const bookerCheckInB = http.post(`${BASE_URL}/api/v1/bookings/${bookingB.id}/check-in`, null, json(parentToken));
  check(bookerCheckInB, { "[B] booker check-in 200": (r) => r.status === 200 });

  const tutorCheckOutB = http.post(`${BASE_URL}/api/v1/bookings/${bookingB.id}/check-out`, null, json(tutor2Token));
  check(tutorCheckOutB, {
    "[B] status AWAITING_CONFIRMATION after tutor checks out": (r) =>
      mustJson(r, "[B] tutor check-out").data.booking.status === "AWAITING_CONFIRMATION",
  });

  const parentWalletBeforeDispute = mustJson(
    http.get(`${BASE_URL}/api/v1/payments/wallet`, json(parentToken)),
    "[B] parent wallet before"
  ).data.wallet.balanceXaf;

  const openDispute = http.post(
    `${BASE_URL}/api/v1/disputes/bookings/${bookingB.id}/dispute`,
    JSON.stringify({
      reason: "LESSON_SIGNIFICANTLY_SHORTER",
      description: "The session ended after only a few minutes and did not cover the agreed material.",
    }),
    json(parentToken)
  );
  check(openDispute, { "[B] open dispute 201": (r) => r.status === 201 });
  const dispute = mustJson(openDispute, "[B] open dispute").data.dispute;

  const respondDispute = http.post(
    `${BASE_URL}/api/v1/disputes/${dispute.id}/respond`,
    JSON.stringify({ statement: "I did teach the full agreed session, there was a connection issue." }),
    json(tutor2Token)
  );
  check(respondDispute, {
    "[B] tutor responds 200": (r) => r.status === 200,
    "[B] status AWAITING_ADMIN after response": (r) => mustJson(r, "[B] respond").data.dispute.status === "AWAITING_ADMIN",
  });

  const adminToken = loginOrFail(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, "admin", true);
  const resolveDispute = http.post(
    `${BASE_URL}/api/v1/disputes/${dispute.id}/resolve`,
    JSON.stringify({
      resolution: "PARENT_FAVOR",
      reason: "Evidence supports the parent's account of a significantly shortened session.",
    }),
    json(adminToken)
  );
  check(resolveDispute, {
    "[B] admin resolves 200": (r) => r.status === 200,
    "[B] status RESOLVED_PARENT_FAVOR": (r) =>
      mustJson(r, "[B] resolve").data.dispute.status === "RESOLVED_PARENT_FAVOR",
  });

  const parentWalletAfter = http.get(`${BASE_URL}/api/v1/payments/wallet`, json(parentToken));
  check(parentWalletAfter, {
    "[B] parent wallet refunded": (r) =>
      mustJson(r, "[B] parent wallet after").data.wallet.balanceXaf >= parentWalletBeforeDispute + 8000,
  });
}
