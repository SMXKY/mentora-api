# Module 9 — Tutor Onboarding & KYC

Implements the full KYC checklist: the 4-step tutor wizard, identity and
subject-level verification with a trained confidence-scoring engine, the
admin review interface with mandatory checklist gating, ban/suspend, SLA
escalation, and anti-lazy-admin spot-check governance.

## What already existed vs. what this session built

The database schema for this module was **already almost entirely
scaffolded** before this work started — `KycApplication`,
`KycStatusHistory`, `KycRejectionFlag`, `KycChecklistSubmission`, `KycBan`,
`TutorCredential`, `CredentialSubjectLink`, `TutorSubject`, and
`SubjectRelationshipWeight` all existed with fields matching the spec
closely, including `TutorSubject.confidenceScore` /
`confidenceExplanation` and `KycStatusHistory.reviewDurationSeconds` /
`flaggedForSpotCheck`. The `kyc.*` permissions and all seven `KYC_*`
notification types were also already registered. This session's job was
almost entirely **wiring a working service layer on top of an
already-designed data model**, not inventing the model.

What genuinely didn't exist and had to be added (one migration,
`20260704174855_kyc_governance_and_document_links`):

- `KycApplication.nonConvictionCertificateId` and `.cvFileId` — the spec
  added a certificate-of-non-conviction upload and CV upload that the
  original schema didn't have slots for.
- `KycSpotCheckReview` model + `SpotCheckVerdict` enum — nothing tracked a
  Super Admin's secondary-review verdict on a flagged approval.
- `User.kycCountersignatureRequired` — nothing tracked "this admin's
  approvals now require Super Admin countersignature."

## Two independent lifecycles, one status field

The spec describes identity verification and subject verification as
separable admin actions with separate consequences. The schema already
enforces this split naturally:

- **Identity lifecycle** — `KycApplication` + `KycStatusHistory` +
  `KycRejectionFlag` + `KycChecklistSubmission`. Tracks
  PENDING → IDENTITY_APPROVED / REJECTED → ... → BANNED, versioned per
  resubmission (`KycApplication.version`).
- **Subject/credential lifecycle** — `TutorCredential` and `TutorSubject`,
  each with their own independent status (`PENDING` / `APPROVED` /
  `REJECTED`), living directly on the `TutorProfile` — **not versioned by
  KYC application**. A credential submitted during the original
  application and one submitted six months later through the
  "additional subject" flow are stored identically; only which *admin
  queue* they land in differs.

`TutorProfile.kycStatus` is the single source of truth for the tutor's
overall standing (what login, public-profile-visibility, and booking
eligibility all check against). It only ever moves to `ACTIVE`
automatically, the moment the *first* `TutorSubject` reaches `APPROVED`
while identity is already `IDENTITY_APPROVED` — see
`KycAdminService.approveSubject`.

## Status transitions are a real state machine, not a free-form field

`src/services/kyc/kycStateMachine.ts` is the **only** place a transition
is allowed or refused — every write to `TutorProfile.kycStatus` in the
codebase (tutor submission, admin approve/reject, ban, suspend, unsuspend)
calls `assertValidTransition(from, to)` first. `BANNED` is terminal —
nothing transitions out of it. This directly satisfies "no endpoint can
set an arbitrary status, only valid transitions are permitted." Every
transition and its inverse is exhaustively unit-tested in
`kycStateMachine.test.ts` (36 cases).

## The confidence-scoring engine

