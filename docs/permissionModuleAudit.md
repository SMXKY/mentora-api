# Permission Module Audit — Fixes Applied

Date: 2026-07-02
Scope: the 6 live modules (`auth`, `permission`, `permissionOverride`, `role`, `user`, `userRole`) plus shared code (`BaseRepository`, `middlewares`, `utils`, `i18n`, OpenAPI docs). `testResource` was left untouched entirely, per instruction — it is a scaffold template, not live functionality. `src/data/permission.data.ts` and every file under `src/seeds/` were left untouched, per instruction — no permission codes or role assignments were added, removed, or reassigned.

This document is the followup to a full codebase audit (routes/auth, i18n, permission system, error codes, logic quality, tests, OpenAPI docs). It records every fix applied against that audit, plus a few additional defects found while implementing and verifying the fixes (all confirmed live-testable, not just theoretical). Each entry says what was wrong, what changed, and why. Nothing here is a redesign — every fix is the smallest change that makes the flagged behavior correct.

Verification method: after each group of changes, `npx tsc --noEmit` was run clean, then the dev server was started and the affected endpoints were hit directly with `curl` (login, permission lookup, role assignment, permission-override grant, user creation, OTP request/verify, admin creation) to confirm the fix behaves as intended, not just that it compiles. See "Server verification" at the bottom.

---

## 1. Routes / auth middleware

### 1.1 `src/modules/auth/auth.route.ts` — `POST /admin/create` had no permission check
`restrictTo` was commented out (`// restrictTo("can_create_admin_account")`) — any authenticated user could create an admin account, and the commented-out code referenced a permission code (`can_create_admin_account`) that doesn't exist. Fixed by uncommenting and using `permissions.users.manage` (the same code the generic user-management routes already use). Since only Super Admin currently holds `users.manage` (via the `*` wildcard — see §3), this endpoint is now effectively Super-Admin-only, which is appropriate for an endpoint that creates Admin/Moderator/Support Agent accounts.

### 1.2 `src/modules/permission/permission.route.ts` — middleware order bug on `GET /:id`
`restrictTo(...)` ran *before* `protect`. Since `restrictTo` reads `res.locals.user`, which only `protect` populates, this route was broken for every legitimate caller. Fixed by swapping the order to `protect` → `restrictTo`. Verified live: `GET /api/v1/permissions/:id` now returns the record for an authenticated Super Admin instead of failing.

### 1.3 `src/modules/userRole/userRole.route.ts` — all 8 routes had `protect`/`restrictTo` fully commented out
Fixed by wiring real auth: `protect` on every route, and `restrictTo` using the same `permissions.rbac.roles*` codes that `role.route.ts`'s assign/unassign endpoints already use for the same underlying `UserRole` model (`rolesRead` for GET, `rolesUpdate` for create/update/restore, `rolesDelete` for delete).

