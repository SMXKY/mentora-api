# Phase 2: Architecture & Technical Decisions

## Architecture Decision Records (ADRs)

---

### ADR-001: HTTP Framework: Express.js

**Status:** Accepted

**Date:** May 2026

**Context:**

MENTORA requires a Node.js HTTP framework to handle API routing, middleware, request validation, and response serialisation across 22 modules. The primary candidates evaluated were Express.js, Fastify, and NestJS.

Fastify offers superior performance (2-3x throughput over Express in benchmarks) and built-in OpenAPI generation from route schemas. NestJS offers strong opinions and enterprise patterns but introduces significant boilerplate and a steep learning curve. Express is the most widely used Node.js framework with the most mature ecosystem and the lowest learning curve.

**Decision:**

Express.js with TypeScript.

**Reasons:**

The lead developer has deep existing Express experience with a proven architecture pattern (controller/service/repository) already working in production on other projects. Given a 2.5 month delivery timeline, reducing framework friction takes priority over marginal performance gains. The performance difference between Express and Fastify will not be the bottleneck on this system — database queries, external API calls (NotchPay, LiveKit), and VPS compute will be the actual bottlenecks. Express's ecosystem maturity means every integration needed (Clerk, Socket.io, BullMQ, Swagger UI) has a well-documented Express path.

OpenAPI documentation is handled separately via `@asteasolutions/zod-to-openapi` which generates the spec from Zod schemas — this closes the documentation gap between Express and Fastify.

**Consequences:**

- No automatic OpenAPI generation from route definitions — compensated by the `build-docs` CLI script
- No built-in schema validation — compensated by Zod middleware on every route
- Slightly more boilerplate per route than Fastify — compensated by the module scaffolding generator
- `catchAsync` wrapper required for async route handlers

**Alternatives considered:**

Fastify — rejected due to learning curve risk on a tight timeline. Recommended for future projects where ramp-up time is available. NestJS — rejected due to opinionated structure conflicting with existing architecture patterns and heavy boilerplate.

---

### ADR-002 — ORM: Prisma

**Status:** Accepted

**Date:** May 2026

**Context:**

The system requires a database access layer for PostgreSQL that supports TypeScript, schema-first migrations, and complex relational queries across 22 modules with hundreds of tables and relationships.

Candidates evaluated: Prisma, Drizzle ORM, TypeORM, raw `pg` with `kysely`.

**Decision:**

Prisma with PostgreSQL.

**Reasons:**

Prisma's schema file is the single source of truth for the entire database structure. Running `prisma migrate dev` generates a versioned migration file automatically from schema changes — no manual SQL writing. The generated Prisma client provides full TypeScript types for every model and query result, eliminating an entire class of type mismatch bugs. The scaffolding generator reads the Prisma schema via `@prisma/internals` to auto-generate module files, which is a core part of the development workflow.

Drizzle ORM is faster and more SQL-native but has a smaller ecosystem and less mature documentation. The productivity advantage of Prisma's generated types and automatic migrations outweighs Drizzle's performance edge for this project. TypeORM has known issues with complex migrations and its TypeScript support feels retrofitted. Raw SQL with kysely gives maximum control but requires writing all types manually.

**Consequences:**

- Schema changes require running `prisma migrate dev` — never direct database modification in production
- Complex search ranking queries use `prisma.$queryRaw` for performance-critical paths
- Prisma client must be regenerated after every schema change (`prisma generate`)
- PgBouncer sits between the application and PostgreSQL to manage connection pooling across multiple Node.js workers

**Migration rules:**

Every database change is a migration file. Migration files are never edited after creation. Rolling back uses a new migration, never deleting an existing one. Migration files are committed to version control alongside application code.

---

### ADR-003 — Authentication: Clerk

**Status:** Accepted

**Date:** May 2026

**Context:**

MENTORA requires authentication covering email/password registration, Google OAuth, Facebook OAuth, session management, and TOTP two-factor authentication for privileged accounts. Building this from scratch is a significant security surface area.

Candidates evaluated: Clerk, Auth0, self-built JWT authentication, Better Auth.

**Decision:**

Clerk for all authentication flows.

**Reasons:**

Clerk handles the full authentication surface: OAuth providers, session tokens, TOTP, device management, and webhook events for keeping the local user table in sync. The free tier covers 10,000 MAU which is well above expected launch traffic. When the platform exceeds 10,000 MAU it is generating sufficient revenue to absorb the paid tier cost. The `@clerk/express` SDK integrates directly with the existing Express architecture. Clerk's webhook events (user.created, session.created, session.revoked) keep the local `users` table in sync without building a custom sync layer.

Self-built JWT authentication was considered and rejected — the security complexity of handling OAuth flows, token rotation, device fingerprinting, and TOTP correctly within a 2.5 month timeline is too high a risk. Auth0 is equivalent in capability to Clerk but more expensive at scale. Better Auth is newer with a smaller ecosystem.

**Consequences:**

