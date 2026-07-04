# Account Lifecycle — Completion, Self-Service, Suspension, Deactivation

Implements REQ-006-014 (account completion) and the Account Suspension / Account
Self-Deactivation checklists. Four features, one underlying mechanism (session
revocation), documented together because suspension and deactivation both
depend on it.

## Session & JTI revocation — the mechanism everything else needed

Before this work, JWTs had no `jti` claim, nothing tracked which sessions
were live, and the `UserSession` table existed in the schema but was never
written to by any code path — a token, once issued, could only stop working
by expiring naturally. That's incompatible with "suspending an account
immediately invalidates all active sessions," so this had to be built first.

**How it works now:** every token-issuing flow (login, Google sign-in,
`register/complete`) resolves or creates a `UserDevice` row, then calls
`issueSessionToken(userId, deviceId)` (`src/modules/auth/utils/session.util.ts`).
That creates a `UserSession` row and signs the JWT with `jwtid: session.id` —
the session's own id becomes the token's `jti` claim. `protect.middleware.ts`
checks that `jti` against a Redis key (`session:blocklist:<jti>`) on every
request, *before* touching the database.

To revoke every session for a user, call `invalidateAllSessions(userId,
terminatedById?)`: it marks every active `UserSession` row `isActive: false`
and writes a Redis blocklist key for each one, with a TTL equal to that
token's remaining lifetime — so Redis never accumulates entries for tokens
that would have expired anyway. This is what admin suspension and
self-deactivation both call.

## Account completion

`src/services/accountCompletion/accountCompletion.service.ts` exports
`evaluateCompletion(userId)`. It checks, per role:

| Role | Requirements |
|---|---|
| Parent | verified email, full name, phone, **at least one guarded student profile** |
| Student | verified email, full name, phone, class/level, **at least one subject of interest** |
| Tutor | verified email, full name, phone, **a TutorProfile row + at least one subject + both min/max rate + a photo** |

Tutor's "bio, location, mode" are collapsed into a single `tutor_profile`
item rather than three separate checks — those three fields are `NOT NULL`
on `TutorProfile` itself, so a row existing at all already guarantees them.
Only genuinely-optional pieces (subjects, pricing, photo) get their own item.

Every response — `GET /api/v1/auth/me/completion` — returns the exact
missing items, not just a boolean:

```json
{
  "completionStatus": "incomplete",
  "isComplete": false,
  "role": "Tutor",
  "percent": 40,
  "items": [
    { "key": "email_verified", "labelCode": "account_completion/items:email_verified", "complete": true },
    { "key": "tutor_profile", "labelCode": "account_completion/items:tutor_profile", "complete": true },
    { "key": "subjects", "labelCode": "account_completion/items:subjects", "complete": false },
    { "key": "pricing", "labelCode": "account_completion/items:pricing", "complete": false },
    { "key": "photo", "labelCode": "account_completion/items:photo", "complete": false }
  ],
  "missing": ["subjects", "pricing", "photo"]
}
```

Each evaluation also writes the result to the existing `User.isAccountComplete`
boolean — REQ-006-014 asks for `completion_status` as an enum of
`incomplete`/`complete`; rather than adding a second, potentially-diverging
column, the enum is derived from that one boolean at the API layer
(`completionStatus` in the response). One source of truth, two representations.

**`requireCompleteAccount` middleware**
(`src/middlewares/requireCompleteAccount.middleware.ts`) gates a route behind
completion. It reads `res.locals.user.isAccountComplete` — a field `protect`
already fetches — so it costs **zero extra queries**. It is not applied
anywhere yet: booking, messaging, KYC-submission, and payment-initiation
routes (the ones REQ-006-014 names) don't exist in this codebase yet. Wire
it onto those routes as they're built:

```ts
router.post("/", protect, requireCompleteAccount, bookingController.create);
```

On rejection it returns `403` with a translatable message **and a `redirect:
"onboarding"` field in the JSON body** (in every environment, not just dev —
`error.controller.ts` now forwards `err.meta.redirect` onto the response
whenever an `AppError` carries one).

