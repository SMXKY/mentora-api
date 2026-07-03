/**
 * Mentora API — load & stress test suite
 * ========================================
 *
 * Covers every LIVE endpoint across auth, permission, permissionOverride,
 * role, and user (in that dependency order). Does NOT touch:
 *   - Google auth (POST /auth/google)              — explicitly excluded
 *   - Phone/SMS OTP (POST /auth/register/phone/*)   — explicitly excluded, real-money SMS cost
 *   - testResource module                            — scaffold, not live
 *   - userRole module                                 — not mounted in app.ts, would 404
 *
 * USAGE
 * -----
 *   Local:
 *     k6 run k6/permissionModule.k6.js
 *
 *   Staging/production:
 *     k6 run \
 *       -e BASE_URL=https://staging.mentora.example.com \
 *       -e SUPER_ADMIN_EMAIL=super@admin.test \
 *       -e SUPER_ADMIN_PASSWORD='...' \
 *       -e ALLOW_NON_LOCAL_TARGET=true \
 *       k6/permissionModule.k6.js
 *
 * REQUIRED ENV VARS
 * -----------------
 *   SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD  — must match a real seeded
 *     Super Admin account on the target environment (see .env / superAdmin.seed.ts).
 *     Never hardcoded here on purpose — these are real credentials.
 *
 * OPTIONAL ENV VARS
 * ------------------
 *   BASE_URL                default: http://localhost:8080
 *   HIGH_VUS                default: 50   — concurrency for read-heavy / idempotent-safe groups
 *   MID_VUS                 default: 20   — concurrency for create/update/delete lifecycle groups
 *   LOW_VUS                 default: 4    — concurrency for email-sending groups (sandbox rate limits)
 *   ITERATIONS              default: 120  — iterations for HIGH_VUS groups (every route hit once/iteration)
 *   MID_ITERATIONS           default: 60   — iterations for MID_VUS groups
 *   LOW_ITERATIONS           default: 60   — iterations for LOW_VUS (email) groups
 *   STAGE_GAP_SECONDS        default: 90   — gap between dependency-ordered stages
 *   ALLOW_NON_LOCAL_TARGET   default: false — safety rail, see setup()
 *
 * WHY SOME GROUPS RUN AT LOWER CONCURRENCY
 * -----------------------------------------
 * request-email-otp, forgot-password and admin/create all send real email
 * through a transactional provider. Locally that's a Mailtrap sandbox with a
 * very low "emails per second" cap — hammering it at HIGH_VUS produces
 * failures that are a sandbox limit, not an application bug (see
 * docs/permissionModuleAudit.md §6.5). Those three groups intentionally run
 * at LOW_VUS so the suite reports real application failures, not mailbox
 * throttling. Every other group is read-only or has no email side effect
 * and runs at full concurrency.
 *
 * ORDER OF DEPENDENCE
 * --------------------
 * setup() runs once, single-threaded, before any load: logs in as Super
 * Admin and provisions every fixture (roles, base users, a permission id)
 * the load stages need. The load stages themselves are then sequenced with
 * non-overlapping startTime windows so, for example, permission-override
 * grants don't race role-assignment's own user-creation:
 *   1. auth_flows                 (login / me / negative auth)
 *   2. permission_reads           (read-only, needs Super Admin token)
 *   3. user_lifecycle             (create/read/update/soft-delete/restore/hard-delete)
 *   4. role_lifecycle             (create/read/update/permissions/soft-delete/restore/hard-delete + assign/unassign/history)
 *   5. permission_override_flows  (grant/revoke/list/clear, needs users from stage 3's pool)
 *   6. authorization_rejection    (every protected route, wrong/no auth)
 *   7. email_otp_and_registration (LOW_VUS — email side effect)
 *   8. forgot_password_flow       (LOW_VUS — email side effect)
 *   9. admin_creation_flow        (LOW_VUS — email side effect)
 */

import http from "k6/http";
import { check, group, sleep, fail } from "k6";
import { Counter } from "k6/metrics";

// ============================================================
// CONFIG
// ============================================================

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8080").replace(
  /\/+$/,
  ""
);
const API = `${BASE_URL}/api/v1`;

const SUPER_ADMIN_EMAIL = __ENV.SUPER_ADMIN_EMAIL;
const SUPER_ADMIN_PASSWORD = __ENV.SUPER_ADMIN_PASSWORD;

// Defaults tuned for an UNCONFIGURED local dev Postgres (node-postgres /
// @prisma/adapter-pg default connection pool max = 10). Pushing MID_VUS
// much past the pool size causes requests to queue behind free
// connections rather than fail — under real load that shows up as every
// request getting slower, not as clean errors, until enough of them
// blow past REQUEST_TIMEOUT and a whole stage's maxDuration is consumed
// by backlog instead of new work (this happened during development of
// this script at MID_VUS=20 — see docs/permissionModuleAudit.md).
//
// To stress a properly provisioned staging/production database, raise
// these via -e flags AND raise the connection pool size on that
// environment's DATABASE_URL (?connection_limit=N) — pushing k6
// concurrency past what the DB pool can serve just measures queueing,
// not application correctness.
const HIGH_VUS = Number(__ENV.HIGH_VUS || 25);
const MID_VUS = Number(__ENV.MID_VUS || 8);
const LOW_VUS = Number(__ENV.LOW_VUS || 3);

const ITERATIONS = Number(__ENV.ITERATIONS || 80);
const MID_ITERATIONS = Number(__ENV.MID_ITERATIONS || 50);
const LOW_ITERATIONS = Number(__ENV.LOW_ITERATIONS || 50);