- User identity is split: Clerk owns credentials and sessions, local PostgreSQL owns user profile and platform data
- Every authenticated request validates the Clerk session token via `clerkMiddleware()` before hitting any route handler
- Clerk webhook endpoint must be secured with Clerk's webhook signature verification
- If Clerk is ever replaced, the auth middleware layer is the only code that changes — service and repository layers are unaffected
- Admin, Moderator, Super Admin, and Support Agent accounts use email/password only — no OAuth for privileged roles
- TOTP for privileged accounts is enforced at the middleware level before any admin route is accessible

**Upgrade path:**

When MAU exceeds Clerk free tier, upgrade to Clerk Pro. If the client ever requires self-hosted auth, migrate to Better Auth or a custom JWT implementation — the auth middleware interface abstracts this from the rest of the codebase.

---

### ADR-004 — Payment Processing: NotchPay

**Status:** Accepted

**Date:** May 2026

**Context:**

MENTORA requires payment processing for MTN Mobile Money and Orange Money in Cameroon. Both operators must be supported. The system requires: payment initiation, webhook confirmation, payout to user accounts, and a merchant wallet for escrow management.

Candidates evaluated: NotchPay, direct MTN MoMo API integration, direct Orange Money API integration, CinetPay.

**Decision:**

NotchPay as the single payment provider.

**Reasons:**

NotchPay is a Cameroon-native payment gateway that handles both MTN MoMo (`cm.mtn`) and Orange Money (`cm.orange`) through a single REST API. Building separate integrations for MTN and Orange doubles the integration surface, doubles the maintenance burden, and requires two separate merchant agreements. NotchPay abstracts both operators behind one API, one dashboard, one merchant agreement, and one webhook endpoint. This directly reduces the complexity of Module 13 from two payment integrations to one.

CinetPay supports Cameroon but is primarily West African focused and has less community support for the specific operators needed here.

**Consequences:**

- All payment logic goes through a single `PaymentService` that wraps the NotchPay SDK — no direct NotchPay calls outside this service
- Escrow is implemented as a ledger in the PostgreSQL database — not a separate NotchPay feature
- Three ledger categories track separately: escrow balance (belongs to users), tutor wallet balance (earned but not withdrawn), commission balance (belongs to Mentora)
- All three categories sit in the same NotchPay merchant wallet — the ledger is the source of truth for which funds belong to whom
- NotchPay webhook events must be verified with NotchPay's signature before processing
- All payment endpoints are idempotent — duplicate webhook delivery never creates duplicate transactions
- If NotchPay is ever replaced, only `PaymentService` changes — all escrow and wallet logic in the database layer is unaffected

---

### ADR-005 — Video Sessions: LiveKit (Self-Hosted)

**Status:** Accepted

**Date:** May 2026

**Context:**

MENTORA requires in-app video for one-on-one tutoring sessions and group classes. The solution must support: room creation, participant access control, session duration tracking for escrow verification, screen sharing, in-session chat, and a shared whiteboard. Building raw WebRTC is not feasible within the timeline.

Candidates evaluated: LiveKit (self-hosted), LiveKit Cloud, Google Meet API, Daily.co, Twilio Video.

**Decision:**

LiveKit self-hosted on a dedicated VPS instance.

**Reasons:**

LiveKit is open source (Apache 2.0) and production-grade — used by Salesforce, Tesla, and thousands of developers handling billions of calls. Self-hosting eliminates per-minute usage costs during the growth phase. The same codebase works if migrated to LiveKit Cloud later — no application code changes required. LiveKit's room and token architecture gives the backend full control over participant permissions, which is required for the escrow verification model (session tracking data tied to booking IDs).

Google Meet API requires a formal OAuth security review process that can take weeks and restricts group sessions to 60 minutes on free tier. Daily.co and Twilio Video are pay-per-minute from day one. LiveKit self-hosted costs only the VPS running it.

**Consequences:**

- LiveKit server runs on a separate $10-20/month Hetzner VPS alongside the main application or as a Docker container on the same VPS at launch
- Room names are non-guessable UUIDs — never predictable from booking IDs
- JWT tokens are generated by the backend for each participant — never client-side
- Session tracking data (join times, leave times, overlap duration) is the evidence for dispute resolution
- Session recordings are configured from day one but flag-gated — recordings are stored but not surfaced to users until the feature flag is enabled
- Group sessions are flag-gated behind `live_sessions.group_sessions`
- React Native mobile app uses `@livekit/react-native` — same token generation endpoint, no backend changes

**Upgrade path:**

When self-hosted VPS cannot handle concurrent session load, migrate to LiveKit Cloud. The application code changes only in the LiveKit server URL configuration — all token generation and room management logic is identical.

---

### ADR-006 — Background Jobs: BullMQ

**Status:** Accepted

**Date:** May 2026

**Context:**