**This module is intentionally left unmounted in `src/app.ts`** exactly as it was before this fix. Mounting it is a product decision (it would be a second, parallel route surface over the same data that `role.route.ts`'s `/assign`, `/unassign`, `/history` endpoints already serve), not a bug fix, so it wasn't made here. The auth gap is fixed so the module is now safe to mount later without a silent hole. The k6 script does not exercise these endpoints since they return 404 in the running app (unmounted).

---

## 2. Critical runtime bugs

### 2.1 `PermissionOverride` soft-delete misconfiguration (would throw on every request)
`src/modules/permissionOverride/permissionOverride.repository.ts` had `softDeleteConfig.enabled: true`, but the `PermissionOverride` Prisma model has no `deletedAt` column. `BaseRepository` unconditionally injects a `deletedAt` filter into every query when `enabled` is true, so `findById`, `findOne`, `findMany`, `count`, etc. would all throw a Prisma "unknown argument `deletedAt`" error. Fixed by setting `enabled: false` — this matches reality (overrides are removed outright via `clear()`, or superseded by a new `GRANT`/`REVOKE` row, never soft-deleted) and matches how `permission.repository.ts` and `userRole.repository.ts` are already configured for models without a `deletedAt` column.

As a consequence, `permissionOverride.service.ts`'s `clear()` method — which was doing a raw `prisma.permissionOverride.delete(...)` instead of going through the repository — was changed to call `this.repository.delete(overrideId)` instead, so the delete path is consistent with the rest of the codebase.

Verified live: `POST /api/v1/permission-overrides/grant` and `DELETE /api/v1/permission-overrides/:id` both work end-to-end now.

### 2.2 `role.controller.ts` — `appResponder` called with swapped arguments
The real signature is `appResponder(statusCode, data, res, meta?)`. `assignRole`, `unassignRole`, and `roleHistory` were calling `appResponder(statusCode, {message}, result, res)` — passing the Prisma record where `res` belongs, and the real `res` object as `meta`. This threw at runtime (`result.status is not a function`) on every hit. Fixed by folding `result` into the `data` object and passing `res` in the correct third position, matching the pattern already used everywhere else in this file (`getPermissionCatalog`, `updatePermissions`).

Verified live: `POST /api/v1/roles/assign/:userId` now returns a proper response instead of crashing.

---

## 3. Permission system

No changes were made to `src/data/permission.data.ts` or any file under `src/seeds/` — per instruction, the permission catalog and role assignments are treated as correct and out of scope, including every permission that currently sits unused or unassigned to any role except Super Admin's wildcard.

What *was* confirmed (read-only, no code change needed):
- Every `restrictTo(...)` call across all 6 live modules resolves to a real code in `permissions.*` — no invalid codes were being referenced in any active route.
- The RBAC-management codes (`rbac.*`) and `users.manage` are only assigned to Super Admin (via the `*` wildcard) — Admin, Moderator, Support Agent, Tutor, Parent, and Student hold none of them. This means the Admin role cannot pass any route guard on `role.route.ts`, `permission.route.ts`, `permissionOverride.route.ts`, or the mutating routes on `user.route.ts`. This is left exactly as-is (per instruction), and the k6 script (§7) treats it as expected behavior: Admin-role tests assert a `403`, not a `200`, on those routes.

---

## 4. Translation / i18n

Three whole namespaces were referenced throughout the codebase but had no backing JSON files at all, plus a few individual keys were missing from otherwise-complete namespaces. All of these degrade gracefully today (the i18n layer falls back to printing the raw key string rather than crashing — see `src/shared/i18n/t.ts`), so nothing was broken, but every user-facing error/success message in these paths was showing something like `role/errors:notFound` instead of real text.

- **New namespace `role/errors` + `role/success`** (en + fr) — backs every message in `role.service.ts`, `role.controller.ts`, `role.schema.ts`. While creating these from scratch, the keys were also renamed from the old inconsistent `snake_case` (`roles/errors:system_role_immutable`, plural namespace) to `camelCase` (`role/errors:systemRoleImmutable`, singular namespace matching the module directory `src/modules/role` and every other single-word namespace already in the codebase — `auth`, `otp`). All 3 source files were updated to reference the new keys.
- **New namespace `permissionOverride/errors` + `permissionOverride/success`** (en + fr) — same treatment for `permissionOverride.service.ts`, `permissionOverride.controller.ts`, `permissionOverride.schema.ts` (renamed from plural `permissionOverrides/*` to singular `permissionOverride/*`, matching the module directory name).
- **New namespace `permission/errors`** (en + fr) — one key, `readOnly`, used by the fixed `permission.service.ts` guard (see §5).
- **Fixed namespace `otp/errors`** (en + fr) — the file that existed, `en/otp/info.json`, had the wrong category name (`info` instead of `errors`, so it was never actually loaded for the keys the code references) *and* malformed content (keys were the literal string `"otp/errors:rateLimitExceeded"` with empty values, instead of a nested `{ rateLimitExceeded: "..." }` object). It was unreferenced anywhere in the codebase, so it was deleted and replaced with a correctly-named, correctly-nested, and correctly-populated `otp/errors.json` in both `en` and `fr` (no `fr` file existed at all before).
- **Additions to the existing `common/errors` namespace** (en + fr) — `db.notDeleted`, `db.softDeleteNotSupported`, `db.systemRecordImmutable` were referenced by `BaseRepository.ts` but missing from both locales. Added `server.ftpConfigMissing` too (see §5).
- **Additions to the existing `auth/errors` namespace** (en + fr) — `notAuthenticated` (already referenced by `role.service.ts`/`permissionOverride.service.ts`, missing from locale files) and a new `insufficientPermissions` key, both now also used by the fixed `restrictTo.middleware.ts` (see §5).

## 5. Error/success code conventions

- **`src/middlewares/restrictTo.middleware.ts`** — was throwing `new AppError("auth.errors.not_authenticated", ...)` and `"auth.errors.insufficient_permissions"` — dot-path strings that don't match the `namespace:key.path` convention used everywhere else, so they could never resolve to a translation. Fixed to `"auth/errors:notAuthenticated"` and `"auth/errors:insufficientPermissions"` (both added to the locale files, §4).
- **`src/utils/applyFtpUrl.util.ts`** — was throwing a raw English sentence as the messageKey (`"No FTP base URL found in environment configuration."`). Fixed to `"common/errors:server.ftpConfigMissing"`.
- **`src/app.ts`** — the catch-all 404 handler was building a raw dynamic string (`` `Route ${req.method} ${req.originalUrl} not found` ``) as the messageKey instead of using a real key. Fixed to use the existing `"common/errors:notFound"` key, with the method/path moved into the error's `meta` (still visible in logs and dev-mode responses, just no longer masquerading as a translation key).
- **`src/middlewares/validate.middleware.ts`** — `ParamsId`'s uuid validator used a raw string (`"Invalid ID format"`) instead of a key, unlike every other schema in the codebase (e.g. `auth.types.ts`, which consistently passes `"auth/errors:..."` keys as Zod error messages — that's the established convention here: the Zod validation message itself *is* the i18n key). Fixed to `"common/errors:validation.invalidFormat"`, which already exists and already interpolates `{{field}}`.
- **`src/base/BaseRepository.ts`** — two `AppError` calls used the raw literal `405` instead of `StatusCodes.METHOD_NOT_ALLOWED`, and `assertNotSystem`'s `403` was likewise a raw literal. Changed to the named constants for consistency with the rest of the file. No behavior change (405/403 are correct already), pure style/consistency fix.
- **`src/modules/permission/permission.service.ts`** — `create`/`update`/`delete` were throwing a plain `new Error("Permission is read-only")`, which bypasses the app's error convention entirely (no status code, no messageKey, would surface as a generic 500 instead of a clean 4xx). Fixed to throw `AppError("permission/errors:readOnly", StatusCodes.METHOD_NOT_ALLOWED)`, consistent with how `BaseRepository` signals "this operation isn't supported for this resource" elsewhere (405, see above). Also removed the stale `// TODO: add custom read methods` comment — nothing is pending there.