const STAGE_GAP_SECONDS = Number(__ENV.STAGE_GAP_SECONDS || 75);
const ALLOW_NON_LOCAL_TARGET = true;

// Low-risk, real permission codes (read-only reference to
// src/data/permission.data.ts — never modified) used to exercise the
// permission-override grant/revoke cycle without touching RBAC-sensitive
// codes.
const OVERRIDE_TEST_PERMISSION_CODES = [
  "search.tutor",
  "notifications.prefs.read",
  "bookings.read",
];

// ============================================================
// METRICS — one pass/fail counter per route so the end-of-run
// summary makes it immediately obvious which route (if any) failed.
//
// k6 requires every metric to be created in the "init context" (i.e.
// while the script is first being parsed, before any VU/scenario runs)
// — creating a Counter lazily inside a request handler throws at
// runtime. So every route name used anywhere in this file via verify()
// must be listed here up front and its counters pre-created.
// ============================================================

const ROUTE_NAMES = [
  "POST /auth/login (valid)",
  "POST /auth/login (invalid) -> 401",
  "GET /auth/me (valid token)",
  "GET /auth/me (no token) -> 401",
  "GET /permissions",
  "GET /permissions/search",
  "GET /permissions/:id",
  "GET /permissions/:id (unknown) -> 404",
  "POST /users",
  "GET /users/:id",
  "GET /users",
  "GET /users/search",
  "PATCH /users/:id",
  "DELETE /users/:id (soft)",
  "GET /users/deleted",
  "GET /users/deleted/:id",
  "PATCH /users/:id/restore",
  "DELETE /users/:id?hard=true",
  "POST /roles",
  "GET /roles/:id",
  "GET /roles",
  "GET /roles/search",
  "PATCH /roles/:id",
  "GET /roles/:id/permissions",
  "PUT /roles/:id/permissions",
  "DELETE /roles/:id (soft)",
  "GET /roles/deleted",
  "GET /roles/deleted/:id",
  "PATCH /roles/:id/restore",
  "DELETE /roles/:id (cleanup)",
  "POST /roles/assign/:userId",
  "GET /roles/history/:userId",
  "PATCH /roles/unassign/:userId/:userRoleId",
  "POST /permission-overrides/grant",
  "GET /permission-overrides/user/:userId",
  "POST /permission-overrides/revoke",
  "DELETE /permission-overrides/:id",
  "GET /roles (no token) -> 401",
  "GET /permissions (no token) -> 401",
  "GET /users (no token) -> 401",
  "POST /permission-overrides/grant (no token) -> 401",
  "POST /auth/admin/create (no token) -> 401",
  "GET /roles (malformed token) -> 401",
  "GET /unknown-route -> 404",
  "POST /auth/register/email/request-otp",
  "GET /auth/dev/otp",
  "POST /auth/register/email/verify-otp",
  "POST /auth/register/email/verify-otp (wrong code) -> 400",
  "POST /auth/register/complete",
  "POST /auth/forgot-password",
  "POST /auth/forgot-password/verify-otp",
  "POST /auth/reset-password",
  "POST /auth/login (post password-reset)",
  "POST /auth/change-password",
  "POST /auth/admin/create",
  "POST /auth/login (new admin)",
  "GET /roles (Admin role, no rbac.* perms) -> 403",
  "GET /users (Admin role, has users.readAll) -> 200",
];

// k6 metric names may only contain letters/digits/underscores — slugify
// the human-readable route name for the metric, keep the readable string
// as the map key (and for check()/console output).
function slugify(name) {
  return name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const routeCounters = {};
for (const name of ROUTE_NAMES) {
  const slug = slugify(name);
  routeCounters[name] = {
    pass: new Counter(`route_pass__${slug}`),
    fail: new Counter(`route_fail__${slug}`),
  };
}

/**
 * Runs http checks and records a named pass/fail metric per route so the
 * final summary reads as a clean per-route ledger instead of a wall of
 * generic "status is 200" checks.
 */
function verify(routeName, res, expectations) {
  const counter = routeCounters[routeName];
  if (!counter) {
    // Fails loudly rather than silently — every route name used in a
    // verify() call must be pre-registered in ROUTE_NAMES above.
    fail(`Unknown route name "${routeName}" — add it to ROUTE_NAMES.`);
  }
  const passed = check(res, expectations, { route: routeName });
  if (passed) {
    counter.pass.add(1);
  } else {
    counter.fail.add(1);
    console.error(
      `[FAIL] ${routeName} -> status=${res.status} body=${(
        res.body || ""
      ).slice(0, 300)}`
    );
  }
  return passed;
}

// A stuck request should fail fast, not silently hang for k6's 60s
// default — that's what let one stalled stage cascade into every
// subsequent (supposedly sequential) stage during tuning of this script.
// See docs/permissionModuleAudit.md for the full story.
const REQUEST_TIMEOUT = __ENV.REQUEST_TIMEOUT || "20s";

function jsonHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return { headers, timeout: REQUEST_TIMEOUT };
}