MENTORA requires background job processing for: escrow auto-release (48hr), session reminders (24hr and 1hr before), KYC SLA escalation, risk score decay, analytics snapshots, monthly fee deduction, file hard deletion, review window closure, Tutor boost expiry, and scheduled reports. These jobs must be reliable, observable, and survive server restarts.

Candidates evaluated: BullMQ, Agenda (MongoDB-backed), node-cron, custom Redis-based scheduler.

**Decision:**

BullMQ with Redis as the job queue backend.

**Reasons:**

Redis is already in the stack for caching and rate limiting — BullMQ adds no new infrastructure. BullMQ is the TypeScript-native successor to Bull with first-class TypeScript support, built-in retry with exponential backoff, delayed jobs, repeatable jobs, job prioritisation, concurrency control, and a dead letter queue for failed jobs. Bull Board provides a web UI for job monitoring accessible to developers. The dead man's switch heartbeat pattern required by the SRS is implemented naturally with BullMQ's repeatable jobs — a job writes a heartbeat to Redis on every successful run, Prometheus monitors the heartbeat timestamp.

node-cron is simple but has no persistence — a server restart loses all scheduled jobs. Agenda requires MongoDB which is not in the stack. A custom Redis scheduler requires building retry logic, failure handling, and observability from scratch.

**Consequences:**

- Every background job has a corresponding heartbeat key in Redis with a TTL of 2x the expected run interval
- Prometheus alerts when any heartbeat TTL expires — the job has missed its window
- Failed jobs after exhausting retries move to the dead letter queue — visible in Bull Board and in the Admin dashboard
- Job definitions include: queue name, retry count, backoff strategy, and heartbeat interval
- All job processing is idempotent — running the same job twice produces the same result as running it once

---

### ADR-007 — Caching: Redis

**Status:** Accepted

**Date:** May 2026

**Context:**

The system requires caching for: permission resolution, feature flag states, search composite scores, search result sets, rate limit counters, session data, and BullMQ job state. A single caching layer that serves all these concerns reduces infrastructure complexity.

**Decision:**

Redis (self-hosted) as the single caching and state layer.

**Reasons:**

Redis serves five distinct purposes in this architecture without requiring separate infrastructure for any of them: application cache (permissions, flags, search scores), rate limiting state (via `ioredis` with atomic operations), BullMQ job queue backend, Socket.io adapter for horizontal scaling, and background job heartbeat store. Running one Redis instance for all five purposes on a small VPS is more efficient than running separate services. Redis persistence (AOF or RDB) ensures job queue state survives server restarts.

**Cache key conventions:**

|Purpose|Key Pattern|TTL|
|---|---|---|
|Permission resolution|`perms:{userId}`|5 minutes|
|Feature flag state|`flags:{flagName}`|60 seconds|
|Search composite score|`score:{tutorId}`|Until invalidated|
|Search results|`search:{queryHash}`|5 minutes|
|Rate limit counter|`rl:{endpoint}:{id}`|Window duration|
|Job heartbeat|`heartbeat:{jobName}`|2x expected interval|

**Consequences:**

- All Redis operations go through a single `redis` client instance exported from `src/config/redis.config.ts` — no direct `ioredis` instantiation outside this file
- Cache invalidation is triggered by specific application events — never by TTL alone for critical data like permissions
- Redis persistence is configured to AOF (append-only file) mode to prevent job queue loss on restart
- When horizontal scaling is applied, Redis runs as a separate container with its own VPS resources — not co-located with the application

---

### ADR-008 — Real-Time Communication: Socket.io

**Status:** Accepted

**Date:** May 2026

**Context:**

MENTORA requires real-time bidirectional communication for: in-platform messaging (Module 15), live notification delivery (Module 12), dashboard count updates (Module 6.5), and typing indicators. The solution must work across multiple server instances when the application scales horizontally.

**Decision:**

Socket.io with the `@socket.io/redis-adapter` for multi-instance support.

**Reasons:**

Socket.io handles WebSocket connections with automatic fallback to long polling when WebSocket is unavailable — critical for Cameroon where network conditions are variable. The Redis adapter means a message emitted from one Node.js instance is delivered to clients connected to any other instance — horizontal scaling works without application changes. Socket.io's room concept maps directly to conversations (messaging rooms) and user-specific rooms (notification delivery). The lead developer has existing Socket.io experience from previous projects.

Raw WebSocket has no Redis adapter, no automatic reconnection, no fallback transport, and no room management. Server-Sent Events are unidirectional — cannot support messaging.

**Consequences:**

- All Socket.io connection handling lives in `src/socket/socket.ts`
- Every connection requires a valid Clerk session token before joining any room — unauthenticated connections are rejected immediately
- Typing indicator events are transient — never written to the database
- Message persistence happens in PostgreSQL before Socket.io delivery — the database is the source of truth, not the socket
- Socket.io rooms follow naming conventions: `user:{userId}` for notifications, `conversation:{conversationId}` for messaging

---

### ADR-009 — API Documentation: zod-to-openapi + Swagger UI

**Status:** Accepted