**Known gap, called out on purpose:** the "adding a student profile updates
completion_status within 5 seconds" acceptance criterion assumes a
student-profile creation endpoint that doesn't exist in this codebase yet.
Completion is refreshed on login and on every call to `GET /me/completion`;
whichever module eventually creates/updates `StudentProfile` or
`TutorProfile` should call `evaluateCompletion(userId)` after its write so
the client's next poll reflects it immediately, rather than waiting for the
user's next login.

**Schema addition:** `StudentProfile.guardianId` (nullable FK to `User`) —
needed because nothing in the existing schema linked a Parent account to the
student profiles it manages. A self-registered Student has no guardian
(`guardianId: null`); a Parent-managed one does.

## User self-service

- `GET /api/v1/auth/me` — already existed, unchanged.
- `PATCH /api/v1/users/me` — updates a deliberately narrow subset of fields
  (name, phone, dob, gender, address, language, notification mute).
  Anything admin-only (email, status, isAccountComplete, username, ...)
  is excluded from `UpdateMeSchema` so it can't be smuggled through.
- `PATCH /api/v1/users/me/profile-picture` — multipart upload, one file,
  field name `profilePicture`. Routes through `MediaService.upload()` with
  `fileCategory: PROFILE_PHOTO`, so it gets the exact same virus scan, MIME
  sniffing, and quota enforcement as every other upload in the system —
  a profile picture is not a special case. Any prior `PROFILE_PHOTO` file
  rows for the user are soft-deleted after the new one lands.

Both `/me` routes are registered **before** the generic `/:id` routes in
`user.route.ts` — otherwise Express would treat `"me"` as an `:id` value.

**Note on URL resolution:** the response's `url` field is resolved via the
active storage adapter (`getStorageAdapter().resolveUrl()`), which correctly
handles both the dev filesystem adapter and production FTP. The *existing*
`applyFtpUrlTransform` helper (used elsewhere, e.g. the login response) only
knows about `FTP_BASE_URL` and silently mishandles dev-adapter paths — a
pre-existing gap, out of scope here, worth a follow-up.

## Admin suspension

`POST /api/v1/admin/users/:user_id/suspend` — `restrictTo(permissions.users.suspend)`
(already seeded). Body: `{ "reason": "..." }`, mandatory — Zod schema rejects
an empty/missing reason with 400 before the handler ever runs.

On success:
1. `User.status → SUSPENDED`, a new `AccountSuspension` row is written.
2. `invalidateAllSessions()` — every active session dies on its next request.
3. The suspended user gets the existing (previously-dead) `ACCOUNT_SUSPENDED`
   notification.
4. If the account has bookings in an active status (`ACCEPTED`, `PAID`,
   `IN_PROGRESS`, `AWAITING_CONFIRMATION`, `CONFIRMED`), everyone holding
   `users.manage` gets an `ADMIN_REVIEW_REQUIRED` notification.
5. If `Wallet.pendingEscrowXaf > 0`, the account is flagged
   (`User.escrowReviewRequired = true`) and the same admin notification
   fires with a different `reviewReason` — **no funds move automatically.**
6. Audit log: `operation: SUSPEND`, actor id + reason recorded.

`POST /api/v1/admin/users/:user_id/unsuspend` — `restrictTo(permissions.users.unsuspend)`.
Returns status to `ACTIVE`, marks the open `AccountSuspension` row lifted by
the acting admin, sends `ACCOUNT_UNSUSPENDED`, writes an `UNSUSPEND` audit
entry. It does not restore old sessions — the user logs in again, same as
after a password change.

Login-time rejection for suspended accounts already existed in
`AuthService.login()` before this work (`accountSuspended` error, 403) — the
locale message already names a support contact, so no change was needed there.

## Self-deactivation, reactivation, anonymisation

