# prod-k6 — tutor onboarding stress-seed

Two scripts, pick one depending on where your account data comes from:

- **`createAccountsFromJson.k6.js`** (current default) — you provide a JSON
  file of tutor records and a folder of photos (schema + setup below); the
  script creates each account via the no-email staging endpoint, completes
  the profile, uploads your photo, and submits KYC. Use this one.
- **`seedStressTutors.k6.js`** — self-contained, generates its own names via
  `data/names.js` and registers through the real email-OTP flow (sends one
  real email per tutor). Kept for reference/smaller runs where you don't
  want to manage a JSON file yourself, but for the current plan use
  `createAccountsFromJson.k6.js` instead — no email, and you control the
  photos.

Both exercise the **real** tutor onboarding pipeline (profile → intro video
→ 4-step KYC → real admin approval) through live HTTP endpoints only. No
direct database access anywhere in this folder.

## `createAccountsFromJson.k6.js` — setup

### 1. Enable the staging-create endpoint on the target server

Add to the target's `.env` and restart the `app` container:

```
STAGING_AUTH=true
```

Any account holding the "Super Admin" role can call the endpoint once this
is set — checked via the role on the caller's own session, not a specific
hardcoded account. This route does not exist at all unless `STAGING_AUTH=true`
(same pattern as `/auth/dev/otp`) — nothing else to configure, and nothing
to disable later beyond unsetting the var.

### 2. Build your JSON file

An array of objects, one per tutor. Full field list and constraints are in
the schema Claude gave you in-conversation — the short version:

```jsonc
{
  "index": 0, "email": "...", "password": "...",
  "firstName": "...", "middleName": "...", "lastName": "...", "fullLegalName": "...",
  "gender": "MALE", "dob": "1985-03-14",           // age must land 25-60
  "photoFileName": "tutor-0000.jpg",                // must exist in PHOTOS_DIR
  "cityId": "...", "currentRegionId": "...",        // real ids from GET /api/v1/cities
  "cityOfOrigin": "...", "regionOfOrigin": "...", "placeOfBirth": "...",
  "currentStreet": "...", "currentNeighbourhood": "...",
  "emergencyContactName": "...", "emergencyContactPhone": "...",
  "teachingMode": "ONLINE_ONLY", "languages": ["EN"], "yearsOfExperience": 5,
  "bio": "...",
  "subjectIds": ["..."], "levelIds": ["..."],        // real ids from GET /api/v1/subjects, /api/v1/levels
  "ratePerOnlineHourXaf": 3000, "ratePerHomeHourXaf": 5000,
  "cniNumber": "123456789",
  "institutionName": "...", "qualificationType": "BSC", "fieldOfStudy": "...", "yearAwarded": 2015,
  "trainWeight": 70                                  // optional, ranking-cohort only
}
```

### 3. Photos

One folder, every `photoFileName` referenced in the JSON must exist in it.
The same photo is reused for both the profile picture and the KYC selfie
field — you don't need two images per tutor.

### 4. Run

Smoke test with a JSON file containing just 3-5 records first:

```bash
k6 run \
  -e BASE_URL=https://mentora.api.tallamichael.online \
  -e ALLOW_NON_LOCAL_TARGET=true \
  -e STAGING_ADMIN_EMAIL=you@example.com -e STAGING_ADMIN_PASSWORD='...' \
  -e TUTORS_JSON_PATH=./data/tutors.json \
  -e PHOTOS_DIR=./assets/tutor-photos \
  -e VUS=1 \
  prod-k6/createAccountsFromJson.k6.js
```

`setup()` logs in as your admin and probes the staging endpoint before
touching any real tutor record — it fails fast with a clear message if
`STAGING_AUTH` isn't enabled or `STAGING_ADMIN_EMAIL` isn't a Super Admin.
Once the smoke test looks right, drop `-e VUS=1` up to `-e VUS=4` (or
higher) and point `TUTORS_JSON_PATH` at your full file. Resuming after an
interrupt works the same way as below (`START_INDEX`, from the
`tutor_created` ndjson lines in stdout).

Set `-e SKIP_APPROVAL=true` if you want account creation + KYC submission
only, with admin approval done separately later — otherwise approval (and
opening each subject for booking) runs as part of the same pipeline, since
a tutor isn't searchable without it.

---

## `seedStressTutors.k6.js` (self-contained, email-OTP based)

The rest of this document covers the older, self-contained script.

Every uploaded "document" (CNI front/back, selfie, non-conviction
certificate, credential document, intro video) is a small placeholder file
in `assets/` — plain solid-color images/video, not a real or synthetic
identity photo. The admin-approval stage calls the same real
`approve-identity` / `approve-subject` endpoints a human reviewer uses; it
does not forge review outcomes, it has your real admin account approve a
known batch of test accounts through the real code path.