**Date:** May 2026

**Context:**

The SRS requires a complete OpenAPI specification before implementation begins. The frontend team uses this spec as the contract to build against. Documentation must be module-scoped (each module owns its own API definitions), automatically generated (no manual YAML maintenance), and accessible to the frontend team via a hosted Swagger UI.

**Decision:**

`@asteasolutions/zod-to-openapi` for spec generation from Zod schemas, `swagger-ui-express` for hosting the interactive documentation, and a custom `build-docs` CLI script that merges all module fragments into one `openapi.json`.

**Reasons:**

Zod is already the validation library for the entire project. `zod-to-openapi` extends Zod schemas with OpenAPI metadata so the same schema that validates a request also generates the documentation for that endpoint. No separate documentation file to maintain — the schema IS the documentation. Each module registers its own paths in a shared OpenAPI registry, keeping module-level separation while producing a single unified spec. The `build-docs` script can be run as a watch process during development so the spec updates automatically as schemas change.

**Workflow:**

```plain
Write Zod schema → register in module .openapi.ts file → 
run build-docs → openapi.json updates → 
Swagger UI serves updated spec → 
frontend dev sees changes immediately
```

**Consequences:**

- Every module has a `{module}.openapi.ts` file that registers its routes in the shared registry
- The `build-docs` script must import every module's `.openapi.ts` file — adding a new module requires adding one import to `build-docs.ts`
- `docs/api/openapi.json` is generated — never manually edited — gitignored from the repo or committed as a build artifact
- Swagger UI is served at `/api/docs` protected by HTTP basic auth in all environments
- Frontend team accesses docs at `https://api.mentora.cm/api/docs` in staging

---

### ADR-010 — Notifications: Multi-Channel NotificationService

**Status:** Accepted

**Date:** May 2026

**Context:**

MENTORA sends notifications across four channels: in-app (WebSocket + database), email (Resend), push (Firebase Cloud Messaging), and WhatsApp (WhatsApp Cloud API). A fifth channel, SMS, is stubbed for future implementation. All notification logic must go through a single service to ensure consistency, translation, and delivery tracking.

**Decision:**

A custom `NotificationService` class that abstracts all four channels behind a single `send()` interface.

**Reasons:**

Centralising notification dispatch means: translations are applied in one place, delivery retry logic is in one place, notification preferences are checked in one place, and audit logging of notification events is in one place. Any module calling `NotificationService.send()` does not know or care which channels are active — that is the service's concern. Adding a new channel (SMS when funded) requires changes only to `NotificationService` — no changes to any calling module.

**Channel implementations:**

|Channel|Provider|Status|
|---|---|---|
|In-app|PostgreSQL + Socket.io|Active|
|Email|Resend|Active|
|Push|Firebase Cloud Messaging|Active|
|WhatsApp|WhatsApp Cloud API|Active (free tier)|
|SMS|None|Stubbed|

**Consequences:**

- `NotificationService.send()` always writes to the database first before attempting any external delivery
- External channel failures never affect in-app notification delivery
- Each notification type has a default channel profile — calling modules override only when needed
- WhatsApp messages use pre-approved Meta templates — template submission is a pre-launch checklist item
- SMS stub logs the intended message and recipient to the application log — no external API call

---

### ADR-011 — Feature Flags: Flagsmith (Self-Hosted)

**Status:** Accepted

**Date:** May 2026

**Context:**

MENTORA requires a feature flag system to deploy code to production in a dormant state, enable features progressively, and provide instant kill switches for problematic features. The system must support boolean flags, percentage rollouts, and targeted flags (by role, city, or user ID).

**Decision:**

Flagsmith self-hosted via Docker.

**Reasons:**

Flagsmith is open source, self-hostable, free, and has a clean REST API. It supports all three flag types required. Flag state is cached in Redis (60-second TTL) so evaluation adds less than 5ms to any request. If Flagsmith is unreachable and the cache is empty, all flags default to OFF — the safe failure mode. Flagsmith Cloud is available as an upgrade path with no application code changes.

**Consequences:**

- All flag evaluations go through `isEnabled('flag.name')` helper — no direct Flagsmith SDK calls in business logic
- Flag names follow the convention `module_name.feature_name` — for example `live_sessions.group_sessions`
- Flags are never used for access control — that is RBAC's responsibility
- The CI pipeline checks that every flag referenced in code exists in Flagsmith — an unregistered flag name fails the build

---

### ADR-012 — Internationalisation: i18next + Tolgee

**Status:** Accepted

**Date:** May 2026

**Context:**

MENTORA must support French and English from launch with the ability to add languages later. All user-facing strings — API error messages, notification templates, email templates, validation messages — must be translatable. Translation keys must be manageable by non-developers.

**Decision:**

i18next as the translation engine with module-namespaced JSON files, Tolgee self-hosted as the translation management UI.

**Reasons:**

