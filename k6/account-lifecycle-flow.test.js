/**
 * Account lifecycle end-to-end flow (k6) — completion tracking, profile
 * self-service, admin suspension, and self-deactivation/reactivation.
 *
 * Prerequisites:
 *   - Dev server running with real .env credentials: npm run dev
 *   - SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD set (same super admin the
 *     seed script creates — see k6/permissionModule.k6.js for the same
 *     convention).
 *
 * Run:  npm run test:k6:account-lifecycle
 *   or: k6 run k6/account-lifecycle-flow.test.js
 *
 * Covers:
 *   1. GET /auth/me/completion reflects real missing items and shrinks
 *      as PATCH /users/me fills them in.
 *   2. PATCH /users/me/profile-picture through the real media pipeline.
 *   3. Admin suspend: reason required (400 without one), suspended user's
 *      already-issued token is rejected on its very next request (JTI
 *      blocklist, not waiting for expiry), suspended login is rejected,
 *      unsuspend restores login.
 *   4. Self-deactivate (password-confirmed), old token dead immediately,
 *      reactivate within the grace period issues a fresh session.
 *
 * Google-auth (passwordless) deactivation via OTP is not covered here —
 * there is no way to obtain a real Google id_token from a load-testing
 * script, the same reason Push/WhatsApp are excluded from the
 * notification flow test.
 */
import http from "k6/http";
import encoding from "k6/encoding";
import { check, sleep, fail } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
const SUPER_ADMIN_EMAIL = __ENV.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = __ENV.SUPER_ADMIN_PASSWORD;
const EMAIL_BASE = __ENV.K6_EMAIL_BASE || "smookeymykomhr+k6lifecycle";
const EMAIL_DOMAIN = __ENV.K6_EMAIL_DOMAIN || "gmail.com";
const PASSWORD = "K6LifecycleTest#12345";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ["rate==1.0"] },
};

const jsonHeaders = { "Content-Type": "application/json" };
const auth = (token) => ({
  headers: { ...jsonHeaders, Authorization: `Bearer ${token}` },
});
// No Content-Type override — k6 must set its own multipart boundary header.
const authMultipart = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

function mustJson(res, label) {
  const body = res.json();
  if (!body) fail(`${label}: response was not JSON (status ${res.status})`);
  return body;
}

/** Registers a fresh user through the real email OTP flow (retries through
 * the sandbox email provider's per-second rate limit). */
function registerUser(tag, role) {
  const email = `${EMAIL_BASE}.${tag}.${Date.now()}@${EMAIL_DOMAIN}`;

  let reqOtp;
  for (let attempt = 0; attempt < 6; attempt++) {
    reqOtp = http.post(
      `${BASE_URL}/api/v1/auth/register/email/request-otp`,
      JSON.stringify({ email }),
      { headers: jsonHeaders }
    );
    if (reqOtp.status === 200) break;
    sleep(8 + attempt * 8);
  }
  check(reqOtp, { [`${tag}: request-otp 200`]: (r) => r.status === 200 });

  const peek = http.get(
    `${BASE_URL}/api/v1/auth/dev/otp?identity=${encodeURIComponent(email)}`
  );
  check(peek, { [`${tag}: dev otp peek 200`]: (r) => r.status === 200 });
  const code = mustJson(peek, "otp peek").data.code;

  const verify = http.post(
    `${BASE_URL}/api/v1/auth/register/email/verify-otp`,
    JSON.stringify({ email, code }),
    { headers: jsonHeaders }
  );
  check(verify, { [`${tag}: verify-otp 200`]: (r) => r.status === 200 });
  const registrationToken = mustJson(verify, "verify-otp").data.registrationToken;

  const complete = http.post(
    `${BASE_URL}/api/v1/auth/register/complete`,
    JSON.stringify({
      registrationToken,
      role,
      password: PASSWORD,
      confirmPassword: PASSWORD,
    }),
    { headers: jsonHeaders }
  );
  check(complete, { [`${tag}: register complete 201`]: (r) => r.status === 201 });
  const token = mustJson(complete, "register complete").data.token;

  return { email, token };
}

function loginAsSuperAdmin() {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    fail(
      "SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD must be set to run the admin suspension checks"
    );
  }
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      identifier: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
    }),
    { headers: jsonHeaders }
  );
  check(res, { "super admin login 200": (r) => r.status === 200 });
  return mustJson(res, "super admin login").data.token;
}