## Before you run anything

This creates real accounts, real KYC applications, and sends one real
transactional email (registration OTP) per tutor through your actual email
provider. Know your provider's rate limit before picking `VUS` — the
default (`VUS=4`) is deliberately conservative.

## 1. Smoke test first — always

Never go straight to 2000. Run a tiny batch and actually look at the
results in the app (search for a tutor, check the admin KYC queue) before
committing to the full run:

```bash
k6 run \
  -e BASE_URL=https://mentora.api.tallamichael.online \
  -e ALLOW_NON_LOCAL_TARGET=true \
  -e SUPER_ADMIN_EMAIL=you@example.com \
  -e SUPER_ADMIN_PASSWORD='...' \
  -e TOTAL_TUTORS=5 \
  -e VUS=1 \
  prod-k6/seedStressTutors.k6.js
```

`setup()` fails fast (before creating anything) if `GET /auth/dev/otp`
isn't reachable on the target — that endpoint is compiled out entirely
when `NODE_ENV=production` (see `auth.route.ts`), and registration can't
complete without it unless you're reading OTPs from a real inbox. If setup
fails on that check, the target needs a different `NODE_ENV` or a
different registration path — don't try to work around it by hand.

## 2. Full run

Once the smoke test looks right:

```bash
k6 run \
  -e BASE_URL=https://mentora.api.tallamichael.online \
  -e ALLOW_NON_LOCAL_TARGET=true \
  -e SUPER_ADMIN_EMAIL=you@example.com \
  -e SUPER_ADMIN_PASSWORD='...' \
  -e TOTAL_TUTORS=2000 \
  -e VUS=4 \
  prod-k6/seedStressTutors.k6.js 2>&1 | tee prod-k6/logs/run-$(date +%Y%m%d-%H%M%S).log
```

The `tee` is important — stdout carries the `tutor_created` /
`tutor_pipeline_failed` ndjson lines you need for resuming (see below) and
the final summary. `maxDuration` per scenario is 6h; at VUS=4 with real
network latency + one real email per tutor, budget for several hours.

## 3. Resuming an interrupted run

k6 doesn't have built-in cross-run state, so resumability is log-based.
Every successfully completed tutor prints a line like:

```
{"event":"tutor_created","index":743,"phase":2,...}
```

To resume after an interrupt, find the highest `index` value across all
`prod-k6/logs/run-*.log` files and start the next run one past it:

```bash
grep -o '"index":[0-9]*' prod-k6/logs/run-*.log | grep -o '[0-9]*$' | sort -n | tail -1
```

Add 1 to that number and pass it as `START_INDEX`:

```bash
k6 run \
  -e BASE_URL=https://mentora.api.tallamichael.online \
  -e ALLOW_NON_LOCAL_TARGET=true \
  -e SUPER_ADMIN_EMAIL=you@example.com \
  -e SUPER_ADMIN_PASSWORD='...' \
  -e TOTAL_TUTORS=2000 \
  -e VUS=4 \
  -e START_INDEX=744 \
  prod-k6/seedStressTutors.k6.js 2>&1 | tee -a prod-k6/logs/run-$(date +%Y%m%d-%H%M%S).log
```

Names, subject assignments, and cities are all deterministic per index
(see `data/names.js`), so re-running with the same `START_INDEX` never
produces duplicates or collides with what already exists — indices below
`START_INDEX` are skipped as a cheap no-op.

## 4. Checking results

- `GET /api/v1/search/tutors?limit=50` (no auth needed) — should return
  populated pages once tutors clear admin approval.
- Admin KYC queue in the app, or `GET /api/v1/admin/kyc/queue` — should be
  empty of PENDING applications from this batch once the run finishes
  (everything gets auto-approved as part of the pipeline).
- `prod-k6/logs/k6-seed-summary.json` — full k6 metrics from the run,
  written by `handleSummary()`.

## 5. Cleanup, once you're done with the demo

You mentioned dropping the whole database and starting fresh afterward,
which handles this automatically. If you instead want to remove just this
batch before that, every created account's email matches the pattern
`prodk6-tutor-*@k6.mentora.test` — filter on that.

## Folder contents

- `seedStressTutors.k6.js` — the pipeline itself.
- `data/names.js` — deterministic Cameroonian name pool (first × middle ×
  last combinatorial, index-addressed, comfortably >2000 unique
  combinations).
- `assets/` — placeholder upload files (video + images + PDF), all plain
  generated content, not identity photos.
- `logs/` — where your `tee`'d run output and the k6 JSON summary land.