i18next is the industry standard for Node.js internationalisation with excellent TypeScript support. Module-namespaced translation files (`auth.json`, `booking.json`, `payments.json`) mean each module owns its strings and a developer working on the booking module never touches the auth translations. Tolgee provides a UI where the client or a translator can update translation values without touching code — a Super Admin logs into Tolgee, updates a French error message, and it is live without a deployment. Tolgee is self-hostable and free.

**Consequences:**

- `t('namespace.key', 'fallback string')` is the only permitted way to produce user-facing strings
- A CI check fails on any hardcoded user-facing string found in source files
- Missing keys fall back to English then to the hardcoded fallback — never crash a request
- Every new module must include translation files for both `en` and `fr` before merging to main
- Locales are organised as `src/locales/{lang}/{module}.json`

---

### ADR-013 — File Storage: Interserver S3-Compatible + Cloudflare CDN

**Status:** Accepted

**Date:** May 2026

**Context:**

MENTORA handles multiple file types: profile photos, KYC documents, intro videos, lesson materials (PDF, audio, video), whiteboard exports, and session recordings. Files must be stored securely, served efficiently to users in Cameroon, and never directly publicly accessible.

**Decision:**

Interserver object storage (S3-compatible) for storage with Cloudflare free tier as CDN layer. All file operations go through a central `MediaService`.

**Reasons:**

The client already has an Interserver storage plan — no new vendor relationship required. Interserver's S3-compatible API means the standard AWS SDK (`@aws-sdk/client-s3`) works without modification — if storage ever moves to a different S3-compatible provider, only the endpoint URL configuration changes. Cloudflare free tier sits in front of Interserver as a CDN with global edge nodes including Africa — file delivery latency for Cameroon users is dramatically reduced. All files are stored in a private bucket — no direct public access. Signed URLs are generated on demand by `MediaService` for authenticated access.

**Consequences:**

- `MediaService` is the only class that imports the AWS SDK or interacts with storage
- Files under 10MB upload via the server — files over 10MB use presigned PUT URLs (client uploads directly to Interserver, bypassing the VPS)
- Every uploaded file is virus-scanned by ClamAV before becoming accessible
- Profile photos are transcoded to WebP and resized to 800x800px maximum
- Videos are transcoded to two MP4 variants (720p and 360p) via FFmpeg
- Signed URLs expire after 15 minutes for documents and images, 2 hours for audio and video streaming

---

### ADR-014 — Observability Stack: Grafana + Prometheus + Loki + Sentry

**Status:** Accepted

**Date:** May 2026

**Context:**

The system requires two distinct observability concerns: infrastructure health (CPU, memory, response times, error rates, background job health) and application error tracking (stack traces, source-mapped errors, error grouping).

**Decision:**

Grafana + Prometheus + Loki (self-hosted) for infrastructure observability and application log aggregation. Sentry (free cloud tier) for error tracking.

**Reasons:**

Grafana + Prometheus + Loki is the industry standard self-hosted observability stack. All three are free and run as Docker containers on the same VPS. Prometheus scrapes metrics from the Node.js application via `prom-client`. Loki aggregates structured JSON logs shipped by Promtail. Grafana provides dashboards and alerting for both. Sentry handles the developer-facing error tracking concern — stack traces, source maps, error grouping — that Grafana does not address. Sentry's free tier (5,000 errors/month) is sufficient for launch.

**Consequences:**

- All application logs use Pino (structured JSON) — `console.log` is forbidden in production code, enforced by CI lint check
- Every log entry includes `requestId`, `module`, `event`, `userId`, and `timestamp`
- Every critical background job registers a heartbeat in Redis — Prometheus monitors heartbeat TTLs
- Sentry source maps are uploaded on every deployment — minified error stack traces resolve to original source
- Grafana is accessible only at an internal URL protected by HTTP basic auth and IP allowlist
- All alert rules are version-controlled in `docker/grafana/` — infrastructure as code

---

### ADR-015 — Product Analytics: PostHog (Self-Hosted)

**Status:** Accepted

**Date:** May 2026

**Context:**

The product team needs visibility into user behaviour: funnel drop-offs, feature adoption, search patterns, session quality, and experience ratings. This data informs product decisions without requiring user interviews or manual analysis.

**Decision:**

PostHog self-hosted via Docker.

**Reasons:**

PostHog is open source, self-hostable, free, and provides: event tracking, funnel analysis, session recordings, heatmaps, and in-app surveys. All user data stays on the platform's own infrastructure — no third-party analytics vendor receives user behaviour data. PostHog Cloud is available as an upgrade path. The free self-hosted version has no event limit.

**Consequences:**

- All event tracking goes through `analytics.track(event, properties)` helper — no direct PostHog SDK calls
- Events never contain PII — user IDs are hashed before being sent to PostHog
- Session recordings mask all sensitive form fields (payment inputs, CNI upload, password fields)
- Experience review ratings route to PostHog only — never to the reviews database table
- Pre-configured funnels (parent onboarding, tutor onboarding, search to booking, session completion) are set up before launch

