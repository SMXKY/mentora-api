# DashboardService

Implements Module 6.5 — Dashboards & Home Screens (REQ-006.5-001 through 007).

## Why this exists

Every role's home screen needs a handful of numbers and short lists pulled from half a dozen different tables — bookings, disputes, wallet, KYC status, reviews, audit log. Without this module, the mobile app would either hit six endpoints on every screen load (slow, and none of those endpoints exist as list APIs yet anyway) or hardcode the numbers (which is exactly what `HomeScreen.tsx` and `TutorHomeScreen.tsx` did before this module existed). `DashboardService.getForUser()` is the one place that assembles a role's full home-screen payload in a single call.

## The core idea: query the real tables now, even where they're empty

> **Update (Admin Routes & API Docs Overhaul, Epic 4 sweep):** at the time
> this doc was originally written, Booking, Dispute, Review, and Materials
> had no CRUD modules yet — only their Prisma models existed. That's no
> longer true: `src/modules/booking`, `src/modules/dispute`,
> `src/modules/review`, and `src/modules/materials` are all fully built and
> in active use. The queries described below were written against the real
> schema from day one specifically so they'd "just work" once those modules
> shipped, and they do — but this doc's dashboard-specific claims below
> haven't been individually re-verified line-by-line against every query in
> `dashboard.service.ts` as part of this sweep; if you're relying on a
> specific figure this doc describes, check the actual query in
> `dashboard.service.ts` first.

Booking, Dispute, Review, and Materials all have full CRUD modules now (see
above). Every query in this service reads the real table directly
(`prisma.booking.findMany(...)`, `prisma.dispute.count(...)`, etc.), which
means the numbers described in this doc should now be populated by real
data rather than the correctly-empty state described when this doc was
first written. The same philosophy was applied to the notification module
fix earlier: build the read side against the real schema from day one, so
functionality "just works" the moment the write side exists — that's exactly
what happened here.

Fields that have no real backing anywhere in this codebase (Flagsmith feature-flag state, BullMQ job heartbeats — `JobHeartbeatRegistry` is schema-only, never written to) are **not** faked. They're either omitted or, for `systemHealth`, scoped down to what's honestly checkable (DB/Redis reachability) rather than a fabricated uptime/error-rate number.

## How it's built

**`dashboard.service.ts`** is the entire module — one exported function, `getForUser(userId, { fresh })`. It resolves the caller's primary role the same way `evaluateCompletion()` does (`userRole.role.name`, first active role), then branches to one of four builder functions:

- `buildParentDashboard` — upcoming bookings, pending requests, open disputes, last 5 escrow payments, and each managed student profile with their active-booking count (reuses the same `guardianId` scoping as `ParentService.listMyStudents`).
- `buildStudentDashboard` — same booking/dispute shape scoped to the student's own `bookerId`, plus their own level/subjects (via their `StudentProfile.userId`) and reviews *they authored* joined back onto their past sessions.
- `buildTutorDashboard` — pending/upcoming bookings by `tutorProfileId`, wallet figures, next queued payout, KYC status + rejection reason straight off `TutorProfile`, profile completion via `evaluateCompletion()` (not reimplemented), and the last 3 reviews where they're the `subject`. If the tutor hasn't created a `TutorProfile` row yet, returns an all-empty/zero shape rather than 404ing — the dashboard's job is to render something, not gate on a form that isn't its concern.
- `buildAdminDashboard(role)` — KYC queue stats reuse `KycAdminService.getQueueStats()` directly rather than re-deriving the group-by; disputes/revenue/escrow/payouts are real (empty) queries; "flagged accounts" is a count on the real `User.escrowReviewRequired`/`kycCountersignatureRequired` booleans; new-registrations-today is a real, populated-today query; recent audit log reads the same table the `auditLog` module's list endpoint reads. `SUPER_ADMIN` gets one extra field, `activeSessions` (real, `UserSession` count) — everything else in the spec's "Super Admin sees Admin plus..." list (feature flags, RBAC overview, storage usage, job health) has no REQ-numbered acceptance criterion and no real backing yet, so it's deliberately not included. Add it here once a Flagsmith client and job-heartbeat writers actually exist.

**Caching**: exact same pattern as `getUserPermissions.util.ts` — `redis.get`/`redis.set(key, val, { EX: seconds })`, key `dashboard:{userId}`, 30s TTL, `?fresh=true` on the route bypasses it. No invalidation hooks — with this little write-path traffic today, a 30s TTL expiring naturally is simpler than wiring invalidation into modules that don't exist yet, and matches the spec's "stale is acceptable within reason."

**Real-time (REQ-006.5-006)**: deliberately **no new sockets or rooms**. `NotificationType`s for `BOOKING_REQUESTED`, `NEW_MESSAGE_RECEIVED`, dispute, and payout events are already registered in `notification.types.ts` — the notification module (Socket.IO `notification:new`) *is* the real-time channel for these. The client bumps its own dashboard counters on receipt of the relevant type and silently re-fetches with `?fresh=true`. This will deliver zero live updates until booking/dispute/messaging modules exist to call `NotificationService.send()` — same forward-compatible shape as everything else in this module.

## How to use it

```ts
import { DashboardService } from "../dashboard";

const dashboard = await DashboardService.getForUser(userId);
// dashboard.role tells you which shape you got: 'PARENT' | 'STUDENT' | 'TUTOR' | 'ADMIN' | 'SUPER_ADMIN'
```

Force a fresh (non-cached) read — this is what `GET /api/v1/dashboards/me?fresh=true` does:

```ts
const dashboard = await DashboardService.getForUser(userId, { fresh: true });
```

## Known gaps (tracked here on purpose, not hidden)

| Field | Status |
|---|---|
| Bookings, disputes, reviews, materials | Real queries against real tables. **(Epic 4 sweep, updated)** `src/modules/booking`, `dispute`, `review`, and `materials` now all exist and are in active use — these should be populated, not empty, unless a specific user genuinely has no data of that kind. |
| Revenue / escrow / payouts (Admin) | Real queries. **(Epic 4 sweep, updated)** `src/modules/payment` now exists and is in active use — no longer correctly-zero-by-default. |
| Feature flags (Super Admin) | Not implemented — no Flagsmith client exists anywhere in `src`, only env vars checked at boot |
| Job health / error rate (Admin) | Not implemented — `JobHeartbeatRegistry`/`DeadLetterJob` are schema-only, nothing writes to them |
| Storage usage / RBAC overview (Super Admin "plus" list) | Not implemented — no REQ-numbered acceptance criterion exists for these |
| Real-time booking/dispute/payout counters | Plumbing exists (notification types are registered) but will emit nothing until booking/dispute/messaging modules call `NotificationService.send()` |

## Endpoint reference

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/dashboards/me` | `protect` (any authenticated role) |
