# Live Session (LiveKit) — Production Hosting & TURN Setup

This documents the changes made in the live-session production-hardening pass, and
exactly what still needs to be done **on the VPS itself** — nothing here was run
against the VPS; this session only had access to the local repo on the dev machine.

## What changed and where

| File | What | Why |
|---|---|---|
| [`docker/livekit/livekit.prod.yaml`](../../docker/livekit/livekit.prod.yaml) | **New file.** Same as `docker/livekit/livekit.yaml` (dev) plus a `turn:` block and the real prod webhook URL. | TURN needs a real domain + cert that only exist on the VPS — putting it in the shared dev file would break `docker compose up` on a machine with no cert on disk. |
| [`docker-compose.prod.yml`](../../docker-compose.prod.yml) | `livekit` service now mounts `docker/livekit/livekit.prod.yaml` (was the shared dev file) and adds a read-only `/etc/letsencrypt` mount. | Points prod at the TURN-enabled config; gives the container access to the certbot-issued cert on the host. |
| `docker/livekit/livekit.yaml` (dev) | **Unchanged.** | Local dev keeps working exactly as before — no TURN, no cert required. |
| [`src/services/liveSession/roomLifecycle.processor.ts`](../../src/services/liveSession/roomLifecycle.processor.ts) | Added `finalizeOrphanedActiveRooms()`, run every sweep. | LiveKit's own webhook docs: *"there are no guarantees around delivery."* A room stuck ACTIVE past its scheduled end, confirmed gone from LiveKit itself via `listRooms`, now gets finalized with `SessionEndReason.TIMEOUT` instead of hanging forever and blocking lesson confirmation/payment release. |
| [`src/services/liveSession/roomLifecycleWatchdog.ts`](../../src/services/liveSession/roomLifecycleWatchdog.ts) | **New file**, started independently in `src/index.ts`. | Dead-man's-switch for the sweep above: if the heartbeat it writes goes stale for 5+ minutes, notifies everyone holding `liveSessions.manage` via the existing `NotificationService`. Runs on its own `setInterval`, not on the sweep's own queue, so it still fires even if that queue/worker is the thing that's broken. |
| [`src/modules/liveSession/liveSession.service.ts`](../../src/modules/liveSession/liveSession.service.ts) (`buildGrant`) | Removed `roomAdmin: true` from the tutor's client-side token grant. | Every admin action (mute/remove/lock/end) already goes through the backend's `roomServiceClient` (server API key) — the client token never needed it. A leaked tutor token could otherwise call LiveKit's admin API directly. |
| [`mentora-ui/src/hooks/useLiveKitRoom.ts`](../../../mentora-ui/src/hooks/useLiveKitRoom.ts) | Added `RoomEvent.Reconnecting` / `Reconnected` handling, new `reconnecting` return value. | Previously only `Disconnected` was handled — a dropped 4G connection looked like a frozen call with no feedback. |
| [`mentora-ui/src/screens/LiveSessionScreen.tsx`](../../../mentora-ui/src/screens/LiveSessionScreen.tsx) | "Reconnecting…" banner shown while `reconnecting` is true. | User-visible feedback during LiveKit's automatic ICE-restart/full-reconnect flow. |

## What's still needed from you, on the VPS

I have no shell access to the production VPS from this session — everything below has
to be run there directly.

### 1. Install certbot (if not already present)

```bash
sudo apt update && sudo apt install -y certbot
```

### 2. Confirm port 80 is free too, not just 443

You confirmed 443 is free. Certbot's default `--standalone` mode also needs **port 80**
briefly, for both the initial issuance and every renewal. LiveKit doesn't use port 80,
so this should be free — but confirm with `sudo lsof -i :80` before proceeding. If
something else does own 80, switch to `--preferred-challenges dns` (DNS-01) instead —
tell me and I'll adjust the plan.

### 3. Issue the certificate for `turn.tallamichael.online`

```bash
sudo certbot certonly --standalone -d turn.tallamichael.online
```

This writes `fullchain.pem` / `privkey.pem` to
`/etc/letsencrypt/live/turn.tallamichael.online/` — the exact paths already referenced
in `docker/livekit/livekit.prod.yaml`. Don't change those paths without updating that
file too.

### 4. Set up auto-renewal with a LiveKit restart hook

Certbot on Debian/Ubuntu installs a `certbot.timer` that renews automatically, but
LiveKit doesn't hot-reload a rotated cert — it needs a restart after each renewal:

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/restart-livekit.sh <<'EOF'
#!/bin/sh
docker compose -f /path/to/mentora-api/docker-compose.prod.yml restart livekit
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-livekit.sh
```

Replace `/path/to/mentora-api` with the actual deploy path on the VPS. Test it with
`sudo certbot renew --dry-run`.

### 5. Firewall — confirm these are open to the VPS, not just "port 443 is free"

"Free" (nothing else bound to it) and "open in the firewall/security group" are
different things — please confirm both:

- **TCP 443** — TURN/TLS (and this is also where the cert issuance's brief HTTP-01
  check may run if you don't use standalone port 80)
- **TCP 80** — needed briefly during cert issuance/renewal (see step 2)
- **UDP 3478** — TURN/STUN
- **UDP 50000–51000** — reused for both the SFU's direct RTC media *and* the TURN
  relay range (`turn.relay_range_start/end` in `livekit.prod.yaml`), so it only needs
  opening once
- **TCP 7880, TCP 7881** — LiveKit's own signaling/WS and TCP-fallback ports, if not
  already open from the existing deployment

### 6. Deploy

```bash
git pull && docker compose -f docker-compose.prod.yml up -d --build
```

This picks up the new `livekit.prod.yaml` mount and the `/etc/letsencrypt` mount
automatically — no other manual step needed on this side.

### 7. Verify TURN is actually being offered (not just configured)

Don't take a successful call as proof — a same-network test succeeds via host/srflx
candidates even with zero working TURN. Use the Phase 4 test harness (see the main
[README](../../README.md#live-session-test-harness)) to confirm an actual `relay`
(TURN) ICE candidate type gets negotiated, not just that a call connects.

## Known pre-existing issue, out of this pass's scope

`docker/livekit/livekit.yaml` and `docker/livekit/livekit.prod.yaml` both have a
plaintext LiveKit API key/secret committed to git (the `keys:` block). This wasn't
part of the requested fix list, so it hasn't been touched — flagging it here so it
isn't lost. If you want it rotated to something not sitting in git history, that's a
separate, deliberate change (new key pair + coordinated redeploy), not something to do
silently as a side effect of this pass.