`src/services/kyc/kycScoring.ts` exports one pure function,
`scoreSubjectClaim()`, with zero database access — deliberately, so every
scoring rule is unit-testable without touching Postgres (satisfying "a
rule change that breaks existing test cases blocks deployment").

Algorithm: for a tutor's claimed subject, look at every credential they
attached to it. For each, check whether an admin has ever trained a
`SubjectRelationshipWeight` for that exact `(qualificationType,
fieldOfStudy)` pair against this subject (case-insensitive, whitespace-
trimmed match on `fieldOfStudy`). Take the **strongest** matching
credential — one excellent match is enough evidence even if the tutor
also attached a weaker one. No match at all (a genuinely new
qualification/subject combination) always scores 0 and routes to full
manual review — the engine never guesses on unseen data.

Thresholds (exported constants, not magic numbers): score ≥ 80 →
`RECOMMEND_APPROVE`; ≥ 40 → `RECOMMEND_REVIEW`; below that →
`NEW_DOCUMENTATION_REQUIRED`. `GET /admin/kyc/subjects/queue` returns all
three sections pre-split.

**Training the engine**: when an admin approves a subject and passes
`trainWeight` (0-100), `KycAdminService.approveSubject` upserts a
`SubjectRelationshipWeight` row for that credential's exact
`(qualificationType, fieldOfStudy, subjectId)` — the very next tutor with
that same combination gets scored against it. This is intentionally a
simple, auditable lookup table, not a machine-learning model — every
training decision is a single admin action with a plain-English
before/after that's fully traceable in the audit log.

## Credential revocation cascade

`KycAdminService.reviewCredential`: if a credential that was `APPROVED`
is reviewed again and set to `REJECTED`, that's treated as a **revocation**.
For each subject the revoked credential covered, the service checks
whether any *other* `APPROVED` credential belonging to the same tutor also
covers that subject via `CredentialSubjectLink`. If not — the subject was
backed *solely* by the revoked credential — it's demoted back to
`PENDING` and disappears from anywhere a caller filters on
`status: APPROVED`. Subjects with independent alternate coverage are
untouched. No extra schema was needed for this; it's a live query against
the existing many-to-many join.

## Ban and suspend reuse the account-suspension infrastructure

Both `KycAdminService.banTutor` and `.suspendTutor` call
`AdminUserService.suspendUser()` (built in the earlier account-lifecycle
work) on the underlying `User`, on top of moving `TutorProfile.kycStatus`.
This is a deliberate reuse decision: the spec's "suspended tutor cannot
log in" requirement is functionally identical to generic account
suspension (session invalidation via the JTI Redis blocklist, login
rejection with a support-contact message) — reusing that code means KYC
suspension gets pre-existing, already-tested session-kill behavior for
free instead of a second parallel implementation.

Both actions also call a shared `handleTutorRemovalFromPlatform()`
helper: pending/requested bookings are auto-cancelled with a notification
to the affected parent; bookings already `PAID`/`IN_PROGRESS`/
`AWAITING_CONFIRMATION`/`CONFIRMED` are left completely alone but trigger
an `ADMIN_REVIEW_REQUIRED` notification to everyone holding
`bookings.manage` — **no funds move automatically**, exactly as specified.

## Anti-lazy-admin governance

- **Review duration**: the first time an admin opens
  `GET /admin/kyc/applications/:id`, a Redis key
  (`kyc:review:opened:<applicationId>:<adminId>`) records the timestamp —
  deliberately ephemeral (1-hour TTL) rather than a DB write, since most
  opened-but-abandoned reviews never turn into a decision. When the admin
  finally approves or rejects, the elapsed time becomes
  `KycStatusHistory.reviewDurationSeconds`, and any decision under 90
  seconds is automatically flagged (`flaggedForSpotCheck = true`).
- **Spot-check queue**: `GET /admin/kyc/spot-check-queue` returns flagged,
  not-yet-reviewed approvals for Super Admin secondary review.
- **Bad-approval tracking**: `POST /admin/kyc/spot-check/:id/verdict`
  records a `GOOD`/`BAD` verdict. On `BAD`, the system recounts that
  admin's `BAD` verdicts in the trailing 30 days; past 3, it sets
  `User.kycCountersignatureRequired = true` and sends them an
  `ACCOUNT_FLAGGED` notification. **Not yet wired**: no endpoint currently
  *checks* `kycCountersignatureRequired` to actually reroute that admin's
  future approvals to a Super Admin queue — the flag is set and visible,
  but enforcing it would mean threading a countersignature step through
  `approveIdentity`, which needs a product decision on what "routed for
  countersignature" looks like in the review flow (a second required
  approval? a blocking hold?) that the spec doesn't fully pin down. Flagged
  here rather than guessed at.