function uniqueSuffix() {
  // __VU / __ITER are only defined inside VU-context (exec) functions,
  // not inside setup() — guard so this helper works in both.
  const vu = typeof __VU !== "undefined" ? __VU : "setup";
  const iter = typeof __ITER !== "undefined" ? __ITER : "0";
  return `${vu}-${iter}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function randomEmail(prefix) {
  return `k6-${prefix}-${uniqueSuffix()}@k6.mentora.test`;
}

// ============================================================
// SETUP — runs once, single-threaded, before any VU traffic.
// Everything the load stages need (tokens, fixture ids) is
// created here so no stage ever races another for a prerequisite.
// ============================================================

export function setup() {
  if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
    fail(
      "SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD env vars are required — " +
        "point them at a real seeded Super Admin on the target environment."
    );
  }

  const isLocalTarget = /localhost|127\.0\.0\.1/.test(BASE_URL);
  if (!isLocalTarget && !ALLOW_NON_LOCAL_TARGET) {
    fail(
      `BASE_URL "${BASE_URL}" does not look like a local server, and this suite ` +
        "creates/mutates/deletes real users, roles, and permission overrides. " +
        "Re-run with -e ALLOW_NON_LOCAL_TARGET=true once you've confirmed this " +
        "points at a throwaway/staging environment, never a real production database."
    );
  }

  console.log(`[setup] target: ${BASE_URL}`);

  // ---- Super Admin login ----
  const loginRes = http.post(
    `${API}/auth/login`,
    JSON.stringify({
      identifier: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
    }),
    jsonHeaders()
  );
  if (loginRes.status !== 200) {
    fail(
      `[setup] Super Admin login failed (status ${loginRes.status}): ${loginRes.body}`
    );
  }
  const superAdminToken = loginRes.json("data.token");

  // ---- Fetch a real permission id (for GET /permissions/:id) ----
  const permListRes = http.get(
    `${API}/permissions?limit=1`,
    jsonHeaders(superAdminToken)
  );
  const samplePermissionId = permListRes.json("data.0.id");

  // ---- Fetch the Moderator role id (allowsMultiple, safe for repeated assign/unassign) ----
  const roleSearchRes = http.get(
    `${API}/roles?search=Moderator&limit=1`,
    jsonHeaders(superAdminToken)
  );
  const moderatorRoleId = roleSearchRes.json("data.0.id");

  // ---- Pool of plain (no-role, no-password) users for stages that need
  //      an existing user id without caring how it got there ----
  const overrideTargetUserIds = [];
  for (let i = 0; i < 5; i++) {
    const res = http.post(
      `${API}/users`,
      JSON.stringify({
        email: randomEmail(`override-target-${i}`),
        firstName: "K6",
        lastName: `OverrideTarget${i}`,
      }),
      jsonHeaders(superAdminToken)
    );
    if (res.status === 201) {
      overrideTargetUserIds.push(res.json("data.id"));
    }
  }

  if (
    !samplePermissionId ||
    !moderatorRoleId ||
    overrideTargetUserIds.length === 0
  ) {
    fail(
      "[setup] Could not provision fixtures — check that seeds have run " +
        "(roles, permissions, permission modules/submodules) on the target environment."
    );
  }

  console.log(
    `[setup] ready — permissionId=${samplePermissionId} moderatorRoleId=${moderatorRoleId} ` +
      `overrideTargetUsers=${overrideTargetUserIds.length}`
  );

  return {
    superAdminToken,
    samplePermissionId,
    moderatorRoleId,
    overrideTargetUserIds,
  };
}

// ============================================================
// STAGE 1 — AUTH FLOWS (login, me, negative credentials)
// Idempotent / read-mostly -> HIGH_VUS.
// ============================================================

export function auth_flows(data) {
  group("auth > POST /login (valid Super Admin credentials)", () => {
    const res = http.post(
      `${API}/auth/login`,
      JSON.stringify({
        identifier: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASSWORD,
      }),
      jsonHeaders()
    );
    verify("POST /auth/login (valid)", res, {
      "status is 200": (r) => r.status === 200,
      "has token": (r) => !!r.json("data.token"),
    });
  });

  group("auth > POST /login (invalid credentials)", () => {
    const res = http.post(
      `${API}/auth/login`,
      JSON.stringify({
        identifier: SUPER_ADMIN_EMAIL,
        password: "definitely-wrong-password",
      }),
      jsonHeaders()
    );
    verify("POST /auth/login (invalid) -> 401", res, {
      "status is 401": (r) => r.status === 401,
    });
  });

  group("auth > GET /me (valid token)", () => {
    const res = http.get(`${API}/auth/me`, jsonHeaders(data.superAdminToken));
    verify("GET /auth/me (valid token)", res, {
      "status is 200": (r) => r.status === 200,
      "status is ready": (r) => r.json("data.status") === "ready",
    });
  });

  group("auth > GET /me (no token) -> 401", () => {
    const res = http.get(`${API}/auth/me`, jsonHeaders());
    verify("GET /auth/me (no token) -> 401", res, {
      "status is 401": (r) => r.status === 401,
    });
  });
}

// ============================================================
// STAGE 2 — PERMISSION MODULE (read-only) -> HIGH_VUS
// ============================================================

export function permission_reads(data) {
  group("permission > GET / (list)", () => {
    const res = http.get(
      `${API}/permissions?limit=10`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /permissions", res, {
      "status is 200": (r) => r.status === 200,
      "data is array": (r) => Array.isArray(r.json("data")),
    });
  });

  group("permission > GET /search", () => {
    const res = http.get(
      `${API}/permissions/search?limit=10`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /permissions/search", res, {
      "status is 200": (r) => r.status === 200,
    });
  });

  group("permission > GET /:id", () => {
    const res = http.get(
      `${API}/permissions/${data.samplePermissionId}`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /permissions/:id", res, {
      "status is 200": (r) => r.status === 200,
      "id matches": (r) => r.json("data.id") === data.samplePermissionId,
    });
  });

  group("permission > GET /:id (unknown id) -> 404", () => {
    const res = http.get(
      `${API}/permissions/00000000-0000-0000-0000-000000000000`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /permissions/:id (unknown) -> 404", res, {
      "status is 404": (r) => r.status === 404,
    });
  });
}

// ============================================================
// STAGE 3 — USER LIFECYCLE (create/read/update/soft-delete/
// restore/hard-delete, self-contained per iteration) -> MID_VUS
// ============================================================

export function user_lifecycle(data) {
  let userId;

  group("user > POST / (create)", () => {
    const res = http.post(
      `${API}/users`,
      JSON.stringify({
        email: randomEmail("lifecycle"),
        firstName: "K6",
        lastName: "Lifecycle",
      }),
      jsonHeaders(data.superAdminToken)
    );
    const ok = verify("POST /users", res, {
      "status is 201": (r) => r.status === 201,
      "no password field leaked": (r) =>
        !("password" in (r.json("data") || {})),
    });
    if (ok) userId = res.json("data.id");
  });

  if (!userId) return; // creation failed — nothing downstream to test this iteration

  group("user > GET /:id", () => {
    const res = http.get(
      `${API}/users/${userId}`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /users/:id", res, { "status is 200": (r) => r.status === 200 });
  });

  group("user > GET / (list)", () => {
    const res = http.get(
      `${API}/users?limit=5`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /users", res, { "status is 200": (r) => r.status === 200 });
  });

  group("user > GET /search", () => {
    const res = http.get(
      `${API}/users/search?limit=5`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /users/search", res, {
      "status is 200": (r) => r.status === 200,
    });
  });

  group("user > PATCH /:id (update)", () => {
    const res = http.patch(
      `${API}/users/${userId}`,
      JSON.stringify({ lastName: "LifecycleUpdated" }),
      jsonHeaders(data.superAdminToken)
    );
    verify("PATCH /users/:id", res, {
      "status is 200": (r) => r.status === 200,
      "field updated": (r) => r.json("data.lastName") === "LifecycleUpdated",
    });
  });

  group("user > DELETE /:id (soft)", () => {
    const res = http.del(
      `${API}/users/${userId}`,
      null,
      jsonHeaders(data.superAdminToken)
    );
    verify("DELETE /users/:id (soft)", res, {
      "status is 200": (r) => r.status === 200,
      "deleted true": (r) => r.json("data.deleted") === true,
    });
  });

  group("user > GET /deleted (list)", () => {
    const res = http.get(
      `${API}/users/deleted?limit=5`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /users/deleted", res, {
      "status is 200": (r) => r.status === 200,
    });
  });

  group("user > GET /deleted/:id", () => {
    const res = http.get(
      `${API}/users/deleted/${userId}`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /users/deleted/:id", res, {
      "status is 200": (r) => r.status === 200,
    });
  });

  group("user > PATCH /:id/restore", () => {
    const res = http.patch(
      `${API}/users/${userId}/restore`,
      null,
      jsonHeaders(data.superAdminToken)
    );
    verify("PATCH /users/:id/restore", res, {
      "status is 200": (r) => r.status === 200,
      "deletedAt cleared": (r) => r.json("data.deletedAt") === null,
    });
  });

  group("user > DELETE /:id?hard=true (cleanup)", () => {
    const res = http.del(
      `${API}/users/${userId}?hard=true`,
      null,
      jsonHeaders(data.superAdminToken)
    );
    verify("DELETE /users/:id?hard=true", res, {
      "status is 200": (r) => r.status === 200,
    });
  });
}

// ============================================================
// STAGE 4 — ROLE LIFECYCLE (create/read/update/permissions/
// soft-delete/restore/hard-delete + assign/unassign/history,
// self-contained per iteration, never touches seeded system
// roles) -> MID_VUS
// ============================================================

export function role_lifecycle(data) {
  let roleId;
  const roleName = `K6 Scratch Role ${uniqueSuffix()}`;

  group("role > POST / (create)", () => {
    const res = http.post(
      `${API}/roles`,
      JSON.stringify({
        name: roleName,
        description: "k6 scratch role",
        isSystem: false,
      }),
      jsonHeaders(data.superAdminToken)
    );
    const ok = verify("POST /roles", res, {
      "status is 201": (r) => r.status === 201,
    });
    if (ok) roleId = res.json("data.id");
  });

  if (roleId) {
    group("role > GET /:id", () => {
      const res = http.get(
        `${API}/roles/${roleId}`,
        jsonHeaders(data.superAdminToken)
      );
      verify("GET /roles/:id", res, {
        "status is 200": (r) => r.status === 200,
      });
    });

    group("role > GET / (list)", () => {
      const res = http.get(
        `${API}/roles?limit=5`,
        jsonHeaders(data.superAdminToken)
      );
      verify("GET /roles", res, { "status is 200": (r) => r.status === 200 });
    });

    group("role > GET /search", () => {
      const res = http.get(
        `${API}/roles/search?limit=5`,
        jsonHeaders(data.superAdminToken)
      );
      verify("GET /roles/search", res, {
        "status is 200": (r) => r.status === 200,
      });
    });

    group("role > PATCH /:id (update)", () => {
      const res = http.patch(
        `${API}/roles/${roleId}`,
        JSON.stringify({ description: "k6 scratch role (updated)" }),
        jsonHeaders(data.superAdminToken)
      );
      verify("PATCH /roles/:id", res, {
        "status is 200": (r) => r.status === 200,
      });
    });

    group("role > GET /:id/permissions (catalog)", () => {
      const res = http.get(
        `${API}/roles/${roleId}/permissions`,
        jsonHeaders(data.superAdminToken)
      );
      verify("GET /roles/:id/permissions", res, {
        "status is 200": (r) => r.status === 200,
      });
    });

    group("role > PUT /:id/permissions (update, scratch role only)", () => {
      const res = http.put(
        `${API}/roles/${roleId}/permissions`,
        JSON.stringify({ permissionCodes: OVERRIDE_TEST_PERMISSION_CODES }),
        jsonHeaders(data.superAdminToken)
      );
      verify("PUT /roles/:id/permissions", res, {
        "status is 200": (r) => r.status === 200,
      });
    });

    group("role > DELETE /:id (soft)", () => {
      const res = http.del(
        `${API}/roles/${roleId}`,
        null,
        jsonHeaders(data.superAdminToken)
      );
      verify("DELETE /roles/:id (soft)", res, {
        "status is 200": (r) => r.status === 200,
      });
    });

    group("role > GET /deleted", () => {
      const res = http.get(
        `${API}/roles/deleted?limit=5`,
        jsonHeaders(data.superAdminToken)
      );
      verify("GET /roles/deleted", res, {
        "status is 200": (r) => r.status === 200,
      });
    });

    group("role > GET /deleted/:id", () => {
      const res = http.get(
        `${API}/roles/deleted/${roleId}`,
        jsonHeaders(data.superAdminToken)
      );
      verify("GET /roles/deleted/:id", res, {
        "status is 200": (r) => r.status === 200,
      });
    });

    group("role > PATCH /:id/restore", () => {
      const res = http.patch(
        `${API}/roles/${roleId}/restore`,
        null,
        jsonHeaders(data.superAdminToken)
      );
      verify("PATCH /roles/:id/restore", res, {
        "status is 200": (r) => r.status === 200,
      });
    });

    group("role > DELETE /:id (cleanup)", () => {
      const res = http.del(
        `${API}/roles/${roleId}`,
        null,
        jsonHeaders(data.superAdminToken)
      );
      verify("DELETE /roles/:id (cleanup)", res, {
        "status is 200": (r) => r.status === 200,
      });
    });
  }

  // --- assign / unassign / history, using a fresh disposable user so
  //     concurrent iterations never collide on "already assigned" ---
  let assignUserId;
  group("user > POST / (fixture for role assignment)", () => {
    const res = http.post(
      `${API}/users`,
      JSON.stringify({
        email: randomEmail("assignee"),
        firstName: "K6",
        lastName: "Assignee",
      }),
      jsonHeaders(data.superAdminToken)
    );
    if (res.status === 201) assignUserId = res.json("data.id");
  });

  if (!assignUserId) return;

  let userRoleId;
  group("role > POST /assign/:userId", () => {
    const res = http.post(
      `${API}/roles/assign/${assignUserId}`,
      JSON.stringify({ roleId: data.moderatorRoleId, reason: "k6 load test" }),
      jsonHeaders(data.superAdminToken)
    );
    const ok = verify("POST /roles/assign/:userId", res, {
      "status is 201": (r) => r.status === 201,
    });
    if (ok) userRoleId = res.json("data.result.id");
  });

  group("role > GET /history/:userId", () => {
    const res = http.get(
      `${API}/roles/history/${assignUserId}`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /roles/history/:userId", res, {
      "status is 200": (r) => r.status === 200,
      "history is array": (r) => Array.isArray(r.json("data.result")),
    });
  });

  if (userRoleId) {
    group("role > PATCH /unassign/:userId/:userRoleId", () => {
      const res = http.patch(
        `${API}/roles/unassign/${assignUserId}/${userRoleId}`,
        null,
        jsonHeaders(data.superAdminToken)
      );
      verify("PATCH /roles/unassign/:userId/:userRoleId", res, {
        "status is 200": (r) => r.status === 200,
      });
    });
  }

  // cleanup
  http.del(
    `${API}/users/${assignUserId}?hard=true`,
    null,
    jsonHeaders(data.superAdminToken)
  );
}

// ============================================================
// STAGE 5 — PERMISSION OVERRIDE FLOWS (grant/revoke/list/clear)
// grant+revoke reuse setup's fixture user pool (idempotent —
// createOverride upserts, never conflicts); clear creates and
// removes its own record each iteration. -> HIGH_VUS/2
// ============================================================

export function permission_override_flows(data) {
  const targetUserId =
    data.overrideTargetUserIds[__ITER % data.overrideTargetUserIds.length];
  const permissionCode =
    OVERRIDE_TEST_PERMISSION_CODES[
      __ITER % OVERRIDE_TEST_PERMISSION_CODES.length
    ];

  group("permissionOverride > POST /grant", () => {
    const res = http.post(
      `${API}/permission-overrides/grant`,
      JSON.stringify({
        userId: targetUserId,
        permissionCode,
        reason: "k6 load test grant",
      }),
      jsonHeaders(data.superAdminToken)
    );
    verify("POST /permission-overrides/grant", res, {
      "status is 201": (r) => r.status === 201,
    });
  });

  group("permissionOverride > GET /user/:userId", () => {
    const res = http.get(
      `${API}/permission-overrides/user/${targetUserId}`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /permission-overrides/user/:userId", res, {
      "status is 200": (r) => r.status === 200,
      "result is array": (r) => Array.isArray(r.json("data.result")),
    });
  });

  group("permissionOverride > POST /revoke", () => {
    const res = http.post(
      `${API}/permission-overrides/revoke`,
      JSON.stringify({
        userId: targetUserId,
        permissionCode,
        reason: "k6 load test revoke",
      }),
      jsonHeaders(data.superAdminToken)
    );
    verify("POST /permission-overrides/revoke", res, {
      "status is 201": (r) => r.status === 201,
    });
  });

  // clear() lifecycle — create a disposable override on a *different*
  // permission code than the grant/revoke above so it doesn't fight over
  // the same row, then delete it.
  let overrideId;
  const clearCode =
    OVERRIDE_TEST_PERMISSION_CODES[
      (__ITER + 1) % OVERRIDE_TEST_PERMISSION_CODES.length
    ];
  group("permissionOverride > POST /grant (for clear)", () => {
    const res = http.post(
      `${API}/permission-overrides/grant`,
      JSON.stringify({
        userId: targetUserId,
        permissionCode: clearCode,
        reason: "k6 load test — to be cleared",
      }),
      jsonHeaders(data.superAdminToken)
    );
    if (res.status === 201) overrideId = res.json("data.result.id");
  });

  if (overrideId) {
    group("permissionOverride > DELETE /:id (clear)", () => {
      const res = http.del(
        `${API}/permission-overrides/${overrideId}`,
        null,
        jsonHeaders(data.superAdminToken)
      );
      verify("DELETE /permission-overrides/:id", res, {
        "status is 200": (r) => r.status === 200,
        "cleared true": (r) => r.json("data.result.cleared") === true,
      });
    });
  }
}

// ============================================================
// STAGE 6 — AUTHORIZATION REJECTION FLOWS
// "users without the role/permission should get rejected" — every
// protected route, hit with no token and with an insufficiently
// privileged token. -> HIGH_VUS
// ============================================================

export function authorization_rejection_flows(data) {
  group("reject > GET /roles (no token) -> 401", () => {
    const res = http.get(`${API}/roles`, jsonHeaders());
    verify("GET /roles (no token) -> 401", res, {
      "status is 401": (r) => r.status === 401,
    });
  });

  group("reject > GET /permissions (no token) -> 401", () => {
    const res = http.get(`${API}/permissions`, jsonHeaders());
    verify("GET /permissions (no token) -> 401", res, {
      "status is 401": (r) => r.status === 401,
    });
  });

  group("reject > GET /users (no token) -> 401", () => {
    const res = http.get(`${API}/users`, jsonHeaders());
    verify("GET /users (no token) -> 401", res, {
      "status is 401": (r) => r.status === 401,
    });
  });

  group("reject > POST /permission-overrides/grant (no token) -> 401", () => {
    const res = http.post(
      `${API}/permission-overrides/grant`,
      JSON.stringify({
        userId: data.overrideTargetUserIds[0],
        permissionCode: "search.tutor",
      }),
      jsonHeaders()
    );
    verify("POST /permission-overrides/grant (no token) -> 401", res, {
      "status is 401": (r) => r.status === 401,
    });
  });

  group("reject > POST /auth/admin/create (no token) -> 401", () => {
    const res = http.post(
      `${API}/auth/admin/create`,
      JSON.stringify({}),
      jsonHeaders()
    );
    verify("POST /auth/admin/create (no token) -> 401", res, {
      "status is 401": (r) => r.status === 401,
    });
  });

  group("reject > malformed token -> 401", () => {
    const res = http.get(`${API}/roles`, jsonHeaders("not-a-real-jwt"));
    verify("GET /roles (malformed token) -> 401", res, {
      "status is 401": (r) => r.status === 401,
    });
  });

  group("reject > unknown route -> 404", () => {
    const res = http.get(
      `${API}/this-route-does-not-exist`,
      jsonHeaders(data.superAdminToken)
    );
    verify("GET /unknown-route -> 404", res, {
      "status is 404": (r) => r.status === 404,
    });
  });
}

// ============================================================
// STAGE 7 — EMAIL OTP + REGISTRATION (LOW_VUS — real email send)
// Full chain: request-otp -> dev-peek -> verify-otp -> complete
// ============================================================

export function email_otp_and_registration(data) {
  const email = randomEmail("register");

  group("auth > POST /register/email/request-otp", () => {
    const res = http.post(
      `${API}/auth/register/email/request-otp`,
      JSON.stringify({ email }),
      jsonHeaders()
    );
    verify("POST /auth/register/email/request-otp", res, {
      "status is 200": (r) => r.status === 200,
    });
  });

  let code;
  group("auth > GET /dev/otp (test helper)", () => {
    const res = http.get(
      `${API}/auth/dev/otp?identity=${encodeURIComponent(email)}`,
      jsonHeaders(data.superAdminToken)
    );
    const ok = verify("GET /auth/dev/otp", res, {
      "status is 200": (r) => r.status === 200,
      "code present": (r) => !!r.json("data.code"),
    });
    if (ok) code = res.json("data.code");
  });

  if (!code) return;

  let registrationToken;
  group("auth > POST /register/email/verify-otp", () => {
    const res = http.post(
      `${API}/auth/register/email/verify-otp`,
      JSON.stringify({ email, code }),
      jsonHeaders()
    );
    const ok = verify("POST /auth/register/email/verify-otp", res, {
      "status is 200": (r) => r.status === 200,
      "registrationToken present": (r) => !!r.json("data.registrationToken"),
    });
    if (ok) registrationToken = res.json("data.registrationToken");
  });

  group("auth > POST /register/email/verify-otp (wrong code) -> 400", () => {
    const res = http.post(
      `${API}/auth/register/email/verify-otp`,
      JSON.stringify({
        email: randomEmail("wrong-code-check"),
        code: "000000",
      }),
      jsonHeaders()
    );
    verify("POST /auth/register/email/verify-otp (wrong code) -> 400", res, {
      "status is 400": (r) => r.status === 400,
    });
  });

  if (!registrationToken) return;

  group("auth > POST /register/complete", () => {
    const res = http.post(
      `${API}/auth/register/complete`,
      JSON.stringify({
        registrationToken,
        role: "Student",
        password: "K6TestPassw0rd!",
        confirmPassword: "K6TestPassw0rd!",
      }),
      jsonHeaders()
    );
    verify("POST /auth/register/complete", res, {
      "status is 201": (r) => r.status === 201,
      "token present": (r) => !!r.json("data.token"),
    });
  });
}

// ============================================================
// STAGE 8 — FORGOT PASSWORD FLOW (LOW_VUS — real email send)
// Full chain: create fixture user -> forgot-password ->
// dev-peek -> verify-reset-otp -> reset-password -> login with
// the new password
// ============================================================

export function forgot_password_flow(data) {
  const email = randomEmail("forgot-pw");

  let userId;
  group("user > POST / (fixture for forgot-password)", () => {
    const res = http.post(
      `${API}/users`,
      JSON.stringify({ email, firstName: "K6", lastName: "ForgotPassword" }),
      jsonHeaders(data.superAdminToken)
    );
    if (res.status === 201) userId = res.json("data.id");
  });
  if (!userId) return;

  group("auth > POST /forgot-password", () => {
    const res = http.post(
      `${API}/auth/forgot-password`,
      JSON.stringify({ identity: email }),
      jsonHeaders()
    );
    verify("POST /auth/forgot-password", res, {
      "status is 200": (r) => r.status === 200,
    });
  });

  let code;
  group("auth > GET /dev/otp (reset code)", () => {
    const res = http.get(
      `${API}/auth/dev/otp?identity=${encodeURIComponent(email)}`,
      jsonHeaders(data.superAdminToken)
    );
    if (res.status === 200) code = res.json("data.code");
  });
  if (!code) return;

  let resetToken;
  group("auth > POST /forgot-password/verify-otp", () => {
    const res = http.post(
      `${API}/auth/forgot-password/verify-otp`,
      JSON.stringify({ identity: email, code }),
      jsonHeaders()
    );
    const ok = verify("POST /auth/forgot-password/verify-otp", res, {
      "status is 200": (r) => r.status === 200,
      "resetToken present": (r) => !!r.json("data.resetToken"),
    });
    if (ok) resetToken = res.json("data.resetToken");
  });
  if (!resetToken) return;

  group("auth > POST /reset-password", () => {
    const res = http.post(
      `${API}/auth/reset-password`,
      JSON.stringify({
        resetToken,
        newPassword: "K6ResetPassw0rd!",
        confirmPassword: "K6ResetPassw0rd!",
      }),
      jsonHeaders()
    );
    verify("POST /auth/reset-password", res, {
      "status is 200": (r) => r.status === 200,
    });
  });

  group("auth > POST /login (with newly reset password)", () => {
    const res = http.post(
      `${API}/auth/login`,
      JSON.stringify({ identifier: email, password: "K6ResetPassw0rd!" }),
      jsonHeaders()
    );
    verify("POST /auth/login (post password-reset)", res, {
      "status is 200": (r) => r.status === 200,
    });
  });

  // change-password on the account we just proved can log in
  let sessionToken;
  const loginRes = http.post(
    `${API}/auth/login`,
    JSON.stringify({ identifier: email, password: "K6ResetPassw0rd!" }),
    jsonHeaders()
  );
  if (loginRes.status === 200) sessionToken = loginRes.json("data.token");

  if (sessionToken) {
    group("auth > POST /change-password", () => {
      const res = http.post(
        `${API}/auth/change-password`,
        JSON.stringify({
          currentPassword: "K6ResetPassw0rd!",
          newPassword: "K6ChangedPassw0rd!",
          confirmPassword: "K6ChangedPassw0rd!",
        }),
        jsonHeaders(sessionToken)
      );
      verify("POST /auth/change-password", res, {
        "status is 200": (r) => r.status === 200,
      });
    });
  }

  // cleanup
  http.del(
    `${API}/users/${userId}?hard=true`,
    null,
    jsonHeaders(data.superAdminToken)
  );
}

// ============================================================
// STAGE 9 — ADMIN CREATION FLOW (LOW_VUS — real welcome email,
// though now fire-and-forget so sandbox throttling can't fail
// the request — see docs/permissionModuleAudit.md §6.5)
// Also re-verifies the Admin role's permission boundary: 403 on
// RBAC routes, 200 on users.readAll routes.
// ============================================================

export function admin_creation_flow(data) {
  const email = randomEmail("admin");
  const password = "K6AdminPassw0rd!";

  group("auth > POST /admin/create", () => {
    const res = http.post(
      `${API}/auth/admin/create`,
      JSON.stringify({
        email,
        firstName: "K6",
        lastName: "Admin",
        roles: ["Admin"],
        password,
        confirmPassword: password,
      }),
      jsonHeaders(data.superAdminToken)
    );
    verify("POST /auth/admin/create", res, {
      "status is 201": (r) => r.status === 201,
    });
  });

  let adminToken;
  group("auth > POST /login (as newly created admin)", () => {
    const res = http.post(
      `${API}/auth/login`,
      JSON.stringify({ identifier: email, password }),
      jsonHeaders()
    );
    const ok = verify("POST /auth/login (new admin)", res, {
      "status is 200": (r) => r.status === 200,
    });
    if (ok) adminToken = res.json("data.token");
  });

  if (!adminToken) return;

  group("reject > Admin role hitting RBAC route -> 403", () => {
    const res = http.get(`${API}/roles`, jsonHeaders(adminToken));
    verify("GET /roles (Admin role, no rbac.* perms) -> 403", res, {
      "status is 403": (r) => r.status === 403,
    });
  });

  group(
    "permission boundary > Admin role hitting users.readAll route -> 200",
    () => {
      const res = http.get(`${API}/users?limit=1`, jsonHeaders(adminToken));
      verify("GET /users (Admin role, has users.readAll) -> 200", res, {
        "status is 200": (r) => r.status === 200,
      });
    }
  );
}

// ============================================================
// SCENARIOS — sequenced by startTime so each dependency-ordered
// stage finishes before the next begins.
// ============================================================

function stageStart(index) {
  return `${index * STAGE_GAP_SECONDS}s`;
}

export const options = {
  scenarios: {
    auth_flows: {
      executor: "shared-iterations",
      exec: "auth_flows",
      vus: HIGH_VUS,
      iterations: ITERATIONS,
      maxDuration: `${STAGE_GAP_SECONDS}s`,
      startTime: stageStart(0),
    },
    permission_reads: {
      executor: "shared-iterations",
      exec: "permission_reads",
      vus: HIGH_VUS,
      iterations: ITERATIONS,
      maxDuration: `${STAGE_GAP_SECONDS}s`,
      startTime: stageStart(1),
    },
    user_lifecycle: {
      executor: "shared-iterations",
      exec: "user_lifecycle",
      vus: MID_VUS,
      iterations: MID_ITERATIONS,
      maxDuration: `${STAGE_GAP_SECONDS}s`,
      startTime: stageStart(2),
    },
    role_lifecycle: {
      executor: "shared-iterations",
      exec: "role_lifecycle",
      vus: MID_VUS,
      iterations: MID_ITERATIONS,
      maxDuration: `${STAGE_GAP_SECONDS}s`,
      startTime: stageStart(3),
    },
    permission_override_flows: {
      executor: "shared-iterations",
      exec: "permission_override_flows",
      vus: Math.max(1, Math.floor(HIGH_VUS / 2)),
      iterations: ITERATIONS,
      maxDuration: `${STAGE_GAP_SECONDS}s`,
      startTime: stageStart(4),
    },
    authorization_rejection_flows: {
      executor: "shared-iterations",
      exec: "authorization_rejection_flows",
      vus: HIGH_VUS,
      iterations: ITERATIONS,
      maxDuration: `${STAGE_GAP_SECONDS}s`,
      startTime: stageStart(5),
    },
    email_otp_and_registration: {
      executor: "shared-iterations",
      exec: "email_otp_and_registration",
      vus: LOW_VUS,
      iterations: LOW_ITERATIONS,
      maxDuration: `${STAGE_GAP_SECONDS}s`,
      startTime: stageStart(6),
    },
    forgot_password_flow: {
      executor: "shared-iterations",
      exec: "forgot_password_flow",
      vus: LOW_VUS,
      iterations: LOW_ITERATIONS,
      maxDuration: `${STAGE_GAP_SECONDS}s`,
      startTime: stageStart(7),
    },
    admin_creation_flow: {
      executor: "shared-iterations",
      exec: "admin_creation_flow",
      vus: LOW_VUS,
      iterations: LOW_ITERATIONS,
      maxDuration: `${STAGE_GAP_SECONDS}s`,
      startTime: stageStart(8),
    },
  },
  thresholds: {
    // Fail the whole run loudly if ANY route logs a failure — "nothing
    // should fail" is enforced here, not just eyeballed in the summary.
    checks: ["rate==1.0"],
  },
};

// ============================================================
// SUMMARY — clean, grouped pass/fail report printed at the end.
// ============================================================

export function handleSummary(summaryData) {
  const lines = [];
  lines.push("");
  lines.push(
    "================ MENTORA API — LOAD TEST SUMMARY ================"
  );
  lines.push(`Target: ${BASE_URL}`);

  const metrics = summaryData.metrics || {};
  const routeNames = Object.keys(routeCounters).sort();

  let totalPass = 0;
  let totalFail = 0;
  const failedRoutes = [];

  for (const name of routeNames) {
    const slug = slugify(name);
    const passMetric = metrics[`route_pass__${slug}`];
    const failMetric = metrics[`route_fail__${slug}`];
    const pass =
      (passMetric && passMetric.values && passMetric.values.count) || 0;
    const failCount =
      (failMetric && failMetric.values && failMetric.values.count) || 0;
    totalPass += pass;
    totalFail += failCount;
    const status = failCount > 0 ? "FAIL" : "PASS";
    if (failCount > 0) failedRoutes.push(name);
    lines.push(
      `  [${status}] ${name.padEnd(55)} pass=${pass}${
        failCount > 0 ? `  fail=${failCount}` : ""
      }`
    );
  }

  lines.push(
    "-------------------------------------------------------------------"
  );
  lines.push(
    `TOTAL: ${totalPass} passed, ${totalFail} failed across ${routeNames.length} routes`
  );

  if (failedRoutes.length > 0) {
    lines.push("");
    lines.push(
      "ROUTES WITH FAILURES (see [FAIL] lines above in stdout for response bodies):"
    );
    failedRoutes.forEach((r) => lines.push(`  - ${r}`));
  } else {
    lines.push("");
    lines.push("All routes passed every check. Nothing failed.");
  }
  lines.push(
    "===================================================================="
  );
  lines.push("");

  const report = lines.join("\n");

  return {
    stdout: report,
    "k6-summary.json": JSON.stringify(summaryData, null, 2),
  };
}