Left as-is, on purpose: `auth.service.ts` throwing `roleNotFound` as `500` (in `completeRegistration`/`createAdminUser`) rather than `404`. Unlike `role.service.ts`'s `404` (a genuine client-facing lookup-by-arbitrary-ID), these two checks fire only when a hardcoded, already-validated role name (from a fixed enum) is missing from the database — that's a real server misconfiguration, and `500` is the correct signal for it. Confirmed as correct, not changed.

## 6. Logic / correctness fixes

### 6.1 Password hash leakage via `GET /api/v1/users` and `GET /api/v1/users/:id`
Found while fixing the `user.schema.ts` issue below (§6.3), and confirmed live before fixing: `BaseController` sends whatever the repository returns straight back as JSON (`appResponder(status, record, res)`), and `BaseRepository`'s generic finders don't project fields — so every `password` hash on every user record was being sent to any caller with `users.read`/`users.readAll`/`users.manage`. This wasn't in the original audit's finding list but is a straightforward extension of it ("be careful not to introduce/leave security vulnerabilities").

Fixed entirely inside `src/modules/user/user.repository.ts` — no changes to `BaseRepository`/`BaseService`, so no other module is affected. Every read/write method (`findById`, `findOne`, `findAll`, `findMany`, `findManyCursor`, `findDeleted`, `findDeletedById`, `create`, `update`, `restore`) is now overridden to strip `password` from the record(s) before returning. `findByIdOrThrow`/`findDeletedByIdOrThrow` inherit the fix for free since `BaseRepository` calls `this.findById`/`this.findDeletedById` polymorphically.