- **Per-admin stats**: `GET /admin/kyc/stats/:adminId` — total reviewed,
  rejection rate, average review duration, flagged-approval count over a
  trailing window (default 30 days), computed live from
  `KycStatusHistory` — no separate stats table.

## SLA and escalation

Configurable via `PlatformConfig` (`kyc.sla_target_hours`,
`kyc.sla_max_business_days` — defaults 48h / 5 business days,
`GET`/`PATCH /admin/kyc/sla-config`). `src/services/kyc/
kycSlaEscalation.processor.ts` is a BullMQ job running hourly: past the
target-hours mark, the tutor gets one `KYC_SLA_BREACH` notification
(deduped via a Redis flag so it never repeats); past the
max-business-days mark (a real business-day calculation, skipping
weekends), everyone with `kyc.manage` gets one `ADMIN_REVIEW_REQUIRED`
notification with `reviewReason: "kyc_escalated"`. `GET /admin/kyc/queue`
marks escalated applications with `isEscalated: true` so they sort
distinctly in the UI.

## Media integration

Every KYC file — CNI front/back, selfie, non-conviction certificate,
credential documents, CV — goes through `MediaService.upload()` with
`fileCategory: KYC_DOCUMENT`, exactly like every other upload in the
system. No direct storage access exists anywhere in this module. The
same virus scan, MIME sniffing, and quota enforcement apply.

## What's intentionally not built here

- **Frontend-only requirements** (visible timer, side-by-side document
  display, dropdown of rejection reasons, "visual example of each
  document type") are UI concerns with no backend surface — not
  addressed here, and shouldn't be.
- **The 60-second approve-button-disabled timer is not enforced
  server-side.** The spec's "Developer Enforcement" section explicitly
  names checklist completion as the thing that must be server-enforced;
  the 60-second delay is framed as a UI affordance. The *outcome* it's
  meant to prevent (a rushed approval) is still caught server-side via
  the review-duration spot-check flag.
- **Countersignature rerouting** is flagged above as a real gap, not
  silently skipped.

## Endpoint reference

**Tutor** (`/api/v1/kyc`, all behind `protect`):
`GET /me`, `POST /me/step-1`, `POST /me/step-2`, `POST /me/credentials`,
`DELETE /me/credentials/:id`, `POST /me/cv`, `POST /me/submit`,
`POST /me/resubmit`, `POST /me/additional-subject`.

**Admin** (`/api/v1/admin/kyc`, `protect` + the named `kyc.*` /
`platform.config*` permission):
`GET /queue`, `GET /applications/:id`,
`POST /applications/:id/approve-identity`,
`POST /applications/:id/reject`, `POST /tutors/:id/ban`,
`POST /tutors/:id/suspend`, `POST /tutors/:id/unsuspend`,
`GET /subjects/queue`, `POST /subjects/:id/approve`,
`POST /subjects/:id/reject`, `POST /credentials/:id/review`,
`GET /spot-check-queue`, `POST /spot-check/:id/verdict`,
`GET /stats/:adminId`, `GET`/`PATCH /sla-config`.

## Testing

- `src/services/kyc/kycScoring.test.ts` — every scoring rule (threshold
  boundaries, multi-credential best-match selection, case-insensitive
  matching, no-data fallback, out-of-range clamping) — 14 cases.
- `src/services/kyc/kycStateMachine.test.ts` — exhaustive valid/invalid
  transition matrix, terminal-state check, error-context assertion —
  36 cases.
- `k6/kyc-flow.test.js` — end-to-end: a tutor completes all four steps
  and submits, an admin approves identity and a subject, a second tutor
  gets rejected and resubmits, and an active tutor gets suspended and
  unsuspended. Run with `npm run test:k6:kyc` (dev server + admin
  credentials with `kyc.*` permissions required — same convention as the
  other k6 scripts in this repo).
