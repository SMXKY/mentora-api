# MENTORA API
READMe

## Live session test harness

Two real, end-to-end tests validate the live-session (LiveKit) feature — standard
type-checks/unit tests can't prove WebRTC media actually flows, so these exist
specifically to catch that. Both go through real auth, real booking-access-control,
and the real production code paths (no hand-crafted tokens, no bypassed checks). See
[docs/services/live-session-hosting.doc.md](docs/services/live-session-hosting.doc.md)
for the full production-hardening writeup these tests were built to verify.

### Prerequisites

- `docker compose up -d` (postgres, redis, livekit) — see [docker-compose.yml](docker-compose.yml)
- `npm run dev` — the API server, with the room-lifecycle worker running (it creates
  the LiveKit room for a seeded booking automatically, same as production)
- `.env` with `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` matching
  `docker/livekit/livekit.yaml`, and `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`
  (used by the Playwright test's backend-state assertions — the app's own seed
  process creates this account)
- For the LiveKit CLI harness only: nothing extra to install — `tools/lk/lk.exe`
  (or `tools/lk/lk` on Linux/macOS) is checked into the repo

### 1. LiveKit CLI harness (`tools/live-session-harness/run.ts`)

Seeds a real PAID/ONLINE booking, waits for the real room-lifecycle sweep to create
the LiveKit room, logs in as a tutor and a student via `POST /auth/user/login`,
fetches real tokens via `POST /live-sessions/:bookingId/token`, asserts the returned
token grants are correctly scoped (this is what proves the `roomAdmin` least-privilege
fix actually took effect), then uses `lk room join` to connect two synthetic
participants and confirms — via LiveKit's own `RoomServiceClient`, not just "the CLI
didn't error" — that both joined and both published tracks.

```bash
npx ts-node k6/support/seed-live-session-fixtures.ts
npx ts-node tools/live-session-harness/run.ts
```

Note: `lk room join` has no flag to accept an externally-issued JWT — it always mints
its own from `--api-key`/`--api-secret` (the same class of server credential the
backend's `RoomServiceClient` uses). That's a genuine limitation of the `lk` CLI, not
a shortcut taken here — the harness's file header explains this in full, and the
separate token-fetch step is what actually proves the auth/grant pipeline.

**On local dev, this will legitimately report no `relay` (TURN) ICE candidate** — local
dev has no TURN server configured on purpose (see the hosting doc). To get a real
TURN-relay proof, point `HARNESS_API_BASE`/`LIVEKIT_URL` at the deployed VPS after
completing the TURN/cert/firewall steps there.

### 2. Playwright E2E (`mentora-ui/e2e/live-session.spec.ts`)

Drives the actual client UI (Expo web build) through the real flow: login → Bookings
→ booking detail → "Start Session" → pre-join screen → "Join Now" → confirms a
**real remote `<video>` element** renders (from a synthetic counterpart participant
started via the `lk` CLI in global setup) — then asserts against the backend's own
admin API (`GET /admin/live-sessions/:bookingId`), not just UI state, that the room
flipped to `ACTIVE` and a `SessionParticipant` row exists for the tutor with
`firstJoinedAt` set. This is the check that would have caught the webhook-routing bug
found during this audit — a UI that looks right while the backend never heard about
the join.

```bash
# from mentora-ui/, with mentora-api checked out as a sibling directory
# (../mentora-api — the test's global-setup.ts shells out to its seed script)
npm install
npx playwright install chromium
npx playwright test
```

Uses Chromium's `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`
launch flags plus Playwright's `permissions: ["camera", "microphone"]` context option
— both are required for `getUserMedia()` to resolve headlessly; the fake-device flags
alone were not sufficient in testing (WebRTC failed to establish without the explicit
permission grant).

### CI

[.github/workflows/live-session-e2e.yml](.github/workflows/live-session-e2e.yml) runs
both on every push/PR touching live-session code. **This workflow was written to
mirror the exact commands verified locally but has not itself been run in GitHub
Actions** — it's new CI for a repo that had none before; verify the first run and
adjust as needed (particularly the `lk` CLI Linux download step and Prisma migration
step, which weren't exercised locally on this Windows dev machine).