export default function () {
  // ── 1. Completion tracking shrinks as fields are filled in ──
  const user = registerUser("completion", "Student");

  const before = http.get(
    `${BASE_URL}/api/v1/auth/me/completion`,
    auth(user.token)
  );
  check(before, {
    "completion: initial 200": (r) => r.status === 200,
    "completion: starts incomplete": (r) =>
      r.json().data.completionStatus === "incomplete",
    "completion: full_name missing before update": (r) =>
      r.json().data.missing.includes("full_name"),
    "completion: phone_number missing before update": (r) =>
      r.json().data.missing.includes("phone_number"),
  });
  const missingBefore = before.json().data.missing.length;

  const patchMe = http.patch(
    `${BASE_URL}/api/v1/users/me`,
    JSON.stringify({
      firstName: "K6",
      lastName: "Tester",
      phoneNumber: "+237600000001",
    }),
    auth(user.token)
  );
  check(patchMe, { "patch /users/me 200": (r) => r.status === 200 });

  const after = http.get(
    `${BASE_URL}/api/v1/auth/me/completion`,
    auth(user.token)
  );
  check(after, {
    "completion: 200 after update": (r) => r.status === 200,
    "completion: full_name no longer missing": (r) =>
      !r.json().data.missing.includes("full_name"),
    "completion: phone_number no longer missing": (r) =>
      !r.json().data.missing.includes("phone_number"),
    "completion: fewer missing items than before": (r) =>
      r.json().data.missing.length < missingBefore,
  });

  // ── 2. Profile picture through the real media pipeline ──
  // 1x1 red-pixel PNG — genuine magic bytes, passes content sniffing.
  const tinyPng = http.file(
    encoding.b64decode(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    ),
    "avatar.png",
    "image/png"
  );
  const pfpForm = { profilePicture: tinyPng };
  const pfp = http.patch(
    `${BASE_URL}/api/v1/users/me/profile-picture`,
    pfpForm,
    authMultipart(user.token)
  );
  check(pfp, {
    "profile picture 200": (r) => r.status === 200,
    "profile picture returns a url": (r) =>
      r.status === 200 && !!r.json().data.url,
  });

  // ── 3. Admin suspension ──
  const adminToken = loginAsSuperAdmin();
  const suspendTarget = registerUser("suspend", "Student");

  const noReason = http.post(
    `${BASE_URL}/api/v1/admin/users/${getUserId(suspendTarget.token)}/suspend`,
    JSON.stringify({}),
    auth(adminToken)
  );
  check(noReason, {
    "suspend without reason is 400": (r) => r.status === 400,
  });

  const targetId = getUserId(suspendTarget.token);
  const suspend = http.post(
    `${BASE_URL}/api/v1/admin/users/${targetId}/suspend`,
    JSON.stringify({ reason: "k6 automated test suspension" }),
    auth(adminToken)
  );
  check(suspend, { "suspend with reason 200": (r) => r.status === 200 });

  // The token issued before suspension must die on its very next request —
  // this is the whole point of the JTI blocklist over waiting for expiry.
  const afterSuspendMe = http.get(
    `${BASE_URL}/api/v1/auth/me`,
    auth(suspendTarget.token)
  );
  check(afterSuspendMe, {
    "suspended user's live token rejected immediately": (r) =>
      r.status === 401,
  });

  const suspendedLogin = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ identifier: suspendTarget.email, password: PASSWORD }),
    { headers: jsonHeaders }
  );
  check(suspendedLogin, {
    "suspended account login rejected with 403": (r) => r.status === 403,
  });

  const unsuspend = http.post(
    `${BASE_URL}/api/v1/admin/users/${targetId}/unsuspend`,
    null,
    auth(adminToken)
  );
  check(unsuspend, { "unsuspend 200": (r) => r.status === 200 });

  const loginAfterUnsuspend = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ identifier: suspendTarget.email, password: PASSWORD }),
    { headers: jsonHeaders }
  );
  check(loginAfterUnsuspend, {
    "login succeeds again after unsuspend": (r) => r.status === 200,
  });

  // ── 4. Self-deactivation + reactivation ──
  sleep(20); // stay clear of the email provider's per-second rate limit —
  // suspend/unsuspend above already sent two more real emails
  const deactivateUser = registerUser("deactivate", "Student");

  const deactivate = http.post(
    `${BASE_URL}/api/v1/auth/me/deactivate`,
    JSON.stringify({ password: PASSWORD }),
    auth(deactivateUser.token)
  );
  check(deactivate, { "deactivate 200": (r) => r.status === 200 });

  const afterDeactivateMe = http.get(
    `${BASE_URL}/api/v1/auth/me`,
    auth(deactivateUser.token)
  );
  check(afterDeactivateMe, {
    "deactivated user's live token rejected immediately": (r) =>
      r.status === 401,
  });

  const reactivate = http.post(
    `${BASE_URL}/api/v1/auth/me/reactivate`,
    JSON.stringify({ identifier: deactivateUser.email, password: PASSWORD }),
    { headers: jsonHeaders }
  );
  check(reactivate, {
    "reactivate 200": (r) => r.status === 200,
    "reactivate returns a fresh token": (r) =>
      r.status === 200 && !!r.json().data.token,
  });

  const newToken = reactivate.status === 200 ? reactivate.json().data.token : null;
  if (newToken) {
    const meAfterReactivate = http.get(
      `${BASE_URL}/api/v1/auth/me`,
      auth(newToken)
    );
    check(meAfterReactivate, {
      "reactivated account usable again": (r) => r.status === 200,
    });
  }
}

/** Decodes the JWT payload (no verification needed — trusted, just-issued
 * local token) to pull the user id for the admin suspend/unsuspend calls. */
function getUserId(token) {
  const payload = token.split(".")[1];
  const decoded = JSON.parse(encoding.b64decode(payload, "rawurl", "s"));
  return decoded.id;
}