- `POST /api/v1/auth/me/deactivate/request-otp` — only for accounts with no
  password (Google sign-in). Sends a 6-digit OTP to the account's email.
- `POST /api/v1/auth/me/deactivate` — body is `{ password }` **or**
  `{ otpCode }`, exactly one (Zod `.refine` enforces this). Accounts with a
  password use it directly; passwordless accounts use the OTP from the step
  above. On success: `deletedAt = now()`, `status = DEACTIVATED`, every
  session invalidated, `DEACTIVATE` audit entry written.
- `POST /api/v1/auth/me/reactivate` — **not** behind `protect`, because a
  deactivated account's own token is already dead (blocklisted, and
  `deletedAt` would reject it anyway). Re-verifies identity from scratch —
  `{ identifier, password }` or `{ identifier, otpCode }` — the same way
  login does. Rejects with `410 Gone` once the 30-day window
  (`deletedAt + 30 days`) has passed. On success, returns a fresh session +
  token, exactly like login.
- **Nightly anonymisation job**
  (`src/services/account/accountAnonymisation.processor.ts`, BullMQ
  repeatable job at 4am, one hour after the media purge job so they never
  contend for DB connections): finds every `DEACTIVATED` user whose
  `deletedAt` is more than 30 days old and `anonymisedAt` is still null,
  and scrubs `firstName`, `lastName`, `email`, `username`, `phoneNumber`,
  `whatsappNumber`, `googleAuthId`, `facebookAuthId`, `password`,
  `profilePictureUrl`, `address`. The `User` row itself is **never deleted**
  — `TransactionLedger` and every other table keep referencing the same
  (now-anonymised) `userId`, which is exactly what "transaction records
  retained with the anonymised user reference" requires, with zero extra
  bookkeeping. Each run writes one `AuditLog` row (`operation: ANONYMISE`,
  `actorId: null`, `newState: { count }`).

**Interpretation worth flagging:** the checklist says deactivation needs
"password confirmation or OTP re-verification for phone accounts." In this
codebase, phone-registered accounts set a password at `register/complete`
just like email accounts do — the *only* passwordless accounts are Google
sign-ins. So the implemented rule is: has a password → confirm with it;
no password (Google) → confirm with an emailed OTP. This is the literal,
currently-true version of what the checklist was gesturing at; there's no
password-free phone-only account type in this codebase to build the
phone-OTP path against.

## Schema changes (one migration:
`20260704140842_account_completion_suspension_deactivation`)

- `StudentProfile.guardianId` (nullable FK → `User`) + index
- `User.anonymisedAt`, `User.escrowReviewRequired`, `User.escrowReviewRequiredAt`
- `LogOperation` += `DEACTIVATE`, `REACTIVATE`, `ANONYMISE`
- `NotificationType` += `ADMIN_REVIEW_REQUIRED`

No columns were added for completion status or session JTIs — both reuse
existing columns/tables (`User.isAccountComplete`, `UserSession`) that were
either unused or under-used before this work.

## Endpoint reference

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/auth/me/completion` | `protect` |
| PATCH | `/api/v1/users/me` | `protect` |
| PATCH | `/api/v1/users/me/profile-picture` | `protect` |
| POST | `/api/v1/admin/users/:user_id/suspend` | `protect` + `users.suspend` |
| POST | `/api/v1/admin/users/:user_id/unsuspend` | `protect` + `users.unsuspend` |
| POST | `/api/v1/auth/me/deactivate/request-otp` | `protect` |
| POST | `/api/v1/auth/me/deactivate` | `protect` |
| POST | `/api/v1/auth/me/reactivate` | none (re-authenticates itself) |

## Testing

- `k6/account-lifecycle-flow.test.js` exercises all eight endpoints above end
  to end against a running dev server, including the suspend→login-rejected,
  suspend→session-invalidated-mid-use, and deactivate→reactivate round trips.
- Run: `npm run test:k6:account-lifecycle` (starts nothing for you — start
  `npm run dev` first, same as the other k6 scripts in this repo).
