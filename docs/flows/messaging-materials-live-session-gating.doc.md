# Messaging, Materials & Live Session — Flow, Dependency & Gating Rules

**Read this before generating code that touches messaging, materials, or live
sessions.** It exists because AI coding tools were getting these flows wrong
from docs that only implied the rules instead of stating them. Every rule
below is cited to the exact function/line enforcing it — if the code and this
doc ever disagree, the code wins and this doc is out of date (fix the doc in
the same change that changes the code; see Epic 4 of the Admin Routes doc for
why).

Statements below use **REQUIRES** / **ONLY AFTER** / **NOT ENFORCED** as
explicit markers so a rule can't be missed by skimming.

---

## 1. Messaging

### 1.1 Who can start a conversation

**REQUIRES**: only a Parent or Student (a non-tutor) can start a new
conversation. A Tutor can never be the one to initiate.

- Enforced in `startConversation()` — [`messaging.service.ts:91-121`](../../src/modules/messaging/messaging.service.ts).
- If the initiating user has a `TutorProfile` row, the call throws
  `messaging/errors:tutorCannotInitiate` (403) before any conversation is
  created.
- A tutor replying inside a conversation the other party already started is
  fine — this rule only blocks tutor-as-initiator.

### 1.2 The pre-booking message limit

**REQUIRES**: a new conversation starts as `ConversationType.INQUIRY`. An
INQUIRY conversation allows a combined total of **10 messages** (both
participants combined, not 10 each) before further sends are blocked.

- Limit is `messagingConfig.inquiryMessageLimit`, default **10**,
  admin-configurable via `PlatformConfig` (not a hardcoded constant) —
  [`messagingConfig.ts:5-10`](../../src/services/messaging/messagingConfig.ts).
- Enforced in `sendMessage()` — [`messaging.service.ts:538-549`](../../src/modules/messaging/messaging.service.ts):
  counts non-deleted messages in the conversation, and once the count is
  `>= inquiryMessageLimit`, throws `messaging/errors:inquiryLimitReached`
  (403) with the limit in the error's `meta`. This is a hard block, not a
  warning-then-allow.
- The client can read messages remaining ahead of time via
  `GET /messaging/:id/summary` → `messagesRemaining` (only populated when
  `type === 'INQUIRY'`; `null` for `DIRECT`/other types) — computed in
  [`messaging.service.ts:662-666`](../../src/modules/messaging/messaging.service.ts).

### 1.3 ONLY AFTER a booking is paid: INQUIRY → DIRECT upgrade

**ONLY AFTER** a booking reaches `PAID` status does the conversation between
that booker and tutor stop being message-limited.

- Trigger: `PaymentService` calls
  `MessagingService.upgradeToActiveForBooking(bookingId, tutorUserId, bookerId)`
  on successful payment — [`payment.service.ts:131`](../../src/modules/payment/payment.service.ts).
- `upgradeToActiveForBooking()` — [`messaging.service.ts:162-196`](../../src/modules/messaging/messaging.service.ts) —
  flips (or creates) the pair's one-and-only conversation to
  `type: DIRECT, status: ACTIVE, bookingId`. `sendMessage()`'s limit check
  only applies to `type === INQUIRY`, so a `DIRECT` conversation has no
  message cap.
- A booking reaching `CONFIRMED`/cancelled/disputed-resolved later archives
  the conversation (`archiveForBooking()`,
  [`messaging.service.ts:199-209`](../../src/modules/messaging/messaging.service.ts)) —
  archived conversations are read-only.

### 1.4 NOT ENFORCED: attachments and voice notes are not booking-gated

**NOT ENFORCED.** Despite what you might expect from the pattern above,
**attachments and voice notes work in pre-booking (INQUIRY) conversations
today** — there is no check anywhere (`sendMessage()` in
[`messaging.service.ts`](../../src/modules/messaging/messaging.service.ts),
or the frontend attachment picker in
[`ChatScreen.tsx`](../../../mentora-ui/src/screens/ChatScreen.tsx)) that
restricts `attachmentFileId` by `conversation.type`. The only thing gating
message volume pre-booking is the 10-message combined cap in §1.2, which
counts attachment-only and voice-note messages the same as text messages.

If a future change is meant to gate attachments to post-booking, that logic
does not exist yet and needs to be added — do not assume it's already there.

### 1.5 Blocking

**REQUIRES**: neither party has blocked the other.

- `sendMessage()` checks both directions and throws distinct errors:
  `messaging/errors:youBlockedRecipient` if the sender blocked the
  recipient, `messaging/errors:blockedByRecipient` if the recipient blocked
  the sender — [`messaging.service.ts:461-473`](../../src/modules/messaging/messaging.service.ts).
- The frontend deliberately only collapses the input for "you blocked them"
  (`iBlockedThem`) — being blocked *by* the other party is never confirmed to
  the blocked user (privacy-by-design, same as WhatsApp); their input stays
  active and just fails silently on send.

---

## 2. Materials

### 2.1 Free preview vs. full access

**REQUIRES**: full access to a tutor's Collection requires either owning it
(being that tutor) or having ever had a real (paid-or-further) booking with
that tutor. Everyone else — including guests — gets preview-only access.

- Resolved live per-request by `resolveViewerAccess()` —
  [`materials.service.ts:1273-1302`](../../src/modules/materials/materials.service.ts) —
  **not** a stored grant. Access can never drift out of sync with actual
  booking history because it's recomputed from `Booking` every time.