Verified live: `GET /api/v1/users?limit=3` response no longer contains a `password` key on any record (confirmed by direct inspection of the JSON, see "Server verification" below).

### 6.2 User model's `isSystem` flag was never actually protected
`user.repository.ts` had `hasSystemField = false`, even though the `User` Prisma model has an `isSystem` column and the seeded Super Admin user is created with `isSystem: true`. Unlike `Role` (which has its own explicit `isSystem` checks in `role.service.ts`'s `beforeUpdate`/`beforeDelete` hooks), `user.service.ts` has no custom protection at all — so nothing was stopping the seeded Super Admin account from being edited or deleted through the generic `PATCH`/`DELETE /users/:id` routes. Fixed by setting `hasSystemField = true`, which activates `BaseRepository`'s existing `assertNotSystem()` guard (`common/errors:db.systemRecordImmutable`, 403) for this model. This wasn't in the original audit findings either — found while reviewing the same file for the other user.repository.ts fixes.

### 6.3 `user.schema.ts` — stale `clerkId` field would break every user-creation request
`CreateUserSchema` still required a `clerkId` field, left over from before the `20260627150146_removed_clerk_id` migration — the `User` Prisma model has no such column anymore. Any `POST /api/v1/users` call would either fail validation (if `clerkId` wasn't sent) or fail at the Prisma layer with an "unknown argument" error (if it was sent, since the DB has no such column). This is the underlying cause behind the OpenAPI audit's "request body doesn't match the Zod schema" finding for the `user` module — the schema didn't match the *database*, not just the docs.

Fixed by rewriting `CreateUserSchema`/`UpdateUserSchema`/`UserResponseSchema` to match the actual `User` model: removed `clerkId`; made every field's optionality match its actual DB nullability; used real `zod` enums for `gender`/`preferredLanguage`/`status` instead of loose strings. Also **removed `password` entirely** from `CreateUserSchema`/`UpdateUserSchema` — the old schema allowed a raw `password` string to be submitted through this generic admin CRUD endpoint, and neither `UserService` nor `UserRepository` hash it before writing to the DB (unlike every real password-setting path in `auth.service.ts`, which all use `argon2.hash`). Allowing this would have silently stored plaintext passwords. Password creation/changes are only ever done through the auth module now (`register/complete`, `admin/create`, `change-password`, `reset-password`), which is where the hashing already correctly happens. Also excluded `isSystem` and `lastLoggedInAt` from the client-settable schema — both are system-managed fields that should never be client-writable.

Verified live: `POST /api/v1/users` with just `email`/`firstName`/`lastName` now succeeds and returns a real record (previously would have needed a fabricated `clerkId`).

### 6.4 Audit-logging gap: Google account linking wasn't logged
`auth.service.ts`'s `googleAuth` links a Google identity to an existing account (`prisma.user.update({ data: { googleAuthId } })`) with no audit trail, unlike the otherwise-identical `login` flow, which does log. Fixed by threading `ip`/`userAgent` from the controller into `AuthService.googleAuth` (it previously received neither) and recording an `AuditService` entry (`user.google_account_linked`) right after the link happens.

### 6.5 Reliability bug found during verification: unguarded email sends could turn successful writes into 500s
Found while load-testing manually (see "Server verification"): `createAdminUser`'s welcome email was sent with a blocking `await sendEmail(...)`, unlike every other transactional email in this file (`login`'s new-device email, `changePassword`'s and `resetPassword`'s confirmation emails), which are all fire-and-forget (`sendEmail(...).catch(() => {})`). Under the dev/staging Mailtrap sandbox's low rate limit, this `await` throws — and since it happens *after* the admin account is already committed to the database, the client would see a `500` for an operation that actually succeeded. Fixed by making the welcome email fire-and-forget too, consistent with the rest of the file.

`forgotPassword`'s email send was **left as `await`, on purpose** — unlike the other emails, this one *is* the delivery mechanism for the reset OTP itself (not a side-effect notification), so a genuine delivery failure should surface as an error to the caller, the same way the phone/SMS OTP path already does (`otp/errors:deliveryFailed`). This is reflected in the k6 script (§7): the email-OTP and forgot-password scenarios are deliberately run at low concurrency to stay under the sandbox's rate limit, rather than masking a real design decision.

### 6.6 Repository scaffolding TODOs
`role`, `permission`, `permissionOverride`, `user`, and `userRole` repositories all had `searchableFields: []` (meaning `?search=` was silently a no-op on every module) and, for the soft-deletable ones, an empty `uniqueFields` (meaning soft-deleting a `Role` or `User` wouldn't free up its unique `name`/`email`/`username` for reuse — a real functional gap, not just a missing comment). Filled in with the actual field sets:
- `role`: `searchableFields: ["name", "description"]`, `uniqueFields: ["name"]`
- `permission`: `searchableFields: ["code", "nameLocaleCode"]`
- `permissionOverride`: `searchableFields: ["reason"]`
- `user`: `searchableFields: ["email", "firstName", "lastName", "username", "phoneNumber"]`, `uniqueFields: ["email", "username"]`
- `userRole`: `searchableFields: ["reason"]`

`testResource`'s identical TODOs were left untouched, per instruction.

---

## 7. API documentation (OpenAPI)

The original audit found ~128 documentation-accuracy findings across the 6 live modules. Given the scope and that these are documentation-only issues (no effect on server correctness or the k6 stress test), the fixes here focused on the highest-value, most-actionable subset rather than chasing full per-field parity on every route:

- **`cli/build-docs.ts`** now imports every live module's `*.openapi.ts` file (`permission`, `permissionOverride`, `role`, `user`, `userRole`, in addition to the pre-existing `auth`). Previously only `auth` was wired in, so `npm run docs:build` silently produced a spec missing 5 of 6 modules entirely — this was the single largest contributor to the 128 findings. `testResource.openapi.ts` was intentionally **not** imported, matching the decision to leave that module untouched.
- **`permission.openapi.ts`** was fully rewritten — it previously documented `POST`/`PATCH`/`DELETE` routes that don't exist (the module is read-only; those verbs throw). Now documents only the 3 real routes (`GET /`, `GET /search`, `GET /:id`) with accurate query params, response envelope, and error codes (400/401/403/404 as applicable).
- **`permissionOverride.openapi.ts`** was fully rewritten — it previously documented a fabricated generic CRUD resource at the wrong base path (`/api/v1/permissionOverrides`, camelCase) with a request body shape that didn't match reality at all. Now documents the 4 real routes (`POST /grant`, `POST /revoke`, `GET /user/:userId`, `DELETE /:id`) at the correct mounted path (`/api/v1/permission-overrides`), using the real `Grant`/`RevokePermissionOverrideSchema` request bodies and the real `{message, result}` response envelope.
- **`userRole.openapi.ts`** was uncommented and rewritten to match the now-real auth-protected routes in `userRole.route.ts` (§1.3), including the previously-undocumented `deleted`/`deleted/:id`/`:id/restore` endpoints, so the spec is accurate the moment this module is mounted.

**Deliberately not done in this pass** — full field-by-field parity between every Zod schema and every `role.openapi.ts`/`user.openapi.ts`/`auth.openapi.ts` response schema, and documenting every possible error status on every route (the original audit's remaining ~default findings, e.g. missing 401 docs on individual routes). These are pure documentation debt with no runtime impact; fixing them exhaustively would be a large, mechanical, low-risk-but-low-urgency pass better suited to its own follow-up if wanted.

**Also deliberately not done** — writing Jest unit tests to close the "0% test coverage" finding from the original audit. The k6 suite built as part of this same piece of work (§8) is the integration/functional verification mechanism that was explicitly requested here; adding full unit-test coverage on top is a separate, large effort and wasn't re-requested when this fix pass was scoped, so it's called out here rather than silently skipped.

---

## 8. Server verification

Ran `npx tsc --noEmit` after every group of changes — clean throughout, no compile errors introduced.

Started the dev server (`npm run dev`) and confirmed:
- Postgres connects, Redis connects, i18n loads, all seeds run and skip cleanly (idempotent), server listens and stays up.
- `GET /health` → 200.
- Super Admin login succeeds; token carries all 176 real permission codes (177 seeded minus the `*` wildcard itself).
- `GET /api/v1/roles` with a valid Super Admin token → 200 (previously would have needed the middleware-order fix in §1.2 to work at all for `/permissions/:id`, verified separately).
- `GET /api/v1/permissions/:id` → 200 (confirms the §1.2 middleware-order fix).
- `GET /api/v1/users?limit=3` → 200, response contains no `password` field on any record (confirms §6.1).
- `POST /api/v1/users` with no `clerkId` → 200, real record returned (confirms §6.3).
- Full email-OTP cycle: `POST /register/email/request-otp` → `GET /dev/otp?identity=...` (new dev-only endpoint, disabled outside production — see §9) → `POST /register/email/verify-otp` → `POST /register/complete` — all succeed end to end.
- `POST /api/v1/roles/assign/:userId` against a self-registered Student → 403 `role/errors:cannotModifySelfRegistrationUser`, with a real, translated message (confirms the new `role/errors` locale namespace resolves correctly).
- `POST /api/v1/permission-overrides/grant` → 201, real response with the new `permissionOverride/success` message (confirms §2.1 and the new locale namespace).
- `POST /api/v1/auth/admin/create` → 401 with no token, 201 with a Super Admin token (confirms §1.1).
- Logging in as the newly-created Admin: `GET /api/v1/roles` → 403 (Admin has no `rbac.*` — expected, §3), `GET /api/v1/users` → 200 (Admin has `users.readAll` — expected).

No unexpected errors in server logs across this entire manual verification pass — every logged error corresponded to a deliberately-triggered negative test case (missing token, wrong password, insufficient permission, etc.) with the correct status code and messageKey.

---

## 9. New: dev-only OTP debug endpoint

`GET /api/v1/auth/dev/otp?identity=<email-or-phone>` was added so the k6 suite (§ separate deliverable) can exercise the email-OTP request/verify flow end-to-end without a real inbox. This mirrors a pattern that already existed in this codebase: `src/services/otp/dilivery.ts`'s SMS channel already logs the OTP code to the console whenever `NODE_ENV !== "production"`, instead of actually sending an SMS. This endpoint does the equivalent for the HTTP layer — it reads the pending OTP straight out of Redis via a new `OtpService.peekOtp()` method.

**It cannot exist in production**: the route is only registered at all when `process.env.NODE_ENV !== "production"` (checked in `auth.route.ts` at router-setup time, not per-request), and the controller method has a second, redundant guard that 404s if somehow hit with `NODE_ENV === "production"`. In a production deployment this endpoint does not exist on the router at all.