---

### ADR-016 — Module Scaffolding: Custom CLI Generator

**Status:** Accepted

**Date:** May 2026

**Context:**

Building 22 backend modules manually requires creating 8-9 files per module with consistent structure. Manual creation is time-consuming, error-prone, and produces inconsistent code. A code generation tool eliminates this friction.

**Decision:**

A custom CLI scaffold generator at `cli/scaffold.ts` that reads Prisma schema models and generates the full module file structure from templates.

**Reasons:**

The generator reads a Prisma model definition and produces all module files pre-filled with correct imports, class names, typed method stubs, and Zod schemas derived from the model's fields. The developer opens the service file and writes business logic immediately. Templates enforce architectural consistency across all 22 modules — every module follows exactly the same structure. New developers can generate a module and understand the codebase immediately because every module looks the same.

**Generator command:**

```bash
npx ts-node cli/scaffold.ts booking
```

**Generated files per module:**

- `{module}.controller.ts` — typed request handlers
- `{module}.service.ts` — business logic stubs
- `{module}.repository.ts` — Prisma query stubs
- `{module}.schema.ts` — Zod validation schemas
- `{module}.openapi.ts` — OpenAPI route registration
- `{module}.route.ts` — Express router with middleware
- `{module}.types.ts` — TypeScript types derived from Zod schemas
- `{module}.test.ts` — Jest test stubs for service methods
- `index.ts` — barrel export

**Consequences:**

- Templates live in `cli/templates/` and are the source of truth for module structure
- Updating a template does not retroactively change existing modules — only new scaffolded modules use the updated template
- The generator refuses to overwrite an existing module directory
- After scaffolding, the developer manually adds the module import to `src/modules/index.ts` and to `cli/build-docs.ts`

---

Now the repo structure and scaffolding plan document.

---

# Repository Structure & Scaffolding Plan

## Repository Strategy

Two separate repositories. Teams are independent and communicate only through the OpenAPI specification.

|Repository|Team|Access|
|---|---|---|
|`mentora-backend`|Backend developer|Full access|
|`mentora-frontend`|Frontend developer|Full access|

The OpenAPI spec at `https://api.mentora.cm/api/docs` (staging) is the contract between teams. The backend developer never tells the frontend developer what an endpoint returns — they read the spec.

---

## mentora-backend Repository Structure