- "A real booking" = any booking between that user and that tutor whose
  status is in `VALID_ACCESS_BOOKING_STATUSES`:
  `PAID, IN_PROGRESS, AWAITING_CONFIRMATION, CONFIRMED, AUTO_CONFIRMED,
  DISPUTED, RESOLVED_TUTOR_FAVOR, RESOLVED_PARENT_FAVOR` —
  [`materials.service.ts:1251-1260`](../../src/modules/materials/materials.service.ts).
  A booking that was only ever `REQUESTED`/`REJECTED`/`CANCELLED_UNPAID`
  never grants access.
- `PREVIEW_ONLY` viewers only see items where `isFreePreview` is true,
  cascading collection → section → material (a collection-level
  `isFreePreview: true` overrides everything under it; otherwise a
  section's flag overrides its own materials; otherwise the material's own
  flag applies) — `isMaterialVisible()`,
  [`materials.service.ts:1307-1315`](../../src/modules/materials/materials.service.ts).

### 2.2 ONLY AFTER KYC approval: a tutor can manage their own materials

**ONLY AFTER** a tutor's KYC application is `ACTIVE`/approved (and their
profile is complete) can they create/edit/delete collections, sections, or
materials.

- Every route under `/materials/me/*` runs
  `protect, checkAccountCompletion, checkKyc` in that order —
  [`materials.route.ts:66`](../../src/modules/materials/materials.route.ts).
  This is a platform-wide pattern (see §4), not materials-specific, but it's
  easy to miss that it applies to every write endpoint in this module.

---

## 3. Live sessions (online, LiveKit)

### 3.1 Who can generate a session token / join

**REQUIRES**: `booking.sessionType === ONLINE`. IRL (`HOME`) bookings never
have a `LiveRoom` at all — see §3.4.

- For 1:1 (non-group) bookings: `booking.status` must be one of
  `PAID, IN_PROGRESS, AWAITING_CONFIRMATION`
  (`ONE_ON_ONE_JOINABLE_STATUSES`) — anything else (not yet paid, already
  confirmed/closed, disputed-and-resolved) is denied.
- For group bookings: `liveSessionConfig.groupSessionsEnabled` must be true
  (off by default — the whole group-session code path 404s otherwise), and a
  non-tutor participant needs a `GroupSessionParticipant` row with
  `paymentStatus: PAID` for that booking.
- All of the above: `resolveSessionAccess()`,
  [`liveSession.service.ts:77-113`](../../src/modules/liveSession/liveSession.service.ts).
  Every denial path throws the same generic 403
  (`liveSession/errors:accessDenied`) regardless of *why* — a non-participant
  can't distinguish "not your booking" from "booking not paid yet" from the
  error alone.

### 3.2 ONLY AFTER a room is locked can it reject a first-time joiner

**REQUIRES**: if the tutor has locked the room (`lockRoom()`), a user who has
never joined before is denied (`roomNotReady`, 409) — but a user who's
already an established `SessionParticipant` of that room can still rejoin a
locked room. Lock only keeps new people out, not people already in the
session.

### 3.3 Occupancy-only close, config-driven grace period

**ONLY AFTER** the room has 0 current occupants does it actually close — a
manual "End Session" from the tutor no longer force-disconnects the other
party (graceful leave, not a hard delete). The room's own LiveKit
`emptyTimeout` (sourced from `liveSessionConfig.emptyTimeoutMinutes`, default
30, admin-configurable) is what fires `room_finished` once truly empty for
that long. See the Live Sessions Overhaul work (Epic 1) for the full
rationale.

### 3.4 IRL (HOME) sessions have no LiveKit involvement at all

**NOT APPLICABLE**: for `sessionType: HOME` bookings, none of §3.1-3.3
applies — there is no `LiveRoom`, no token, no LiveKit room. The lifecycle is
pure booking-state + timestamps (`tutorCheckedInAt`/`bookerCheckedInAt`/
`tutorCheckedOutAt`/`bookerCheckedOutAt`) via `CheckinService` —
[`checkin.service.ts`](../../src/modules/booking/checkin.service.ts). Check-in
opens 15 minutes before scheduled start; both parties checking in flips the
booking to `IN_PROGRESS`; the tutor checking out is the authoritative
"session ended" signal and opens the lesson-confirmation window.

---

## 4. General pattern: platform-wide account-readiness gates

Two middleware checks recur across almost every write-capable module
(materials, live sessions, bookings) and are easy to forget when adding a new
route:

- **`checkAccountCompletion`** — REQUIRES the user's profile to be marked
  complete (see `AuthContext`'s `completion` state on the frontend, and the
  `CompletionBanner` that's shown until it's true).
- **`checkKyc`** — REQUIRES an `ACTIVE`/approved KYC application (tutors
  only meaningfully gates on this; it's a no-op check for non-tutors in most
  routes it's applied to — verify per-route, don't assume).

Both are applied at the router level (`router.use(protect,
checkAccountCompletion, checkKyc)`), not per-handler — so a new route added
to an existing router picks these up automatically, but a **new router**
needs them added explicitly or the gate silently doesn't apply.

---

## Contributing to this doc

Per the Admin Routes & API Docs Overhaul (Epic 4): **any new endpoint or
gating rule change ships with this doc updated in the same change, not
after.** If you add a new "X only works after Y" rule anywhere in messaging,
materials, or live sessions, add it here with the same
REQUIRES/ONLY AFTER/NOT ENFORCED format and a file:line citation — prose that
merely implies the rule doesn't count.