```plain
mentora-backend/
│
├── cli/                          # Developer tools — not part of the application
│   ├── scaffold.ts               # Module generator: npx ts-node cli/scaffold.ts <module>
│   ├── build-docs.ts             # OpenAPI spec generator: npm run docs:build
│   └── templates/                # Module file templates
│       ├── controller.template.ts
│       ├── service.template.ts
│       ├── repository.template.ts
│       ├── schema.template.ts
│       ├── openapi.template.ts
│       ├── route.template.ts
│       ├── types.template.ts
│       ├── test.template.ts
│       └── index.template.ts
│
├── docs/                         # All project documentation
│   ├── SRS.md                    # Software Requirements Specification
│   ├── ADRs/                     # Architecture Decision Records
│   │   ├── ADR-001-framework-express.md
│   │   ├── ADR-002-orm-prisma.md
│   │   ├── ADR-003-auth-clerk.md
│   │   ├── ADR-004-payments-notchpay.md
│   │   ├── ADR-005-video-livekit.md
│   │   ├── ADR-006-jobs-bullmq.md
│   │   ├── ADR-007-cache-redis.md
│   │   ├── ADR-008-realtime-socketio.md
│   │   ├── ADR-009-docs-zod-openapi.md
│   │   ├── ADR-010-notifications.md
│   │   ├── ADR-011-feature-flags-flagsmith.md
│   │   ├── ADR-012-i18n-i18next-tolgee.md
│   │   ├── ADR-013-storage-interserver-cloudflare.md
│   │   ├── ADR-014-observability-grafana-prometheus-loki-sentry.md
│   │   ├── ADR-015-analytics-posthog.md
│   │   └── ADR-016-scaffolding-cli.md
│   ├── database/
│   │   ├── schema.dbml           # Full DB schema in DBML format (source of truth)
│   │   └── ERD.png               # Exported from dbdiagram.io
│   └── api/
│       └── openapi.json          # Generated by build-docs — never edited manually
│
├── prisma/
│   ├── schema.prisma             # Prisma schema — derived from schema.dbml
│   ├── seed.ts                   # Database seed script
│   └── migrations/               # Auto-generated migration files — never manually edited
│
├── src/
│   ├── app.ts                    # Express app setup, middleware registration, route mounting
│   ├── index.ts                  # Server start, port binding, graceful shutdown
│   │
│   ├── config/                   # Third-party service configuration
│   │   ├── database.config.ts    # Prisma client singleton
│   │   ├── redis.config.ts       # ioredis client singleton
│   │   ├── clerk.config.ts       # Clerk SDK setup
│   │   ├── notchpay.config.ts    # NotchPay client setup
│   │   ├── livekit.config.ts     # LiveKit server SDK setup
│   │   ├── storage.config.ts     # AWS SDK pointing at Interserver
│   │   ├── flagsmith.config.ts   # Flagsmith client setup
│   │   └── bullmq.config.ts      # BullMQ queue definitions
│   │
│   ├── docs/
│   │   └── openapi.registry.ts   # Shared OpenApiRegistry instance for zod-to-openapi
│   │
│   ├── modules/                  # Feature modules — one folder per SRS module
│   │   ├── index.ts              # Registers all module routers on the Express app
│   │   │
│   │   ├── rbac/                 # Module 1 — Authorization & RBAC
│   │   │   ├── rbac.controller.ts
│   │   │   ├── rbac.service.ts
│   │   │   ├── rbac.repository.ts
│   │   │   ├── rbac.schema.ts
│   │   │   ├── rbac.openapi.ts
│   │   │   ├── rbac.route.ts
│   │   │   ├── rbac.types.ts
│   │   │   ├── rbac.test.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── i18n/                 # Module 2 — Localization
│   │   ├── security/             # Module 3 — Rate Limiting & API Security
│   │   ├── flags/                # Module 4 — Feature Flags
│   │   ├── audit/                # Module 5 — Audit Logs & Application Logging
│   │   ├── auth/                 # Module 6 — Authentication & Identity
│   │   ├── dashboard/            # Module 6.5 — Dashboards & Home Screens
│   │   ├── profiles/             # Module 7 — User Profiles
│   │   ├── media/                # Module 8 — Media Management & CDN
│   │   ├── materials/            # Module 8.5 — Learning Materials
│   │   ├── kyc/                  # Module 9 — Tutor Onboarding & KYC
│   │   ├── search/               # Module 10 — Tutor Discovery & Search
│   │   ├── booking/              # Module 11 — Booking & Scheduling
│   │   ├── notifications/        # Module 12 — Notifications
│   │   ├── payments/             # Module 13 — Payments & Escrow
│   │   ├── sessions/             # Module 14 — Live Sessions (LiveKit)
│   │   ├── messaging/            # Module 15 — Messaging
│   │   ├── disputes/             # Module 16 — Lesson Confirmation & Disputes
│   │   ├── reviews/              # Module 17 — Ratings & Reviews
│   │   ├── trust/                # Module 18 — Trust & Safety & Fraud Detection
│   │   ├── admin/                # Module 19 — Admin Dashboard
│   │   ├── support/              # Module 19.5 — Support Tickets
│   │   ├── analytics/            # Module 20 — Analytics & Reporting
│   │   ├── observability/        # Module 21 — Platform Observability
│   │   └── learning/             # Module 22 — Learning Analytics
│   │
│   ├── base/                     # Base classes shared across all modules
│   │   ├── BaseController.ts     # Shared request handler utilities
│   │   ├── BaseService.ts        # Shared service utilities
│   │   └── BaseRepository.ts     # Shared Prisma query utilities
│   │
│   ├── middlewares/              # Express middleware
│   │   ├── protect.middleware.ts       # Clerk session validation
│   │   ├── restrictTo.middleware.ts    # RBAC permission check
│   │   ├── getUserLanguage.middleware.ts # Locale detection
│   │   ├── handleFiles.middleware.ts   # Multer file upload handling
│   │   ├── rateLimiter.middleware.ts   # Redis-backed rate limiting
│   │   └── requestId.middleware.ts     # UUID request ID injection
│   │
│   ├── jobs/                     # BullMQ background jobs
│   │   ├── queue.ts              # Queue definitions
│   │   ├── scheduler.ts          # Repeatable job scheduling
│   │   ├── constants.ts          # Job name constants
│   │   ├── heartbeat.ts          # Dead man's switch heartbeat utility
│   │   ├── index.ts              # Job worker registration
│   │   ├── escrowAutoRelease.job.ts
│   │   ├── sessionReminder.job.ts
│   │   ├── kycSlaEscalation.job.ts
│   │   ├── riskScoreDecay.job.ts
│   │   ├── analyticsSnapshot.job.ts
│   │   ├── tutorBoostExpiry.job.ts
│   │   ├── reviewWindowClose.job.ts
│   │   ├── monthlyFeeDeduction.job.ts
│   │   ├── fileHardDelete.job.ts
│   │   └── scheduledReports.job.ts
│   │
│   ├── services/                 # Shared services used across multiple modules
│   │   ├── notification/
│   │   │   ├── notification.service.ts     # NotificationService.send()
│   │   │   ├── notification.dispatcher.ts  # Channel routing logic
│   │   │   ├── channels/
│   │   │   │   ├── inapp.channel.ts
│   │   │   │   ├── email.channel.ts
│   │   │   │   ├── push.channel.ts
│   │   │   │   ├── whatsapp.channel.ts
│   │   │   │   └── sms.channel.ts          # Stub — logs only
│   │   │   └── templates/                  # Notification content per type
│   │   ├── media/
│   │   │   └── media.service.ts            # MediaService — all storage operations
│   │   ├── analytics/
│   │   │   └── analytics.service.ts        # analytics.track() PostHog helper
│   │   ├── audit/
│   │   │   └── audit.service.ts            # auditLog.record() helper
│   │   └── trust/
│   │       └── trust.service.ts            # TrustSafetyService.recordSignal()
│   │
│   ├── locales/                  # Translation files
│   │   ├── en/
│   │   │   ├── auth.json
│   │   │   ├── booking.json
│   │   │   ├── payments.json
│   │   │   ├── kyc.json
│   │   │   ├── notifications.json
│   │   │   └── ...               # One file per module
│   │   └── fr/
│   │       ├── auth.json
│   │       ├── booking.json
│   │       └── ...
│   │
│   ├── socket/
│   │   └── socket.ts             # Socket.io server setup, room management, auth
│   │
│   └── utils/
│       ├── AppError.util.ts
│       ├── appResponder.util.ts
│       ├── catchAsync.util.ts
│       ├── envCheck.util.ts       # Zod-validated env variables at startup
│       ├── pagination.util.ts
│       ├── slugify.util.ts
│       └── translate.util.ts
│
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── grafana/
│       ├── dashboards/           # Pre-built Grafana dashboard JSON files
│       └── provisioning/         # Grafana data source and dashboard provisioning
│
├── docker-compose.yml            # Development environment
├── docker-compose.prod.yml       # Production environment
├── .env.example                  # All environment variables documented with comments
├── .gitignore
├── .eslintrc.ts
├── jest.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## Scaffolding Plan

### How it works

The scaffolding generator is a TypeScript CLI script that reads a Prisma model and generates a complete module. You run it once per module and get all nine files pre-filled and ready for business logic.

### Command

```bash
npx ts-node cli/scaffold.ts <moduleName>
```

Examples:

```bash
npx ts-node cli/scaffold.ts booking
npx ts-node cli/scaffold.ts kyc
npx ts-node cli/scaffold.ts payments
```

### What the generator does step by step

1. Reads the module name from the command argument
2. Finds the corresponding Prisma model in `prisma/schema.prisma` using `@prisma/internals`
3. Extracts field names, types, and constraints from the model
4. Creates the module directory at `src/modules/{moduleName}/`
5. Generates all nine files from templates with the correct model name, field types, imports, and method stubs
6. Prints a checklist of manual steps to complete after generation

### Manual steps after scaffolding (printed by the generator)

```plain
Module "Booking" scaffolded successfully.

Next steps:
  1. Add route to src/modules/index.ts:
     import bookingRouter from './booking'
     app.use('/api/v1/bookings', protect, bookingRouter)

  2. Add import to cli/build-docs.ts:
     import '../src/modules/booking/booking.openapi'

  3. Run docs build to update OpenAPI spec:
     npm run docs:build

  4. Implement business logic in booking.service.ts

  5. Add translations to src/locales/en/booking.json
     and src/locales/fr/booking.json
```

### What each generated file contains

**{module}.schema.ts** Zod schemas derived from Prisma model fields. Create, Update, and Response schemas generated automatically. Fields marked optional in Prisma are optional in the Update schema. UUIDs, timestamps, and system fields are excluded from Create and Update schemas.

**{module}.types.ts** TypeScript types inferred from Zod schemas using `z.infer<>`. No manual type writing needed.

**{module}.repository.ts** Prisma CRUD operations typed with the generated types. `create`, `findById`, `findAll`, `update`, `delete` — all pre-written with the correct Prisma model name.

**{module}.service.ts** Business logic stubs that call the repository. `findById` throws `AppError('Not found', 404)` if the record does not exist. All other methods are stubs with TODO comments for the developer to fill in.

**{module}.controller.ts** Typed request handlers that call the service and return standardised responses via `appResponder`. All handlers are wrapped in `catchAsync`.

**{module}.route.ts** Express router with routes pre-wired to controller methods. `protect` middleware applied by default. `restrictTo` commented out per route for the developer to add the correct permission.

**{module}.openapi.ts** OpenAPI route registrations using `zod-to-openapi`. One registration per HTTP method. All required fields pre-filled from schema names. Summary and description fields have placeholder text for the developer to replace.

**{module}.test.ts** Jest test stubs for every service method. Each test has a describe block, a mock of the repository, and an `it` stub with a TODO comment. The developer fills in the assertions.

**index.ts** Barrel export of the router and service for use by other modules.

### npm scripts

```json
{
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "scaffold": "ts-node cli/scaffold.ts",
    "docs:build": "ts-node cli/build-docs.ts",
    "docs:watch": "nodemon --watch src --ext ts --exec npm run docs:build",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "db:migrate": "prisma migrate dev",
    "db:seed": "ts-node prisma/seed.ts",
    "db:studio": "prisma studio",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  }
}
```

