## Software Requirements Specification

**Product:** MENTORA **Version:** 1.0 **Status:** Draft: Modules 11 and 13 pending PM confirmation **Prepared by:** Izzy Tech Team **Client:** MENTORA E-Learning System **Date:** May 2026
### Table of Contents

1. Introduction
2. Overall Description
3. System Features (Modules 1 through 22)
4. External Interface Requirements
5. Non-Functional Requirements
6. Other Requirements
7. Appendices

---

### 1. Introduction

#### 1.1 Purpose

This Software Requirements Specification defines the complete functional and non-functional requirements for the MENTORA tutoring marketplace platform. It serves as the authoritative reference for all design, implementation, testing, and delivery decisions. Every feature in this document has a measurable acceptance criterion. If a requirement has no acceptance criterion it does not ship.

This document is intended for: the development team, the client, UI/UX designers, future developers joining the project, and any technical reviewer or recruiter evaluating the system.

#### 1.2 Scope

MENTORA is a web-based tutoring marketplace for Cameroon that connects parents and students with verified tutors for home and online tutoring sessions. The platform manages the full lifecycle of a tutoring relationship: tutor discovery, booking, payment via MTN Mobile Money and Orange Money, live sessions, lesson confirmation, escrow release, and post-session reviews.

The system is built for web browsers first with React Native mobile compatibility designed in from the start. It is hosted on a VPS with a containerised architecture that scales without code changes as the platform grows.

The following are explicitly out of scope for this version: AI tutor recommendations, school partnerships, subscription plans, mobile app (React Native app is future phase), multi-country support.

#### 1.3 Definitions and Abbreviations

| Term        | Definition                                                                      |
| ----------- | ------------------------------------------------------------------------------- |
| Parent      | A registered user who books tutors on behalf of their child                     |
| Student     | An independent learner who books tutors for themselves                          |
| Tutor       | A verified teacher or subject specialist who offers sessions                    |
| Admin       | A privileged platform operator who manages KYC, disputes, and payments          |
| Moderator   | A privileged operator who handles content moderation and Trust and Safety       |
| Super Admin | The highest privilege role with full platform access                            |
| KYC         | Know Your Customer: the identity and credential verification process for Tutors |
| Escrow      | Funds held by the platform between payment and lesson confirmation              |
| MoMo        | MTN Mobile Money                                                                |
| XAF         | Central African Franc : the currency of Cameroon                                |
| SLA         | Service Level Agreement: a committed response or resolution time                |
| RBAC        | Role-Based Access Control                                                       |
| DBML        | Database Markup Language used in dbdiagram.io                                   |
| VPS         | Virtual Private Server: the hosting infrastructure                              |
| FCM         | Firebase Cloud Messaging: used for push notifications                           |
| CDN         | Content Delivery Network: used for fast media delivery                          |
| ADR         | Architecture Decision Record: documents why a technical decision was made       |
| SRS         | Software Requirements Specification: this document                              |
| PRD         | Product Requirements Document: the client's original specification              |
| TOTP        | Time-based One-Time Password: used for two-factor authentication                |
| i18n        | Internationalisation: support for multiple languages                            |
| TDD         | Test Driven Development: tests written before implementation                    |

#### 1.4 References

- MENTORA Product Requirements Document v1.0 (client-provided)
- MENTORA Updated PRD v1.1 (client-provided, includes intro video and live tutoring)
- MENTORA Module Design Sessions (Izzy Tech Team internal, May 2026)
- Phase Guide: SRS to Production Backend (Izzy Tech Team internal)

#### 1.5 Overview

Section 2 describes the product context, user types, and constraints. Section 3 defines all 22 modules with measurable requirements. Section 4 covers external system interfaces. Section 5 covers non-functional requirements. Section 6 covers legal, compliance, and localisation requirements. Section 7 contains appendices including the module dependency map, tech stack ADRs, and open questions pending PM confirmation.

---

### 2. Overall Description

#### 2.1 Product Perspective

MENTORA addresses the Cameroonian informal tutoring market where most tutoring is arranged through WhatsApp and personal referrals, creating trust issues, payment disputes, and safety concerns for both parents and tutors. MENTORA formalises this market by providing a trusted intermediary that verifies tutor credentials, holds payments in escrow, and provides structured communication and session management.

The system is a standalone web platform with no dependency on existing external platforms beyond the third-party services listed in Section 4.

#### 2.2 Product Functions

At the highest level the system provides:

- Tutor identity and credential verification through a structured KYC pipeline
- Tutor discovery and search with composite ranking across seven signals
- Booking and scheduling management for one-on-one and group sessions
- Secure payment processing via MTN MoMo and Orange Money with escrow
- Live video sessions via LiveKit for online tutoring
- Post-session confirmation and dispute resolution tied to escrow release
- In-platform messaging with active content filtering to prevent off-platform bypass
- Two-way ratings and reviews
- Learning materials management for tutors to share content with students
- Learning analytics for parents, students, and tutors
- A comprehensive admin dashboard covering KYC, disputes, payments, user management, and platform configuration
- Platform observability for developers and product analytics for business decisions

#### 2.3 User Classes and Characteristics

**Guest**: unauthenticated visitor. Can browse tutor listings and public profiles. Cannot book, message, or access any personal data.

**Parent**: registers to book tutors for their children. Creates student profiles for each child. Manages bookings and payments. Primary paying customer of the platform.

**Student**: registers as an independent learner. Books tutors directly without a parent account. Has the same booking and payment capabilities as a Parent.

**Tutor**: registers and completes KYC before going live. Manages their profile, availability, materials, and bookings. Receives payouts after lesson confirmation.

**Moderator**: privileged operator. Handles Trust and Safety queue, content moderation, incident reports, and flagged messaging. Cannot access payment or KYC data.

**Admin**: privileged operator. Manages KYC queue, disputes, payouts, user management. Cannot change platform configuration or commission rates.

**Super Admin**: highest privilege. Full access to all platform functions including commission configuration, role management, feature flags, and platform settings. Maximum 2 accounts.

**Support Agent**: view any user account, booking history, payment history, and wallet balance. Respond to support tickets. Initiate manual payout retry for failed withdrawals. Escalate to Admin for account actions. Cannot approve KYC, cannot resolve disputes, cannot touch platform configuration.

#### 2.4 Operating Environment

**Frontend:** Next js web application. Mobile browser compatible. React Native mobile app.

**Backend:** Node.js with TypeScript. RESTful API with WebSocket support via Socket.io for real-time messaging and notifications.

**Database:** PostgreSQL. Migration-based schema management. Never modified directly in production.

**Cache:** Redis. Used for sessions, rate limiting, feature flag evaluation, search result caching, and background job coordination.

**Infrastructure:** VPS. Containerized via Docker from day one. Horizontal scaling via VPS upgrade or container orchestration when needed.

**Languages:** French and English supported from launch.

**Currency:** XAF (Central African Franc) exclusively.

#### 2.5 Design and Implementation Constraints

- No paid third-party APIs except: NotchPay?Fapshi/Tranzact (payments), Clerk (auth), Resend (email), LiveKit (video), WhatsApp Cloud API (notifications)
- All other infrastructure is self-hosted on the VPS: Post Hog, Grafana, Loki, Prometheus, Flag smith, Tolgee, ClamAV
- The platform launches in three cities: Buea, Douala, Yaoundé. City expansion is configuration-only, no deployment required
- All payments are in XAF via MTN MoMo and Orange Money only
- Timeline: 2.5 months from design completion to delivery
- The system must be usable on low-bandwidth connections common in Cameroon

#### 2.6 Assumptions and Dependencies

- NotchPay supports cross-operator payouts (MTN to Orange Money and vice versa): [PENDING PM CONFIRMATION payment questions batch 1 question 23]
- PM responses to all 30 payment questions (Modules 11 and 13) are received before implementation of those modules begins
- The client's Interserver storage account is accessible and S3-compatible
- WhatsApp Cloud API free tier (1,000 conversations/month) is sufficient for launch traffic
- Clerk free tier (10,000 MAU) is sufficient for launch traffic
- LiveKit self-hosted instance runs on the same VPS or a dedicated $10/month Hetzner VPS

## 3. System Features

Each requirement follows this structure:

**Requirement ID**: unique identifier in format `REQ-[MODULE NUMBER]-[REQUIREMENT NUMBER]`

**Requirement**:  what the system SHALL do

**Acceptance Criterion**: the measurable condition that confirms the requirement is met

**Progress**: implementation tracking

|Step|Meaning|
|---|---|
|DB|Migration written and reviewed|
|API|Endpoint defined in OpenAPI spec|
|Impl|Business logic complete|
|UT|Unit tests passing|
|IT|Integration tests passing|
|STG|Deployed to staging|
|PROD|Deployed to production|

Progress is tracked per requirement as:

`DB` `API` `Impl` `UT` `IT` `STG` `PROD`

Each box is ticked when complete. A module is production-ready when every requirement shows all seven boxes ticked and the module summary block is fully green.

---

### Module 1: Authorization & RBAC

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-001-001: Role definitions

The system SHALL define seven roles: Super Admin, Admin, Moderator, Tutor, Parent, Student, Support Agent. Roles are stored in the database and created via an idempotent seed script.

**Acceptance Criterion:** Running the seed script twice produces exactly six roles with no duplicates. Deleting a role and rerunning the seed restores it.

| DB  | API | Impl | UT  | IT  | STG | PROD |
| --- | --- | ---- | --- | --- | --- | ---- |
| [ ] | [ ] | [ ]  | [ ] | [ ] | [ ] | [ ]  |

---

#### REQ-001-002 — Single role per user

The system SHALL enforce that every user holds exactly one role at a time. A user cannot be assigned two roles simultaneously.

**Acceptance Criterion:** An API request attempting to assign a second role to a user that already has one returns 400. The database enforces this with a unique constraint on the user-role relationship.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-001-003: Permission-based access control

The system SHALL enforce access control using named permissions in dot notation (e.g. `kyc.approve`, `payments.release`) rather than role name checks in business logic. Every sensitive endpoint declares the permission required to access it.

**Acceptance Criterion:** A request to a permission-protected endpoint from a user whose role does not include that permission returns 403. Changing the permission set of a role in the database takes effect on the next request without a deployment.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-001-004: Custom role management

The system SHALL allow Super Admin to create, rename, modify, and delete custom roles through the admin dashboard without a code change or deployment.

**Acceptance Criterion:** Super Admin creates a new role via the API, assigns permissions to it, assigns it to a user, and that user can access endpoints matching those permissions. Deleting a role with assigned users returns 409.

| DB  | API | Impl | UT  | IT  | STG | PROD |
| --- | --- | ---- | --- | --- | --- | ---- |
| [ ] | [ ] | [ ]  | [ ] | [ ] | [ ] | [ ]  |

---

#### REQ-001-005: Direct permission overrides

The system SHALL allow Super Admin and Admin to grant or revoke individual permissions directly on a user account independent of their role, with an optional expiry timestamp.

**Acceptance Criterion:** A user with a direct permission grant can access an endpoint that their base role does not permit. After the expiry timestamp passes the override is automatically invalidated and the user loses that access without any manual action.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-001-006: Permission resolution order

The system SHALL resolve effective permissions as: role permissions plus active direct grants minus active direct revocations.

**Acceptance Criterion:** A user whose role includes `payments.release` but who has an active direct revocation for that permission is denied access to the payment release endpoint. A user whose role does not include `kyc.approve` but who has an active direct grant for it is permitted access.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

#### REQ-001-006.5: Seed Default Permissions for for initial system roles

The system SHALL have a data structure defining systems roles and their permissions and these permissions are associated to the role on start up,.

| DB  | API | Impl | UT  | IT  | STG | PROD |
| --- | --- | ---- | --- | --- | --- | ---- |
| [ ] | [ ] | [ ]  | [ ] | [ ] | [ ] | [ ]  |

---

#### REQ-001-007: Public registration role restriction

The system SHALL prevent public registration from producing Admin, Moderator, or Super Admin accounts. Any registration attempt with a privileged role is rejected.

**Acceptance Criterion:** A POST to the registration endpoint with role set to `admin` or `super_admin` returns 403. Only `tutor`, `parent`, and `student` are accepted through public registration.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-001-008: Super Admin provisioning

The system SHALL create the first Super Admin account via a one-time idempotent seed script with a temporary password that expires after first login. No more than 2 Super Admin accounts may exist simultaneously.

**Acceptance Criterion:** Running the seed script creates exactly one Super Admin account. Running it again does not create a duplicate. Attempting to create a third Super Admin via the API returns 409.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-001-009: Data scoping at query level

The system SHALL enforce data scoping at the database query level. A Tutor's queries never return another Tutor's records even if the endpoint is accessed directly with a manipulated request.

**Acceptance Criterion:** Authenticated as Tutor A, a GET request to a resource owned by Tutor B returns 403. The query log confirms the WHERE clause scoped to Tutor A's ID.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-001-010: Permission check failure logging

The system SHALL log every 403 response to the audit log with user ID, endpoint, required permission, and timestamp.

**Acceptance Criterion:** After a 403 response, the audit log contains an entry with the correct user ID, the endpoint path, and the permission that was missing. The entry is present within 1 second of the failed request.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-001-011: Permission cache with invalidation

The system SHALL cache resolved permissions per user session in Redis with a TTL of 5 minutes. The cache SHALL be invalidated immediately when a user's role or permission overrides change.

**Acceptance Criterion:** After a role change, the user's next request (within the same 5-minute window that would otherwise hit cache) reflects the new permissions. Cache invalidation completes within 500ms of the role change API call.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-001-012: Permission audit trail

The system SHALL write every role assignment change, permission modification, and override grant or revocation to the audit log.

**Acceptance Criterion:** Every permission-related change produces an audit log entry containing actor ID, action type, target user ID, before state, after state, and timestamp. Entries are present within 1 second of the action.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 2: Localization (i18n)

**Module Summary**

| Milestone                     | Status |
| ----------------------------- | ------ |
| All implementations complete  | [ ]    |
| All unit tests passing        | [ ]    |
| All integration tests passing | [ ]    |
| Load test passing             | [ ]    |
| Deployed to staging           | [ ]    |
| QA sign-off                   | [ ]    |
| Deployed to production        | [ ]    |
| Client demo completed         | [ ]    |

---

#### REQ-002-001: Supported languages

The system SHALL support English and French at launch. Adding a new language SHALL require only a Tolgee operation with no code change or deployment.

**Acceptance Criterion:** All API responses return translated content when the `Accept-Language: fr` header is sent. Adding a new language namespace in Tolgee and providing translations causes those translations to appear in API responses without a deployment.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-002-002: Locale detection

The system SHALL detect locale from the `Accept-Language` request header. Authenticated users with a preferred language set in their profile SHALL have that preference override the header.

**Acceptance Criterion:** A request with `Accept-Language: fr` returns French error messages. A request from an authenticated user with preferred language `en` returns English regardless of the header.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-002-003: Fallback chain

The system SHALL fall back to English when a translation key is missing in the requested language. When a key is missing in both languages the hardcoded fallback string in the `t()` call SHALL be served. A missing key SHALL never crash a request.

**Acceptance Criterion:** Requesting a key that exists only in English with `Accept-Language: fr` returns the English string. Requesting a key that exists in neither language returns the hardcoded fallback. The observability system receives a warning log entry for every missing key served in production.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-002-004: Module namespacing

The system SHALL organise translation keys by module namespace. Each module owns its own translation file (`auth.json`, `booking.json`, `payments.json` etc.). Keys SHALL use nested dot notation within each namespace.

**Acceptance Criterion:** All translation keys in the codebase follow the pattern `namespace.category.key`. A CI check fails if a key is found that does not follow this pattern.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-002-005: No hardcoded strings

The system SHALL contain no hardcoded user-facing strings in the codebase. All user-facing text SHALL reference a translation key via the `t('namespace.key', 'fallback')` helper.

**Acceptance Criterion:** A CI pipeline check scans all source files for hardcoded user-facing strings. Any commit introducing a hardcoded string fails the pipeline and is blocked from merging.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-002-006: Translatable content types

The system SHALL serve all of the following in the user's resolved locale: API error messages, API success messages, form validation errors, notification templates (in-app, push, WhatsApp), email templates, and admin-facing UI strings.

**Acceptance Criterion:** A payment failure triggered for a French-locale user returns the error message in French. A booking confirmation notification sent to a French-locale user contains French text across all channels.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-002-007: Pluralisation and formatting

The system SHALL handle plural forms via i18next plural rules. Dates SHALL be formatted as `DD/MM/YYYY` for French locale and `MM/DD/YYYY` for English locale. Currency amounts SHALL always display in XAF with locale-appropriate number formatting.

**Acceptance Criterion:** A count of 1 lesson displays "1 lesson" in English and "1 leçon" in French. A count of 2 displays "2 lessons" and "2 leçons". A date renders correctly for both locale formats. An amount of 10000 XAF displays with correct thousands separator per locale.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-002-008: New module translation requirement

The system SHALL reject any pull request that introduces a new module without a corresponding translation namespace containing both English and French keys for all user-facing strings in that module.

**Acceptance Criterion:** A CI check compares new translation key references in code against existing namespace files. A reference to a key with no corresponding entry in both `en` and `fr` namespace files fails the pipeline.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 3: Rate Limiting & API Security

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-003-001: Per-endpoint rate limiting

The system SHALL enforce rate limits per endpoint category stored in Redis. Limits SHALL be configurable by Super Admin without a code change.

|Category|Limit|
|---|---|
|Auth endpoints|5 requests per minute per IP|
|Search endpoints|30 requests per minute per authenticated user|
|Payment initiation|5 requests per minute per Parent|
|Messaging endpoints|60 requests per minute per authenticated user|
|General API|100 requests per minute per authenticated user|
|Public endpoints|60 requests per minute per IP|

**Acceptance Criterion:** Exceeding any limit returns HTTP 429 with a `Retry-After` header. The limit resets after the window expires. Rate limit state survives a server restart (stored in Redis, not in-memory).

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-003-002: Rate limit headers

The system SHALL include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers on every API response.

**Acceptance Criterion:** Every API response contains all three headers with accurate values. A client that self-throttles based on `X-RateLimit-Remaining` never receives a 429.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-003-003: Brute force protection on login

The system SHALL block an IP from the login endpoint for 15 minutes after 5 consecutive failed login attempts. After 10 consecutive failures against the same account regardless of IP, the account SHALL be locked for 30 minutes and the account owner notified.

**Acceptance Criterion:** The 6th failed login attempt from the same IP returns 429 with a `Retry-After` of 900 seconds. The account lock triggers after 10 failures from different IPs. The account owner receives an in-app and email notification within 30 seconds of the lock.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-003-004: OTP attempt limiting

The system SHALL invalidate an OTP token after 3 failed verification attempts and require the user to request a new token.

**Acceptance Criterion:** The 4th failed OTP attempt returns 400 with a translatable error indicating the token is invalid and a new one must be requested. The invalidated token cannot be used even if the correct code is subsequently submitted.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-003-005: Request payload validation

The system SHALL validate every request body for shape, field types, and field lengths before processing. Invalid requests SHALL return 400 with specific translatable field errors.

**Acceptance Criterion:** A request with a missing required field returns 400 with the field name and a translatable error message. A request with a field exceeding the maximum length returns 400. No invalid request reaches business logic.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-003-006: Payload size limits

The system SHALL cap standard endpoint request payload size at 10KB and structured data endpoints at 50KB. File upload endpoints are governed by Module 8 limits.

**Acceptance Criterion:** A POST request with a body exceeding the limit for that endpoint type returns 413 before any processing occurs.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-003-007: Security headers

The system SHALL include the following headers on all API responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `X-XSS-Protection`.

**Acceptance Criterion:** Every API response contains all four headers with correct values. An automated security header scan tool confirms all headers are present and correctly configured.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-003-008: CORS restriction

The system SHALL restrict CORS to the platform's own frontend origin. Wildcard origins SHALL never be permitted in production.

**Acceptance Criterion:** A request from an origin other than the configured frontend domain receives a CORS error. The `Access-Control-Allow-Origin` header in production never contains `*`.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-003-009: IP block management

The system SHALL allow Super Admin and Admin to manually block an IP address or IP range through the admin dashboard. Blocked IPs SHALL receive 403 on all endpoints.

**Acceptance Criterion:** An IP added to the block list via the admin dashboard receives 403 within 5 seconds on subsequent requests. Removing the IP from the block list restores normal access within 5 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-003-010: Abuse pattern detection

The system SHALL detect and flag sequential tutor profile requests from a single IP as a scraping attempt. The system SHALL flag a Parent initiating payment 3 or more times within 10 minutes without completing as a suspicious pattern.

**Acceptance Criterion:** Sequential requests to tutor profile endpoints in alphabetical or ID order from a single IP within 60 seconds triggers a Trust and Safety flag. Three incomplete payment initiations within 10 minutes from the same Parent triggers a Trust and Safety flag. Both flags appear in the Trust and Safety queue within 30 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 4: Feature Flags

**Module Summary**

| Milestone                     | Status |
| ----------------------------- | ------ |
| All implementations complete  | [ ]    |
| All unit tests passing        | [ ]    |
| All integration tests passing | [ ]    |
| Load test passing             | [ ]    |
| Deployed to staging           | [ ]    |
| QA sign-off                   | [ ]    |
| Deployed to production        | [ ]    |
| Client demo completed         | [ ]    |

---

#### REQ-004-001: Flag types

The system SHALL support three flag types: boolean (on/off for all users), percentage rollout (enabled for a defined percentage of users), and targeted (enabled for specific roles, user IDs, or cities).

**Acceptance Criterion:** A boolean flag toggled off returns `false` for all users. A 50% rollout flag returns `true` for approximately half of a 1000-user sample with no deterministic pattern. A targeted flag for city `Yaoundé` returns `true` only for users with that city on their profile.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-004-002: Flag evaluation performance

The system SHALL evaluate any flag within 5ms. Flag state SHALL be cached in Redis with a 60-second TTL. If Flagsmith is unreachable and the cache is empty, all flags SHALL default to OFF.

**Acceptance Criterion:** Flag evaluation under normal conditions completes within 5ms as measured by the observability system. With Flagsmith stopped and Redis cache cleared, all `isEnabled()` calls return `false` within 100ms.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-004-003: Flag management permissions

The system SHALL restrict flag creation and deletion to Super Admin. Admins SHALL be able to toggle existing flags but not create or delete them.

**Acceptance Criterion:** An Admin attempting to create a new flag via the API receives 403. An Admin toggling an existing flag receives 200. A Super Admin performing both operations receives 200.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-004-004: City allowlist flag

The system SHALL restrict Tutor registration and search results to approved cities via a configurable city allowlist flag. Tutors registering from outside the allowlist SHALL be waitlisted with a translatable message. Super Admin SHALL add cities through the platform configuration dashboard without a deployment.

**Acceptance Criterion:** At launch the allowlist contains Buea, Douala, and Yaoundé. A Tutor registering from Bafoussam receives a waitlist confirmation, not an account. Adding Bafoussam to the allowlist via the admin dashboard allows Tutors from that city to register within 60 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-004-005: Deployment integration

The system SHALL allow flag state changes to take effect within 60 seconds across all running instances without a deployment.

**Acceptance Criterion:** A flag toggled in Flagsmith UI is reflected in API responses within 60 seconds. No deployment or server restart is required.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-004-006: Flag code registry enforcement

The system SHALL reject any code that references an unregistered flag name. Every flag referenced in code SHALL exist in Flagsmith.

**Acceptance Criterion:** A CI check compares all `isEnabled('flag.name')` calls in the codebase against registered flags in Flagsmith. A reference to an unregistered flag name fails the pipeline.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-004-007: Flag audit trail

The system SHALL write every flag state change to the audit log with the acting Admin's user ID, the flag name, the previous state, the new state, and a timestamp.

**Acceptance Criterion:** After toggling a flag, the audit log contains an entry with all five required fields within 1 second of the toggle.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 5: Audit Logs

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-005-001: Audit log entry structure

The system SHALL record every sensitive action with the following fields: `event_type`, `actor_id`, `actor_role`, `target_id`, `target_type`, `before_state`, `after_state`, `ip_address`, `user_agent`, `timestamp`, `metadata`.

Important Event types: 
- Parent wallet top-up initiated and completed
- Parent wallet withdrawal initiated and completed
- Tutor wallet withdrawal initiated and completed
- Tutor payout account added or removed
- Commission mode changed by Super Admin
- Commission percentage changed by Super Admin
- Monthly fee amount changed by Super Admin
- Support ticket opened, responded to, escalated, and closed
- Manual payout retry initiated by Support Agent

**Acceptance Criterion:** Every sensitive action produces an audit log entry containing all eleven fields. A missing field on any entry fails the integration test for that action.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-005-002: Immutability

The system SHALL enforce that audit log entries are append-only. No UPDATE or DELETE operation SHALL exist on the audit log table at the application level. The database user the application connects with SHALL have no DELETE or UPDATE permission on the audit log table.

**Acceptance Criterion:** An attempt to call an update or delete operation on the audit log table via the application returns an error at the database permission level. No application code path exists that modifies or deletes audit log entries.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-005-003: Asynchronous writes

The system SHALL write audit log entries asynchronously. Audit log writes SHALL never block the main request from completing. A failed audit log write SHALL be retried and SHALL NOT cause the triggering action to fail or roll back.

**Acceptance Criterion:** With the audit log write artificially delayed by 2 seconds, the triggering API request completes within its normal response time. A simulated audit log write failure does not return an error to the client and the action completes successfully. The failure is visible in the observability system within 5 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-005-004: Retention and archival

The system SHALL retain audit log entries for a minimum of 2 years. Entries older than 2 years SHALL be archived to cold storage rather than deleted.

**Acceptance Criterion:** A background job running on schedule moves entries older than 2 years to the archive storage location. The archived entries remain queryable by Super Admin. No entry is permanently deleted.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-005-005: Access control

The system SHALL enforce role-based read access on audit logs. Super Admin reads all entries. Admin reads KYC, payment, dispute, and booking entries only. Moderator reads moderation entries only. Tutors and Parents read their own entries only. Students have no access.

**Acceptance Criterion:** An Admin requesting audit log entries for a role change event receives 403. A Tutor requesting audit log entries for a payment they were not party to receives 403. Each access level returns only the entries it is permitted to see.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-005-006: Export

The system SHALL allow Super Admin to export audit logs as CSV for any date range and event type filter. Every export operation SHALL itself be recorded in the audit log.

**Acceptance Criterion:** Super Admin exports a filtered audit log and receives a CSV file containing all matching entries. The export action produces a new audit log entry containing the exporter's ID, the filter parameters, and the timestamp.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Application Logging (Sub-module of Module 5)

---

#### REQ-005-007: Structured log format

The system SHALL output all logs as JSON objects containing: `level`, `module`, `event`, `requestId`, `userId`, `duration`, `error`, `timestamp`. No unstructured string logs SHALL exist in production code.

**Acceptance Criterion:** Every log entry in production is valid JSON containing all required fields. A CI lint check fails on any `console.log` or `console.error` found outside test files.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-005-008: Request ID tracing

The system SHALL assign a unique UUID `requestId` to every incoming API request at the middleware level before any business logic runs. This ID SHALL appear on every log entry generated during that request's lifecycle and SHALL be returned to the client in the `X-Request-ID` response header.

**Acceptance Criterion:** Every log entry produced during a single request shares the same `requestId`. The response contains the `X-Request-ID` header matching that ID. Filtering Grafana Loki by a specific `requestId` returns all and only the log entries for that request.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-005-009: Grafana Loki integration

The system SHALL ship all application logs to Grafana Loki via Promtail. Logs SHALL be searchable and filterable in Grafana by level, module, event, requestId, userId, and time range.

**Acceptance Criterion:** An error triggered in the payments module appears in Grafana Loki within 30 seconds. Filtering by `module=payments` and `level=error` returns only payment module errors. A query by `requestId` returns all entries for that request.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-005-010: Alerting rules

The system SHALL trigger alerts to the developer when: error rate exceeds 1% of requests in any 5-minute window, any payment-related error occurs, any external service returns 5xx more than 3 times in 1 minute, or the application process restarts unexpectedly.

**Acceptance Criterion:** Each alert condition when simulated in staging triggers a developer notification within 2 minutes. Alert delivery is confirmed via email or developer WhatsApp number.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-005-011: Silent catch prevention

The system SHALL ensure every caught error in a try/catch block produces a `logger.error()` call. Silent catch blocks with no logging SHALL fail code review and CI checks.

**Acceptance Criterion:** A CI static analysis check identifies try/catch blocks with empty or logging-free catch handlers and fails the pipeline. Zero silent catch blocks exist in the production codebase.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

#### REQ-001-006: Permission resolution order

The system SHALL resolve effective permissions as: role permissions plus active direct grants minus active direct revocations.

**Acceptance Criterion:** A user whose role includes `payments.release` but who has an active direct revocation for that permission is denied access to the payment release endpoint. A user whose role does not include `kyc.approve` but who has an active direct grant for it is permitted access.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

### Module 6: Authentication & Identity

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-006-001: Email and password registration

The system SHALL allow Guests to register as Parent, Student, or Tutor using email and password. Registration SHALL be rate limited at 5 attempts per IP per hour.

**Acceptance Criterion:** A valid registration request creates a user account in `unverified` state and sends a verification email within 30 seconds. A 6th registration attempt from the same IP within one hour returns 429.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-002: Google OAuth registration and login

The system SHALL allow Guests to register and log in as Parent, Student, or Tutor using Google OAuth via Clerk. Google OAuth accounts SHALL be created in `verified` state with no verification email sent.

**Acceptance Criterion:** A Guest completing Google OAuth for the first time has an account created in `verified` state. A returning user logging in with Google OAuth is matched by verified email to their existing account. No duplicate accounts are created for the same email.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-003: Facebook OAuth registration and login

The system SHALL allow Guests to register and log in as Parent, Student, or Tutor using Facebook OAuth via Clerk. Facebook OAuth accounts SHALL be created in `verified` state with no verification email sent.

**Acceptance Criterion:** A Guest completing Facebook OAuth for the first time has an account created in `verified` state. A returning user is matched to their existing account by verified email. No duplicate accounts are created.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-004: OAuth account linking

The system SHALL allow an existing email/password account to link a Google or Facebook OAuth provider in account settings. A linked provider SHALL be unlinkable only if the account has a password set or another OAuth provider linked.

**Acceptance Criterion:** Linking Google OAuth to an existing email/password account succeeds and the user can subsequently log in via Google. Attempting to unlink the only authentication method returns 400 with a translatable error. Linking an OAuth provider is recorded in the audit log.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-005: Privileged role OAuth restriction

The system SHALL prevent Admin, Moderator, Support Agent, and Super Admin accounts from logging in via OAuth. These roles SHALL only authenticate via email and password.

**Acceptance Criterion:** An OAuth login attempt matched to an account with a privileged role returns 403 with a translatable error. The same account logs in successfully via email and password.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-006: Email verification flow

The system SHALL send a verification email via Resend immediately on email/password registration. The verification token SHALL expire after 24 hours. Resend requests SHALL be limited to 3 per email address per hour.

**Acceptance Criterion:** A verification email is delivered within 30 seconds of registration. The token in the email is valid for exactly 24 hours. A 4th resend request within one hour returns 429 with no token issued.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-007: Unverified account restrictions

The system SHALL restrict unverified accounts from making bookings, submitting KYC, sending messages, or initiating payments. Unverified accounts SHALL be able to browse tutor listings and public profiles as a Guest would.

**Acceptance Criterion:** An unverified Parent attempting to initiate a booking receives 403 with a translatable message prompting email verification. The same account successfully retrieves tutor search results. Verification removes the restriction within 5 seconds of the verification link being clicked.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-008: Privileged account two-factor authentication

The system SHALL require TOTP two-factor authentication on every login for Admin, Moderator, and Super Admin accounts. A failed TOTP attempt SHALL lock the account after 3 consecutive failures and notify Super Admin.

**Acceptance Criterion:** An Admin who provides correct email/password but no TOTP code cannot complete login. The 4th failed TOTP attempt locks the account and Super Admin receives an in-app notification within 30 seconds. A locked account cannot be unlocked by the account owner — only by Super Admin.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-009: New device login alert

The system SHALL send a notification to a user's verified email when a successful login occurs from an unrecognised device or location.

**Acceptance Criterion:** A login from a new device fingerprint or IP significantly different from previous logins triggers an email notification to the account owner within 60 seconds. The notification contains the device type, approximate location, and timestamp.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-010: Session management

The system SHALL issue session tokens via Clerk. Session expiry SHALL be 7 days for Parent, Student, and Tutor on trusted devices and 8 hours for Admin, Moderator, and Super Admin regardless of device.

**Acceptance Criterion:** A Parent session token is valid for 7 days from issuance. An Admin session token expires after 8 hours. An expired token returns 401 on any authenticated endpoint.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-011: Active session management

The system SHALL allow users to view all active sessions showing device type, approximate location, and last active timestamp. Users SHALL be able to terminate any individual session or all sessions except the current one.

**Acceptance Criterion:** A user with two active sessions terminates one and the terminated session's token returns 401 within 5 seconds. The current session remains valid. Termination of a session is recorded in the audit log.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-012: Password reset flow

The system SHALL allow email/password users to request a password reset. Reset tokens SHALL expire after 1 hour and be single-use. Password reset requests SHALL be limited to 3 per email address per hour with excess requests silently accepted to prevent email enumeration.

**Acceptance Criterion:** A valid reset token allows a password change exactly once. Using the same token a second time returns 400. A reset token used after 1 hour returns 400. All existing sessions are invalidated within 5 seconds of a successful password reset.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-013: Password requirements

The system SHALL enforce a minimum password complexity of 8 characters with at least one uppercase letter, one lowercase letter, and one number.

**Acceptance Criterion:** A registration or password reset attempt with a password that fails any complexity rule returns 400 with a translatable error identifying which rule was violated.

| DB  | API | Impl | UT  | IT  | STG | PROD |
| --- | --- | ---- | --- | --- | --- | ---- |
| [ ] | [ ] | [ ]  | [ ] | [ ] | [ ] | [ ]  |
|     |     |      |     |     |     |      |

---

#### REQ-006-014: Account completion tracking

The system SHALL track a `completion_status` per account. Incomplete accounts SHALL be redirected to an onboarding checklist on login. Incomplete accounts SHALL be restricted from booking, messaging, submitting KYC, and initiating payments.

Completion criteria:

- Parent: verified email, full name, phone number, at least one student profile added
- Student: verified email, full name, phone number, current class/level, at least one subject of interest
- Tutor: verified email, full name, phone number, full profile submitted (bio, subjects, pricing, location, mode, photo)

**Acceptance Criterion:** A Parent with no student profile added attempting to initiate a booking receives 403 with a translatable message. Adding a student profile updates `completion_status` to complete within 5 seconds and the restriction is removed on the next request.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-015: Phone number collection and validation

The system SHALL collect phone number during account completion onboarding. Phone numbers SHALL be validated for Cameroonian format (+237 prefix, correct length) at input. Phone numbers SHALL be verified lazily at first payment transaction.

**Acceptance Criterion:** A phone number submitted without the +237 prefix or with incorrect length returns 400 with a translatable validation error. A correctly formatted number is accepted and stored. No SMS or OTP is sent at collection time.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-016: Account suspension

The system SHALL allow Admin or Super Admin to suspend any Parent, Student, or Tutor account. Suspended accounts SHALL be unable to log in and SHALL see a translatable suspension message with a support contact on login attempt.

**Acceptance Criterion:** Suspending an account causes all active sessions to be invalidated within 5 seconds. A login attempt by the suspended account returns 403 with the suspension message. Suspension is recorded in the audit log with the acting Admin's ID and mandatory reason.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-017: Account self-deactivation

The system SHALL allow users to deactivate their own account from account settings. Deactivated accounts SHALL enter a 30-day grace period after which personal data is anonymised but transaction records are retained for compliance.

**Acceptance Criterion:** A self-deactivated account is inaccessible within 5 seconds of deactivation. After 30 days a background job anonymises personal data fields. Transaction records for that account remain in the database with the anonymised user reference. The anonymisation job run is recorded in the audit log.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006-018: Super Admin provisioning

The system SHALL create the first Super Admin account via a one-time seed script. The seed script SHALL create the account with a temporary password that must be changed on first login. Super Admin SHALL complete TOTP setup before the temporary password change is accepted. The public registration endpoint SHALL reject any attempt to create a Super Admin account.

**Acceptance Criterion:** Running the seed script creates exactly one Super Admin account in a `requires_password_change` state. Logging in without changing the password blocks access to all endpoints except the change-password endpoint. A POST to the public registration endpoint with `role: super_admin` returns 403.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 6.5: Dashboards & Home Screens

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

_Note: Dashboard data requirements are defined here. Specific UI layout and component decisions are pending the UI team meeting. Additional endpoint requirements will be added to this module after that meeting._

---

#### REQ-006.5-001: Aggregated dashboard endpoint

The system SHALL serve each role's dashboard data from a single aggregated endpoint per role. The endpoint SHALL not require multiple sequential calls from the frontend to populate the dashboard.

**Acceptance Criterion:** A single GET request to the Parent dashboard endpoint returns all data required to render the full Parent dashboard in one response. Response time is under 500ms for p95 of requests under normal load.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006.5-002: Parent dashboard data

The system SHALL return the following data in the Parent dashboard response: upcoming bookings (tutor name, subject, date, time, mode, status), pending booking requests, active disputes with status, recent payment history (last 5 transactions), student profiles summary, unread message count, unread notification count.

**Acceptance Criterion:** All listed data fields are present in the response. Data is scoped to the requesting Parent — no other Parent's data is included. Upcoming bookings are sorted by date ascending.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006.5-003: Student dashboard data

The system SHALL return the following data in the Student dashboard response: upcoming lessons (tutor name, subject, date, time), recently uploaded materials from tutors, past sessions with ratings given, unread message count, unread notification count.

**Acceptance Criterion:** All listed data fields are present and scoped to the requesting Student. Materials are sorted by upload date descending. Past sessions are sorted by date descending.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006.5-004: Tutor dashboard data

The system SHALL return the following data in the Tutor dashboard response: pending booking requests with accept/reject actions, upcoming confirmed sessions, earnings summary (this month total, pending in escrow, total paid out), next payout details, KYC status, profile completion percentage, last 3 reviews received, unread message count, unread notification count.

**Acceptance Criterion:** All listed data fields are present and scoped to the requesting Tutor. Pending booking requests are sorted by request date ascending. Earnings figures are accurate to the last completed transaction.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006.5-005: Admin dashboard data

The system SHALL return the following data in the Admin dashboard response: KYC queue count and oldest application age, open disputes count and oldest unresolved age, flagged accounts by risk state, platform revenue today and this month, total escrow balance, pending payouts count, new registrations today by role, last 10 audit log entries, system health summary.

**Acceptance Criterion:** All listed data fields are present. Revenue and escrow figures match the payment ledger exactly. System health summary reflects the current observability state.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006.5-006: Real-time updates

The system SHALL deliver real-time updates via WebSocket for: new booking requests, new messages, dispute status changes, and payout releases. Dashboard counts SHALL update without a page refresh.

**Acceptance Criterion:** A new booking request sent to a Tutor causes the pending requests count on their dashboard to increment within 2 seconds without a page refresh. A new message updates the unread count within 2 seconds. WebSocket reconnection after a dropped connection restores updates automatically.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-006.5-007: Onboarding checklist screen

The system SHALL display an onboarding checklist screen to any account that is not yet complete instead of the full dashboard. Each incomplete item SHALL be tappable and navigate directly to the relevant form. A progress percentage SHALL be displayed.

**Acceptance Criterion:** A newly registered Parent with no student profile sees the checklist screen on login. Clicking the student profile checklist item navigates to the student profile creation form. Completing all items causes the checklist to be replaced by the full dashboard on the next login. Progress percentage updates within 5 seconds of completing a step.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 7: User Profiles

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-007-001: Public tutor profile endpoint

The system SHALL serve a public Tutor profile endpoint that returns only publicly visible fields: first name and last name initial, profile photo URL, bio, approved subjects and levels with verified badges, experience, teaching mode, city and neighbourhood, languages, rate, Bayesian rating, review count, intro video URL, availability calendar, verified badge status, completed sessions count, response rate, and member since date.

**Acceptance Criterion:** The public profile endpoint response contains no private fields — phone number, email, exact address, full last name, payout account, earnings data are absent even as null values. A Guest, authenticated Parent, and authenticated Tutor all receive identical responses from this endpoint for the same Tutor profile.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-007-002: Contact detail visibility after confirmed paid booking

The system SHALL make a Tutor's phone number, WhatsApp number, and exact address visible only to a Parent or Student who has a confirmed and paid booking with that specific Tutor. Email SHALL remain hidden permanently regardless of booking status.

**Acceptance Criterion:** A Parent with no booking with Tutor A cannot retrieve Tutor A's phone number or address via any API endpoint. After a confirmed paid booking exists, the same Parent can retrieve those fields. Email is absent from all API responses regardless of booking status.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-007-003: Subject and credential system

The system SHALL enforce that every subject displayed on a Tutor's public profile has at least one Admin-approved credential backing it. Subjects without an approved credential SHALL not appear on the public profile. If an approved credential is revoked, all subjects backed solely by that credential SHALL be removed from the public profile within 5 seconds.

**Acceptance Criterion:** A Tutor with a pending Physics credential does not show Physics on their public profile. After Admin approves the Physics credential, Physics appears on the public profile within 5 seconds. Revoking the credential removes Physics from the public profile within 5 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-007-004: Credential submission form

The system SHALL require Tutors to submit a structured credential form alongside each document upload. The form SHALL collect: institution name, qualification type, field of study, grade/classification, year awarded, and subjects covered (multi-select from the subject taxonomy). The document is proof — the form fields are the data the system works with.

**Acceptance Criterion:** A subject request submitted without a linked credential form is rejected with 400. A subject request with a complete form and valid document upload creates a pending subject verification entry in the Admin queue within 5 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-007-005: Confidence scoring for subject requests

The system SHALL calculate a confidence score (0 to 100%) for every new subject request based on the Tutor's existing approved credentials and the subject taxonomy. The score and a one-sentence plain English explanation SHALL be visible to Admin in the KYC queue.

**Acceptance Criterion:** A subject request for O-Level Physics from a Tutor with an approved BSc Physics credential scores 95% or above. A subject request for O-Level Computer Science from the same Tutor scores between 50% and 70%. The explanation sentence accurately describes the reasoning. Scores and explanations are absent from all non-Admin API responses.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-007-006: Admin-trained inference

The system SHALL prompt Admin after approving a below-threshold subject request: "Should future Tutors with this credential type be eligible for this subject? If yes, what confidence score should this relationship carry?" Admin's response SHALL create a new relationship entry in the subject relationship table.

**Acceptance Criterion:** After Admin approves a 40% confidence subject request and sets a relationship, the next Tutor with the same credential type requesting the same subject receives the Admin-configured confidence score. The relationship entry is visible to Super Admin in the platform configuration dashboard. The creation is recorded in the audit log.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-007-007: Subject taxonomy management

The system SHALL maintain a configurable subject taxonomy defining academic domains and which subjects belong to each domain. Super Admin SHALL manage the taxonomy through the admin dashboard without a code change or deployment.

**Acceptance Criterion:** Super Admin adds a new subject to the Science domain via the admin dashboard. The next subject request involving that subject uses the updated taxonomy for confidence scoring within 60 seconds. Taxonomy changes are versioned and the change is recorded in the audit log.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-007-008: Parent profile and student profiles

The system SHALL allow Parents to create and manage multiple student profiles. Each student profile SHALL contain: student first name, current class/level, school type, subjects needing help, exam or goal if applicable, preferred mode, preferred language of instruction, and optional special notes. A student profile with an active or pending booking SHALL not be deletable.

**Acceptance Criterion:** A Parent creates two student profiles and both are returned in the Parent's profile response. Attempting to delete a student profile with an active booking returns 409 with a translatable error. Deleting a student profile with no active bookings succeeds and the profile is removed from subsequent responses.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-007-009: Tutor profile completion percentage

The system SHALL calculate a Tutor's profile completion percentage and return it in the private profile response. A Tutor profile below 100% completion SHALL be blocked from KYC submission.

Required fields for 100%: full name, photo, bio, at least one approved subject, at least one level, teaching mode, city, rate, at least one availability slot set, intro video.

**Acceptance Criterion:** A Tutor missing an intro video has a completion percentage below 100%. Attempting to submit KYC with a sub-100% profile returns 400 with a translatable error listing the missing fields. Adding all required fields brings completion to 100% and KYC submission succeeds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-007-010: Post-KYC profile edit restrictions

The system SHALL prevent a Tutor from editing their full legal name or uploaded KYC documents after KYC approval without triggering a re-verification. Admin SHALL be notified of any such edit attempt.

**Acceptance Criterion:** A Tutor with `active` KYC status attempting to change their full name via the API receives 400 with a translatable message explaining re-verification is required. Admin receives an in-app notification within 30 seconds of the attempt. The Tutor's KYC status moves to `pending_reverification`.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-007-011: Tutor browsing restriction

The system SHALL serve Guest-level data to authenticated Tutors browsing other Tutor profiles. A Tutor SHALL see exactly what a Guest sees on any other Tutor's profile — no additional data exposed due to being authenticated.

**Acceptance Criterion:** An authenticated Tutor requesting another Tutor's profile receives the same response as an unauthenticated Guest for that profile. No private fields are present. The Tutor cannot initiate a booking from this view.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 8: Media Management & CDN

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-008-001: MediaService abstraction

The system SHALL route all storage operations through a central `MediaService`. No module in the codebase SHALL interact with Interserver storage or the AWS SDK directly outside of `MediaService`.

**Acceptance Criterion:** A CI check confirms no AWS SDK imports exist outside the MediaService file. All file operations in other modules call `MediaService` methods exclusively.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008-002: Upload flow by file size

The system SHALL use server-side upload for files under 10MB and presigned upload for files over 10MB. Large file uploads SHALL bypass the VPS entirely — the client uploads directly to Interserver using a presigned PUT URL.

**Acceptance Criterion:** A 5MB profile photo upload goes through the API server. A 150MB video upload uses a presigned URL returned by the API. The VPS logs confirm no large file bytes transit through the application server during presigned uploads.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008-003: File type and size limits

The system SHALL enforce the following limits server-side before any processing begins:

|File Type|Max Size|Accepted Formats|
|---|---|---|
|Profile photos|5MB|JPEG, PNG, WEBP|
|KYC documents|10MB|PDF, JPEG, PNG|
|Lesson notes|50MB|PDF|
|Audio files|100MB|MP3, M4A, WAV|
|Intro videos|200MB|MP4, MOV|
|Pre-recorded lesson videos|2GB|MP4, MOV|

MIME type SHALL be validated from file content, not from the file extension or Content-Type header.

**Acceptance Criterion:** A file exceeding the size limit for its type returns 413 before any bytes are stored. A file with a `.pdf` extension but JPEG content returns 400. All limit values are configurable by Super Admin without a code change.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008-004: Virus scanning

The system SHALL scan every uploaded file with ClamAV before it becomes accessible. Files that fail the scan SHALL be quarantined. Quarantined files SHALL never be served to any user. ClamAV virus definitions SHALL update daily.

**Acceptance Criterion:** A file containing the EICAR test string is uploaded and quarantined. A quarantine event appears in the observability system and audit log within 30 seconds. The quarantined file returns 404 when any user attempts to access it. The uploader receives a generic error with no technical details about the scan.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008-005: File processing pipeline

The system SHALL process files asynchronously after upload. Profile photos SHALL be resized to maximum 800x800px and compressed. Videos SHALL be transcoded to web-optimised MP4 with two quality variants: 720p and 360p. PDFs SHALL be validated and page count recorded. A file SHALL NOT be accessible until processing completes successfully.

**Acceptance Criterion:** A profile photo uploaded at 4000x3000px is stored at 800x800px or smaller. A video upload produces two variants accessible at different quality endpoints. Attempting to access a file with status `processing` returns 202 with a `status: processing` response. A failed processing job moves the file to `failed` status and notifies the uploader.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008-006: Signed URL generation

The system SHALL serve all file reads through `MediaService.getFileUrl()` which validates permissions and generates a signed URL. Signed URLs for documents and images SHALL expire after 15 minutes. Signed URLs for audio and video streaming SHALL expire after 2 hours. Raw storage URLs SHALL never be returned to clients.

**Acceptance Criterion:** A signed URL for a document expires exactly 15 minutes after generation and returns 403 on access after expiry. A raw storage URL for any file returns 403. A new signed URL requested after expiry is successfully generated for an authorised user.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008-007: File permission rules

The system SHALL enforce the following access rules on file reads:

|File Type|Access|
|---|---|
|Profile photos|Anyone including Guests|
|Intro videos|Anyone including Guests|
|KYC documents|Uploading Tutor and Admin/Super Admin only|
|Booking materials|Tutor who uploaded and Parent/Student with confirmed paid booking|
|Profile materials|Parent/Student with any confirmed paid booking with that Tutor|

**Acceptance Criterion:** A Guest successfully retrieves a Tutor's profile photo. An authenticated Parent with no booking with Tutor A receives 403 when requesting Tutor A's KYC document. The same Parent with a confirmed paid booking with Tutor A successfully retrieves a lesson material uploaded for that booking.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008-008: Soft delete and retention

The system SHALL soft-delete files by marking the database record as deleted and making the file inaccessible. Soft-deleted files SHALL be retained for 30 days before hard deletion. A file tied to an active dispute SHALL NOT be soft-deletable until the dispute is resolved.

**Acceptance Criterion:** Soft-deleting a file makes it return 404 within 5 seconds. The file bytes remain in storage. A hard deletion background job runs daily and permanently removes files where `soft_deleted_at` is older than 30 days. Attempting to delete a file tied to an active dispute returns 409.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008-009: Storage quotas

The system SHALL enforce a per-Tutor storage quota configurable by Super Admin. Uploads that would exceed the quota SHALL be rejected before processing begins. Tutors SHALL see their current usage and remaining quota in their profile settings.

**Acceptance Criterion:** A Tutor at 95% of their quota receives a warning in their profile. A Tutor at 100% of their quota receives 400 on any upload attempt with a translatable error. Super Admin adjusting a Tutor's quota takes effect within 60 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 8.5: Learning Materials

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-008.5-001: Content hierarchy

The system SHALL organise Tutor materials in a three-level hierarchy: Collection, Section, and Material. A Collection is tagged to one subject and one level. Sections within a Collection are optional. Materials belong to either a Section or directly to a Collection.

**Acceptance Criterion:** A Tutor creates a Collection tagged to Physics A-Level, adds two Sections, and adds Materials to each Section. The hierarchy is returned correctly structured in the API response. A Collection created without Sections accepts Materials directly.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008.5-002: Material types

The system SHALL support the following material types: PDF documents, audio files, video files, images, and written notes created via the in-app rich text editor. All uploaded file types are stored and served via Module 8.

**Acceptance Criterion:** A Tutor successfully creates one material of each supported type. Each is accessible to an authorised student. A written note created via the editor is stored as structured JSON and renders correctly for the student.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008.5-003: In-app rich text editor

The system SHALL provide a TipTap-based rich text editor supporting: headings H1 to H4, bold, italic, underline, bullet lists, numbered lists, tables, image embedding, code blocks, and mathematical equations via KaTeX.

**Acceptance Criterion:** A Tutor creates a written note containing a heading, a KaTeX equation, and a table. The note renders correctly in the student view with all formatting preserved. The stored JSON passes sanitisation validation on both save and render.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008.5-004: Booking-based access

The system SHALL grant a Student or Parent access to all of a Tutor's Collections for a given subject automatically when a confirmed paid booking exists between them for that subject. Access SHALL be granted within 5 seconds of booking confirmation. Access SHALL persist permanently regardless of future booking status.

**Acceptance Criterion:** A Parent with a confirmed paid Physics booking with Tutor A can access all of Tutor A's Physics Collections. The same Parent cannot access Tutor A's Mathematics Collections. Access is present within 5 seconds of the booking being confirmed. Cancelling a future booking does not remove previously granted access.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008.5-005: Group session material access

The system SHALL grant material access to all confirmed participants of a group booking simultaneously using the same rules as one-on-one booking access.

**Acceptance Criterion:** Three students confirmed in a group Physics booking all gain access to the Tutor's Physics Collections within 5 seconds of booking confirmation. A student who was not confirmed in the booking cannot access the materials.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008.5-006: Free preview materials

The system SHALL allow Tutors to mark individual materials or entire sections as free preview. Free preview materials SHALL be accessible to any Guest, Parent, or Student browsing the Tutor's profile without a booking.

**Acceptance Criterion:** A Guest can access a material marked as free preview. A Guest cannot access a material not marked as free preview. Changing a material's preview status takes effect within 5 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008.5-007: Downloadability toggles

The system SHALL enforce Admin-configurable downloadability per content type. When a content type is set to in-app only, no download URL or direct file access SHALL be available. Default settings at launch: PDFs downloadable, audio downloadable, images downloadable, video in-app streaming only, written notes printable only.

**Acceptance Criterion:** With videos set to in-app only, a request for a video download URL returns 403. Changing the video toggle to downloadable via the admin dashboard allows download URL generation within 60 seconds. Toggle changes apply platform-wide immediately.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008.5-008: Lesson plans

The system SHALL allow Tutors to create a lesson plan for each Collection as an ordered list of topics, each with a title and optional description. Lesson plans SHALL be visible on the Tutor's public profile before a student books. A lesson plan SHALL be publishable before all materials are uploaded.

**Acceptance Criterion:** A Guest viewing a Tutor's public profile can see the lesson plan topics for a Collection. Topics without linked materials are marked "coming soon." Reordering topics is reflected in the public profile within 5 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008.5-009: Session recordings (flag-gated)

The system SHALL record all LiveKit sessions when the `live_sessions.recordings` feature flag is enabled. Recordings SHALL be stored via Module 8 and accessible to both parties in the booking detail view. When the flag is disabled no recordings are surfaced to users.

**Acceptance Criterion:** With the flag enabled, a completed session produces a recording file accessible to both the Tutor and the Parent/Student. With the flag disabled, no recording links appear in any API response. LiveKit is configured to record from day one regardless of flag state.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-008.5-010: Admin moderation of materials

The system SHALL allow Admin and Moderator to view, remove, or suspend any Collection on the platform for policy violations. Removed materials SHALL be soft-deleted with a translatable reason sent to the Tutor. Three material removals against the same Tutor SHALL trigger an automatic Trust and Safety flag.

**Acceptance Criterion:** Admin removes a material. It becomes inaccessible to students within 5 seconds. The Tutor receives an in-app notification with the removal reason within 30 seconds. After 3 removals for the same Tutor, a Trust and Safety flag appears in the queue within 30 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

### Module 9: Tutor Onboarding & KYC

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-009-001 — KYC submission prerequisite

The system SHALL prevent a Tutor from accessing the KYC submission flow until their profile is 100% complete. An incomplete profile SHALL redirect to the profile completion checklist with a translatable explanation.

**Acceptance Criterion:** A Tutor with 80% profile completion attempting to access the KYC submission endpoint receives 400 with a translatable message listing missing fields. A Tutor with 100% profile completion successfully accesses the KYC flow.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-002 — Multi-step form with saved progress

The system SHALL save KYC submission progress automatically at each step. A Tutor who closes the browser mid-submission SHALL resume from where they left off on next login. A Tutor SHALL only have one active KYC application at a time.

**Acceptance Criterion:** A Tutor completes Step 1 and closes the browser. On next login the KYC form opens at Step 2 with Step 1 data pre-populated. Submitting a new KYC application while one is pending returns 409.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-003 — Step 1: CNI identity verification

The system SHALL require Tutors to declare their document type (real CNI card or temporary récépissé) before uploading. For both types the system SHALL require: front photo, back photo, selfie holding the document, and typed CNI number. All uploads are image only (JPEG/PNG, max 5MB each). The CNI number SHALL be validated for Cameroonian format.

**Acceptance Criterion:** A submission attempt without all three photos and the CNI number returns 400 listing the missing fields. A CNI number in an invalid format returns 400 with a translatable validation error. All three images are stored via Module 8 and accessible only to the Tutor and Admin/Super Admin.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-004 — Step 2: Background information

The system SHALL collect the following structured biographical data in Step 2: full legal name (must match CNI), date of birth, gender, current full address (street, neighbourhood, city, region), city of origin, region of origin, emergency contact name and phone number, and optional self-declaration statement (max 500 characters). All fields except the self-declaration statement are required.

**Acceptance Criterion:** A Step 2 submission missing any required field returns 400 with the missing field names. Background information is stored and accessible only to Admin and Super Admin. It is never returned in any public-facing API response.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-005 — Step 3: Credential and subject submission

The system SHALL require at least one credential with at least one subject tagged before Step 3 can be completed. Each credential entry SHALL collect: institution name, qualification type (dropdown), field of study, grade/classification, year awarded, subjects covered (multi-select from taxonomy), and supporting document (PDF or JPEG/PNG, max 10MB). A CV upload is optional (PDF only, max 10MB).

**Acceptance Criterion:** A Step 3 submission with no credential entries returns 400. A credential entry missing any required field returns 400 listing the missing fields. A credential with an unsupported document format returns 415. A valid submission creates pending subject verification entries for each tagged subject within 5 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-006 — Step 4: Review and final submission

The system SHALL show a full summary of all submitted data before final submission. A declaration checkbox confirming accuracy and truthfulness SHALL be required. After submission the KYC form SHALL become read-only. The Tutor SHALL receive a confirmation notification with the expected review timeline.

**Acceptance Criterion:** Final submission without the declaration checkbox checked returns 400. After successful submission KYC status moves to `pending` within 5 seconds. The Tutor receives an in-app and email notification within 30 seconds containing the expected review timeline. The KYC form returns read-only data for all subsequent GET requests until a rejection is issued.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-007 — KYC status lifecycle

The system SHALL enforce the following KYC status states and transitions: `incomplete`, `pending`, `identity_approved`, `active`, `rejected`, `suspended`, `banned`. A Tutor's public profile SHALL only be visible when status is `active`. Status changes to `active` or `suspended` SHALL take effect within 5 seconds.

**Acceptance Criterion:** A Tutor with `pending` status does not appear in search results. A Tutor moving to `active` status appears in search results within 5 seconds. A Tutor moving to `suspended` status disappears from search results within 5 seconds. Every status transition is recorded in the audit log with the acting Admin's ID and timestamp.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-008 — Subject verification status

The system SHALL track an independent verification status for each subject on a Tutor's profile: `pending`, `approved`, `rejected`. Overall KYC status reaching `active` SHALL require at least one subject reaching `approved`. Rejection of one subject SHALL never affect other approved subjects.

**Acceptance Criterion:** A Tutor with identity approved and one subject approved has `active` KYC status and that subject appears on their public profile. Rejecting a second pending subject does not change the status of the first approved subject. The rejected subject disappears from the public profile within 5 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-009 — Confidence scoring in admin queue

The system SHALL calculate a confidence score (0 to 100%) for every subject request and display it with a one-sentence plain English explanation in the Admin KYC queue. The queue SHALL be sorted into three sections: System Recommends Approve, System Recommends Review, and New Documentation Required.

**Acceptance Criterion:** Every subject request in the Admin queue displays a confidence score and explanation. The queue sections correctly categorise requests based on score thresholds. Confidence scores are absent from all non-Admin API responses.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-010 — Mandatory Admin review checklist

The system SHALL disable the approve button for the first 60 seconds after an Admin opens a KYC application. The approve button SHALL remain disabled until the Admin completes a mandatory checklist: CNI number matches document, selfie matches CNI photo, document type matches declaration, degree certificate matches declared field of study, declared subjects are supported by submitted credentials.

**Acceptance Criterion:** The approve endpoint returns 400 if called before 60 seconds have elapsed since the application was opened. The approve endpoint returns 400 if the checklist is not fully completed regardless of what the frontend sends. Both conditions are enforced server-side.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-011 — Rejection flow

The system SHALL require Admin to flag at least one specific item with a reason when rejecting a KYC application. The Tutor SHALL receive an in-app and email notification with the flagged items, reasons, and an optional Admin message. On resubmission the form SHALL be pre-populated with all previously submitted data with flagged fields highlighted.

**Acceptance Criterion:** A rejection attempt with no flagged items returns 400. The Tutor receives a notification within 30 seconds of rejection containing all flagged items and reasons. On resubmission the flagged fields are visually distinguished in the form response. Resubmission creates a new version of the application — the previous version remains accessible to Admin.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-012 — Permanent ban from KYC

The system SHALL allow Admin to permanently ban a Tutor from submitting KYC at any point. A ban SHALL require a mandatory written reason. A banned account SHALL receive a translatable notification and SHALL be unable to access the KYC submission flow.

**Acceptance Criterion:** A ban issued without a written reason returns 400. A banned Tutor attempting to access the KYC submission endpoint receives 403 with a translatable message. The ban is recorded in the audit log with the Admin's ID, reason, and timestamp.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-013 — Suspension flow

The system SHALL allow Admin to suspend a previously `active` Tutor. Suspension SHALL require a mandatory reason. On suspension the Tutor's profile SHALL be hidden from all public pages within 5 seconds, all pending booking requests SHALL be automatically cancelled with notifications to affected Parents, and all active bookings with confirmed payments SHALL be flagged for Admin manual handling.

**Acceptance Criterion:** A suspension without a mandatory reason returns 400. A suspended Tutor's profile does not appear in search results within 5 seconds. Pending booking requests for the suspended Tutor receive automatic cancellation notifications within 30 seconds. Active paid bookings appear in the Admin flagged bookings queue within 5 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-014 — SLA and escalation

The system SHALL notify Tutors at 48 hours if their application has not been reviewed. The system SHALL escalate applications to Super Admin at 5 business days without Admin action. Both thresholds SHALL be configurable by Super Admin. SLA compliance rate SHALL be visible in the analytics dashboard.

**Acceptance Criterion:** A Tutor application untouched for 48 hours triggers an in-app and email notification to the Tutor within 30 minutes of the threshold passing. An application untouched for 5 business days appears in a prominently flagged escalation section of the Admin KYC queue and Super Admin receives an in-app notification within 30 minutes.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-015 — Anti-lazy-admin governance

The system SHALL record in the audit log for every KYC approval: which Admin approved, how long they spent on the review page in seconds, and whether the mandatory checklist was completed. Approvals where review time was under 90 seconds SHALL be automatically flagged for Super Admin spot check review.

**Acceptance Criterion:** An approval submitted within 90 seconds of opening the application (even if the 60-second disable period was served) appears in the Super Admin spot check queue within 5 minutes. The audit log entry for the approval contains review duration in seconds. Super Admin can filter approvals by review duration in the audit log viewer.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-009-016 — Additional subject flow post-approval

The system SHALL provide a separate lighter flow for Tutors to add subjects after initial KYC approval. Additional subject requests SHALL go into a dedicated queue in the Admin dashboard separate from the full KYC queue. Approval or rejection of additional subjects SHALL NOT affect the Tutor's `active` status.

**Acceptance Criterion:** An `active` Tutor submitting a new subject request does not change their KYC status. The request appears in the additional subject queue in the Admin dashboard within 5 seconds. Rejecting the additional subject request leaves the Tutor's existing approved subjects and `active` status unchanged.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 10 — Tutor Discovery & Search

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-010-001 — Search accessibility

The system SHALL make tutor search accessible to Guests, Parents, Students, and Tutors from the platform homepage without login. Tutors browsing search SHALL see exactly what a Guest sees with no additional data exposed.

**Acceptance Criterion:** A GET request to the search endpoint with no authentication token returns tutor listings with public fields only. An authenticated Tutor making the same request receives an identical response to an unauthenticated Guest for the same query.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-010-002 — Search query matching

The system SHALL match search queries against tutor first name, subjects taught, levels covered, city, neighbourhood, languages taught, and bio text. Search SHALL be case-insensitive, accent-insensitive, and support partial matches. French and English subject name equivalents SHALL return the same results.

**Acceptance Criterion:** Searching "phy" returns tutors with Physics as an approved subject. Searching "Physique" returns the same results as "Physics". Searching "jean" returns tutors whose first name starts with Jean. A search with no query returns featured tutors for the user's city.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-010-003 — Search filters

The system SHALL support the following optional filters: subject, level, city, mode (home/online/both), price range (min and max XAF), language of instruction, availability (date range or quick options), and gender. Active filters SHALL be reflected in the response metadata. Filter state SHALL be preserved in the URL query parameters.

**Acceptance Criterion:** A search with filter `mode=online` returns only tutors offering online sessions. A search with `price_max=5000` returns only tutors with a rate at or below 5,000 XAF. Combining two filters returns only tutors matching both. The response metadata contains the active filters applied.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-010-004 — Composite ranking algorithm

The system SHALL rank search results using a pre-computed composite score with the following configurable weighted signals: subject match quality (25%), availability match (25%), Bayesian rating (20%), response rate (10%), profile completeness (10%), proximity (5%, home tutoring only), and activity recency (5%). All weights SHALL be configurable by Super Admin without a code change.

**Acceptance Criterion:** A tutor with a direct credential match for the searched subject ranks above one with an inferred match, all other signals equal. Changing the subject match weight via the admin dashboard takes effect on the next search result computation without a deployment. Proximity weighting is zero for searches with mode set to online.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-010-005 — Bayesian rating calculation

The system SHALL calculate tutor ratings using a Bayesian average formula: `(C × m + Σr) / (C + n)` where C is the minimum review count threshold (default 5), m is the platform average rating, n is the tutor's review count, and Σr is the sum of the tutor's ratings. The Bayesian rating SHALL be recalculated on every new review submission.

**Acceptance Criterion:** A tutor with 1 five-star review has a Bayesian rating lower than a tutor with 47 reviews averaging 4.5 stars. The rating recalculates within 5 seconds of a new review submission. The minimum review count threshold is configurable by Super Admin.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-010-006 — New tutor boost

The system SHALL apply a temporary score boost to tutors who have been `active` for less than 30 days or have fewer than 5 completed sessions. The boost SHALL expire automatically after 30 days or 5 completed sessions whichever comes first. Boosted tutors SHALL display a "New" badge on their result card.

**Acceptance Criterion:** A newly approved tutor appears in the middle of results rather than the bottom. The boost expires within 5 seconds of the tutor completing their 5th session. After expiry the tutor's position in results reflects only their real composite score. The boost amount is configurable by Super Admin.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-010-007 — Search result card data

The system SHALL return the following fields for each result card: first name and last name initial, verified badge, new badge (if applicable), Bayesian rating with raw review count, approved subjects and levels, city and neighbourhood, teaching mode, price range, availability indicator, bio excerpt (max 120 characters), and profile URL. No private fields SHALL be present in search results.

**Acceptance Criterion:** The search response for any tutor contains no phone number, email, exact address, full last name, or earnings data even as null values. The availability indicator correctly shows "Available this week", "Next available: [date]", or "Fully booked" based on the tutor's calendar.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-010-008 — Zero results handling

The system SHALL never return an empty results page. Zero results in the searched city SHALL show tutors from nearby cities with a translatable note. Zero results for a subject with no approved tutors anywhere SHALL show a "notify me" option. Overly restrictive filter combinations SHALL highlight the most restrictive filter with a suggestion to remove it.

**Acceptance Criterion:** A search for Physics in a city with no Physics tutors returns tutors from the nearest city with a note. A search for a subject with no tutors platform-wide shows the notify me option. Clicking notify me creates a demand signal entry for that subject and city combination.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-010-009 — Pagination and performance

The system SHALL paginate results at 12 per page using cursor-based pagination. Pre-computed composite scores SHALL be stored and used at query time — scores are not computed on each search request. The search endpoint SHALL respond within 500ms for p95 of requests.

**Acceptance Criterion:** A search request returns exactly 12 results with a cursor for the next page. Requesting the next page with the cursor returns the correct next 12 results with no duplicates or gaps. Under a load of 100 concurrent search requests p95 response time is under 500ms.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-010-010 — City allowlist enforcement

The system SHALL exclude tutors from cities not in the active city allowlist from all search results. The allowlist is managed via the feature flag system in Module 4.

**Acceptance Criterion:** A tutor registered from a city not in the allowlist does not appear in any search results. Adding a city to the allowlist causes tutors from that city to appear in results within 60 seconds without a deployment.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-010-011 — Search analytics

The system SHALL track the following PostHog events for every search interaction: query submitted (query text, filters, result count), zero results encountered (query, filters, city), filter applied or removed, result card clicked (position, action type), and booking initiated from search (result position).

**Acceptance Criterion:** Each tracked event appears in PostHog within 30 seconds of the user action. Zero results events feed the demand signal dashboard in Module 20 within 60 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 11 — Booking & Scheduling

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-011-001 — Booking request submission

The system SHALL allow a Parent or Student with a complete verified account to submit a booking request to any `active` Tutor. The request SHALL specify: student profile (for Parents), subject, level, session type (home or online), preferred date and time, and optional message to the Tutor.

**Acceptance Criterion:** A booking request from an incomplete account returns 403. A booking request to a Tutor without `active` KYC status returns 400. A valid request creates a booking in `requested` status and notifies the Tutor within 30 seconds via in-app and push notification.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-011-002 — Tutor accept and reject

The system SHALL allow a Tutor to accept or reject a booking request. Rejection SHALL require an optional reason. On acceptance the booking moves to `accepted` status and the Parent enters the payment window. On rejection the booking moves to `rejected` status and the Parent is notified.

**Acceptance Criterion:** Accepting a booking creates a payment window job and notifies the Parent within 30 seconds. Rejecting a booking notifies the Parent within 30 seconds with the optional reason if provided. A Tutor accepting a booking they are not party to returns 403.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-011-003 — Payment window enforcement

The system SHALL cancel a booking automatically if payment is not completed within 24 hours of Tutor acceptance. The Parent SHALL receive a reminder notification at the 12-hour mark. On cancellation the Tutor's availability slot SHALL reopen automatically. The payment window duration SHALL be configurable by Super Admin.

**Acceptance Criterion:** A booking accepted but unpaid after 24 hours moves to `cancelled_unpaid` status. The Tutor's availability for that time slot shows as available within 5 seconds of cancellation. The Parent receives a reminder notification at exactly the 12-hour mark. The cancellation background job has a dead man's switch alert in the observability system.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-011-004 — Booking status lifecycle

The system SHALL enforce the following booking status states: `requested`, `accepted`, `rejected`, `cancelled_unpaid`, `paid`, `in_progress`, `awaiting_confirmation`, `confirmed`, `auto_confirmed`, `disputed`, `resolved_tutor_favor`, `resolved_parent_favor`, `cancelled_by_tutor`, `cancelled_by_parent`. Invalid status transitions SHALL be rejected at the service layer.

**Acceptance Criterion:** An attempt to move a booking from `requested` directly to `paid` via the API returns 400. Each valid transition produces a status change event in the audit log. A booking in `disputed` status cannot be moved to `confirmed` without going through resolution.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-011-005 — Tutor cancellation of confirmed paid booking

The system SHALL allow a Tutor to cancel a confirmed paid booking. Tutor cancellation SHALL trigger an automatic full refund to the Parent wallet within 5 seconds. The Tutor SHALL receive a platform warning. Three Tutor cancellations within 30 days SHALL trigger a Trust and Safety flag.

**Acceptance Criterion:** A Tutor cancelling a confirmed paid booking causes the booking to move to `cancelled_by_tutor` status. The Parent wallet balance increases by the full booking amount within 5 seconds. The Tutor receives an in-app warning notification. The third cancellation within 30 days creates a Trust and Safety flag within 30 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-011-006 — Parent cancellation policy

The system SHALL enforce the following cancellation rules for Parents: cancellation 12 or more hours before the session start time results in a full refund to the Parent wallet. Cancellation less than 12 hours before the session start time results in no refund — the full amount is released to the Tutor. The cancellation window threshold SHALL be configurable by Super Admin.

**Acceptance Criterion:** A Parent cancelling 13 hours before session start receives a full refund to their wallet within 5 seconds. A Parent cancelling 11 hours before session start receives no refund and the Tutor wallet is credited the full amount within 5 seconds. The system uses the session scheduled start time as the reference — not the cancellation request time.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-011-007 — Recurring bookings

The system SHALL allow Parents to create a recurring booking series by specifying a recurrence pattern (weekly, biweekly, or custom days), an end date or number of occurrences, and a subject and Tutor. Each session in the series SHALL be an independent booking with its own escrow hold. The series SHALL be created in one action.

**Acceptance Criterion:** A Parent creates a weekly recurring Physics booking for 4 weeks. Four individual bookings are created each in `requested` status within 5 seconds. The Tutor receives one notification summarising all four requests. Cancelling one session in the series does not affect the others. Payment for each session is held separately in escrow.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-011-008 — Availability management

The system SHALL allow Tutors to set their availability as recurring weekly slots or specific date/time slots. Confirmed bookings SHALL block the corresponding availability slot. Cancelled bookings SHALL release the slot. A configurable buffer time between sessions SHALL prevent double-booking.

**Acceptance Criterion:** A Tutor sets Saturday 10am to 12pm as available. A confirmed booking for Saturday 10am to 11am blocks that slot. Attempting to book another session for Saturday 10:30am returns 409. Cancelling the first booking releases the slot within 5 seconds. The default buffer between sessions is 30 minutes and is configurable by the Tutor.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-011-009 — Group session creation

The system SHALL allow Tutors to create group sessions as published events with: subject, level, topic, date and time, duration, maximum student count, minimum student count, price per student, and registration cutoff time. Group sessions SHALL appear on the Tutor's public profile.

**Acceptance Criterion:** A Tutor creates a group session with a minimum of 3 students and maximum of 8. The session appears on their public profile within 5 seconds. A 9th student attempting to register receives 400. If fewer than 3 students have registered by the cutoff time the session is automatically cancelled and all registered students receive full refunds within 5 minutes.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-011-010 — Home tutoring check-in and check-out

The system SHALL require both Tutor and Parent/Student to check in through the app at the session start time and check out at the end for home tutoring sessions. The system SHALL send check-in reminders at session start time and a second reminder 15 minutes after start if no check-in has occurred. If neither party checks in within 30 minutes of session start the booking SHALL be flagged for Admin review automatically.

**Acceptance Criterion:** A home tutoring session with both parties checked in and checked out triggers the confirmation flow in Module 16. A session where only one party checks out is flagged for Admin review within 5 minutes of the scheduled end time. The 30-minute no-show flag appears in the Admin queue within 5 minutes of the threshold passing.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-011-011 — Rescheduling

The system SHALL allow either party to request a reschedule before the session start time. The other party SHALL accept or reject the reschedule request. An accepted reschedule SHALL update the booking time and reschedule all associated reminders. A reschedule request within 12 hours of session start follows the same financial rules as a Parent cancellation.

**Acceptance Criterion:** A reschedule request creates a pending reschedule entry and notifies the other party within 30 seconds. Accepting the reschedule updates the booking time and cancels the old reminder jobs and creates new ones within 5 seconds. A reschedule request within 12 hours of session start is treated as a cancellation if rejected.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 12 — Notifications

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-012-001 — NotificationService interface

The system SHALL route all notifications through a central `NotificationService.send()` method. Every notification SHALL be written to the `notifications` table before any external delivery is attempted. External delivery SHALL be asynchronous and SHALL never block the triggering action.

**Acceptance Criterion:** With all external notification channels (Resend, FCM, WhatsApp) disabled, `NotificationService.send()` still creates a database entry within 500ms. A direct call to Resend, FCM, or WhatsApp Cloud API outside of NotificationService fails the CI check.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-012-002 — In-app notification persistence

The system SHALL store every notification in the `notifications` table with fields: `notificationId`, `recipientId`, `type`, `title`, `body`, `data`, `readAt`, `createdAt`. Unread notifications SHALL be retained indefinitely. Read notifications SHALL be retained for 90 days.

**Acceptance Criterion:** Every `NotificationService.send()` call produces a database entry with all required fields within 500ms. A notification marked as read has a non-null `readAt` timestamp. A background job deletes read notifications older than 90 days daily.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-012-003 — Real-time unread count

The system SHALL deliver real-time unread notification count updates via WebSocket. The bell icon badge SHALL update without a page refresh when a new notification arrives.

**Acceptance Criterion:** A notification sent to an authenticated user with an active WebSocket connection updates the unread count on their screen within 2 seconds. After WebSocket reconnection the unread count reflects all notifications received while disconnected.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-012-004 — Email delivery via Resend

The system SHALL deliver email notifications via Resend. All email templates SHALL be rendered in the recipient's preferred locale. Every email SHALL include a plain text fallback. Transactional emails SHALL not include an unsubscribe link. Non-transactional emails SHALL include an unsubscribe link.

**Acceptance Criterion:** An email notification triggered for a French-locale user contains French subject and body text. An email notification triggered for an English-locale user contains English text. Resend delivery status (sent, delivered, bounced) is tracked via webhook and stored against the notification record within 60 seconds of delivery.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-012-005 — Push notifications via FCM

The system SHALL deliver push notifications via Firebase Cloud Messaging. FCM device tokens SHALL be stored per user per device. Stale tokens SHALL be automatically removed when FCM returns a not-registered error.

**Acceptance Criterion:** A push notification sent to a user with two active devices is delivered to both within 30 seconds. An invalid FCM token is removed from the database within 5 seconds of FCM returning a not-registered error. Push permission is requested after the user's first meaningful action, not immediately on registration.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-012-006 — WhatsApp notifications via WhatsApp Cloud API

The system SHALL deliver WhatsApp notifications only to users who have explicitly opted in. Opt-in SHALL be collected during account completion onboarding with a separately editable WhatsApp number field. An opt-in confirmation message SHALL be sent immediately. Users replying STOP SHALL be automatically opted out via webhook.

**Acceptance Criterion:** A user who has not opted in receives no WhatsApp messages regardless of notification type. An opt-in confirmation message is delivered within 60 seconds of opt-in. A STOP reply processed via webhook sets the user's WhatsApp opt-in to false within 30 seconds. The opt-in timestamp is stored for compliance.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-012-007 — SMS stub

The system SHALL include an SMS channel stub in NotificationService that logs the intended message and returns success without calling any external SMS API. The stub SHALL be replaceable with a real SMS implementation without changing any calling code.

**Acceptance Criterion:** An SMS notification send call produces a log entry containing the recipient phone number and message content. No external HTTP call is made. Replacing the stub with a real implementation requires changes only to the SMS provider file, not to any calling module.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-012-008 — Phone number independence

The system SHALL store the following phone numbers independently per user account: primary phone number, MTN MoMo number, Orange Money number, and WhatsApp number. All four may be different. Each is validated for Cameroonian format (+237 prefix, correct length) at input.

**Acceptance Criterion:** A user can set four different phone numbers and all four are stored independently. Changing the WhatsApp number does not affect the MoMo number. A phone number in an invalid Cameroonian format returns 400 with a translatable validation error.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-012-009 — User notification preferences

The system SHALL allow users to configure per-notification-type per-channel preferences. Transactional notifications (payment confirmation, account security, KYC status) SHALL not be disableable. Non-transactional notifications SHALL be disableable per channel. A single mute-all toggle SHALL disable all non-transactional notifications.

**Acceptance Criterion:** A user disabling push notifications for lesson reminders does not receive push notifications for lesson reminders. The same user still receives push notifications for payment confirmations. The mute-all toggle disables all non-transactional channels simultaneously. Preference changes take effect on the next notification of that type.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-012-010 — Scheduled reminder notifications

The system SHALL schedule session reminder notifications as background jobs at booking confirmation time: 24 hours before session start and 1 hour before session start for all session types, plus check-in reminders at session start time and 15 minutes after start for home tutoring sessions. Cancelled bookings SHALL automatically cancel all associated reminder jobs.

**Acceptance Criterion:** A confirmed booking creates four scheduled jobs (24hr reminder, 1hr reminder, check-in reminder, 15min check-in reminder for home sessions). Each reminder is delivered within 2 minutes of its scheduled time. Cancelling the booking removes all pending reminder jobs within 5 seconds. The reminder scheduler background job has a dead man's switch alert in the observability system.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-012-011 — Notification delivery retry

The system SHALL retry failed external channel deliveries up to 3 times with exponential backoff. Channel delivery failures SHALL not affect in-app notification delivery. All delivery failures SHALL be logged to the observability system.

**Acceptance Criterion:** A simulated Resend API failure causes 3 retry attempts at increasing intervals. After 3 failures the notification is marked as delivery-failed in the database. The in-app notification is unaffected by the email failure. Each retry attempt and final failure are visible in the Grafana logs within 30 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 13 — Payments & Escrow

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-013-001 — Parent wallet

The system SHALL maintain a wallet balance for every Parent and Student account. The wallet balance SHALL be visible on the dashboard at all times. Parents SHALL be able to top up their wallet via MTN MoMo or Orange Money. The minimum top-up amount SHALL be 500 XAF as enforced by the `WALLET_MIN_TOPUP` environment variable. Super Admin SHALL be able to configure a higher minimum through the admin dashboard but SHALL NOT be able to set it below the environment variable floor.

**Acceptance Criterion:** A top-up of 499 XAF returns 400 with a translatable error showing the minimum amount. A top-up of 500 XAF succeeds and the wallet balance updates within 5 seconds of payment confirmation from NotchPay. The environment variable floor cannot be overridden by any admin dashboard setting.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-002 — Parent wallet withdrawal

The system SHALL allow Parents and Students to withdraw unused wallet balance to their registered MoMo or Orange Money number. The MoMo transaction fee SHALL be deducted from the withdrawal amount. The fee SHALL be displayed to the user before confirmation.

**Acceptance Criterion:** A Parent initiating a withdrawal sees the fee and net amount before confirming. Confirming the withdrawal initiates a NotchPay payout within 5 seconds. The wallet balance decreases by the full withdrawal amount (including fee) immediately on confirmation. A withdrawal attempt exceeding the wallet balance returns 400.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-003 — Payment at checkout (two paths)

The system SHALL support two payment paths at booking checkout: pay from wallet balance (instant, no MoMo transaction at checkout) and pay directly from MoMo or Orange Money via NotchPay. Both paths SHALL result in the same escrow state. A Parent with insufficient wallet balance SHALL be offered the direct MoMo path automatically.

**Acceptance Criterion:** A Parent with sufficient wallet balance can complete booking payment without a MoMo transaction. A Parent with insufficient balance is shown the direct MoMo option. Both payment paths result in a booking moving to `paid` status with an escrow hold entry within 5 seconds of payment confirmation.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-004 — Escrow hold

The system SHALL create an escrow hold entry in the ledger for every successful booking payment. Escrow holds SHALL be tracked per booking in the database ledger — not in a separate financial account. The Mentora NotchPay merchant wallet holds all funds. The ledger distinguishes: escrow balance (belongs to users), commission balance (belongs to Mentora), and tutor wallet balance.

**Acceptance Criterion:** Every successful payment creates an escrow hold record with booking ID, amount, commission amount, net tutor amount, and timestamp. The total escrow balance in the finance dashboard equals the sum of all active escrow hold records. The three balance categories sum to the total NotchPay merchant wallet balance.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-005 — Commission calculation

The system SHALL calculate commission at booking payment time based on the active commission mode: per-session percentage (default 15%), monthly fee deduction, or both. The per-session percentage SHALL be configurable by Super Admin. The commission amount SHALL be recorded in the escrow hold entry and deducted from the tutor payout at release time.

**Acceptance Criterion:** A 10,000 XAF booking with 15% per-session commission creates an escrow hold with commission amount of 1,500 XAF and net tutor amount of 8,500 XAF. Changing the commission percentage via the admin dashboard takes effect on new bookings only — existing escrow holds are unaffected. Historical bookings honour the rate at the time of payment.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-006 — Escrow release to tutor wallet

The system SHALL release escrow to the Tutor's in-app wallet when instructed by Module 16 (lesson confirmed or auto-release after 48 hours). Release SHALL credit the net tutor amount (after commission deduction) to the Tutor's wallet balance within 5 seconds. The commission amount SHALL move to the platform commission balance in the ledger.

**Acceptance Criterion:** On lesson confirmation the Tutor's wallet balance increases by the net amount within 5 seconds. The escrow hold record moves to `released` status. The platform commission balance increases by the commission amount. The total merchant wallet balance is unchanged — only the ledger categorisation changes.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-007 — Auto-release after 48 hours

The system SHALL automatically release escrow to the Tutor wallet 48 hours after a session ends if no confirmation or dispute has been submitted. The auto-release SHALL be handled by a background job. The auto-release window SHALL be configurable by Super Admin. The background job SHALL have a dead man's switch alert in the observability system.

**Acceptance Criterion:** A booking with no confirmation or dispute after exactly 48 hours from session end moves to `auto_confirmed` status and the Tutor wallet is credited within 5 minutes of the threshold. The auto-release job heartbeat is monitored — a missed heartbeat triggers an immediate observability alert. Changing the auto-release window via admin dashboard takes effect on new sessions only.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-008 — Full refund to parent wallet

The system SHALL issue a full refund to the Parent wallet when instructed by Module 16 (dispute resolved in Parent's favor) or when a Tutor cancels a confirmed paid booking. Refunds SHALL credit the full payment amount (including commission) to the Parent wallet within 5 seconds.

**Acceptance Criterion:** A dispute resolved in the Parent's favor credits the full payment amount (not the net tutor amount — the full amount the Parent paid) to the Parent wallet within 5 seconds. A Tutor cancellation credits the full amount within 5 seconds. The escrow hold record moves to `refunded` status. The commission balance is not credited on a refund.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-009 — Tutor wallet and withdrawal

The system SHALL maintain a wallet balance for every Tutor account showing: withdrawable balance, pending earnings (in escrow), and total earned all time. Tutors SHALL initiate on-demand withdrawals to any registered payout account. The MoMo transaction fee SHALL be deducted from the withdrawal amount and displayed before confirmation.

**Acceptance Criterion:** A Tutor's wallet balance accurately reflects confirmed released earnings minus previous withdrawals. A withdrawal initiation displays the fee and net amount before confirmation. A withdrawal attempt exceeding the withdrawable balance returns 400. A successful withdrawal initiates a NotchPay payout within 5 seconds and decreases the wallet balance immediately.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-010 — Payout account management

The system SHALL allow Tutors to register multiple MTN MoMo and Orange Money payout accounts. A newly added payout account SHALL have a 48-hour cooling-off period before it can receive a withdrawal. The Tutor SHALL choose the destination account at withdrawal time. The Tutor SHALL receive a security notification when a new account is added.

**Acceptance Criterion:** A Tutor adds a new payout account and attempts a withdrawal to it within 48 hours — the attempt returns 400 with a translatable message showing when the account becomes available. After 48 hours the withdrawal succeeds. The security notification is delivered within 30 seconds of account addition. There is no maximum limit on registered payout accounts.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-011 — Failed payout handling

The system SHALL handle failed Tutor withdrawals by retaining the amount in the Tutor wallet, notifying the Tutor to contact support, and creating a support ticket entry for a Support Agent to investigate. Failed withdrawals SHALL be visible in the Admin finance dashboard.

**Acceptance Criterion:** A simulated failed NotchPay payout retains the withdrawal amount in the Tutor wallet. The Tutor receives an in-app and WhatsApp notification within 30 seconds. A support ticket is created and appears in the Support Agent queue within 30 seconds. The failed withdrawal appears in the Admin finance dashboard failed payouts section.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-012 — Payment idempotency

The system SHALL ensure all payment initiation endpoints are idempotent. Retrying the same payment request SHALL never create a duplicate charge. Each payment request SHALL include a client-generated idempotency key.

**Acceptance Criterion:** Submitting the same payment request with the same idempotency key twice returns the same response as the first request without creating a second payment. Two requests with different idempotency keys create two separate payments. An idempotency key expires after 24 hours.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-013 — Network drop reconciliation

The system SHALL detect payment initiation without webhook confirmation within 10 minutes by querying NotchPay directly. If payment is confirmed: escrow hold is created and booking proceeds. If payment failed: Parent is notified and can retry. If status is unknown: transaction is marked `pending_reconciliation`, Parent is notified to check their MoMo balance before retrying, and a support ticket is created.

**Acceptance Criterion:** A payment where the webhook is artificially delayed beyond 10 minutes triggers a direct NotchPay status query. The query result correctly updates the booking and wallet state. A `pending_reconciliation` entry appears in the Support Agent queue within 30 seconds of the threshold. The Parent receives a notification within 5 minutes of the threshold.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-014 — Platform commission withdrawal

The system SHALL allow Super Admin to withdraw platform commission from the Mentora NotchPay merchant wallet to a designated account through the admin dashboard. The NotchPay withdrawal threshold SHALL be displayed clearly before a withdrawal is attempted.

**Acceptance Criterion:** The finance dashboard displays the current commission balance, the NotchPay minimum withdrawal threshold, and the withdrawable amount (commission balance minus threshold). A withdrawal attempt below the threshold returns 400 with a translatable message showing the threshold. A successful withdrawal is recorded in the audit log with the Super Admin's ID, amount, and timestamp.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-015 — Receipt generation

The system SHALL generate a PDF receipt for every successful payment. Each receipt SHALL contain a unique reference number, transaction details, platform branding, and a verifiable reference that Admin can look up instantly. Receipts SHALL be accessible to the paying Parent or Student from their payment history at any time.

**Acceptance Criterion:** Every successful payment produces a PDF receipt accessible within 30 seconds. Admin entering the receipt reference number in the admin dashboard retrieves the full transaction record within 2 seconds. The receipt PDF is stored via Module 8 with signed URL access for the paying user only.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-016 — Monthly fee deduction (when commission mode includes monthly fee)

The system SHALL automatically deduct the configured monthly fee from the Tutor wallet on the first day of each month when the commission mode includes a monthly fee. If the Tutor wallet balance is insufficient, the Tutor SHALL be notified and given a 7-day grace period before their account is restricted.

**Acceptance Criterion:** On the first day of the month the monthly fee deduction job runs and deducts the fee from all active Tutor wallets with sufficient balance. A Tutor with insufficient balance receives an in-app and email notification within 30 minutes of the failed deduction. After 7 days without payment the Tutor's account moves to `payment_overdue` status and their profile is hidden from search results.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-013-017 — Platform outage auto-refund

The system SHALL automatically issue full refunds to affected Parents when the observability system confirms the platform was down during a scheduled session window. Both parties SHALL be notified. The refund SHALL be processed without requiring a dispute to be opened.

**Acceptance Criterion:** When Grafana detects a platform outage during a session window, affected bookings in `paid` or `in_progress` status are identified within 10 minutes. Full refunds are issued to affected Parent wallets within 30 minutes of outage confirmation. Both parties receive notifications. The refunds are recorded in the audit log as system-initiated with the outage timestamp as context.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

### Module 14: Live Sessions (LiveKit)

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-014-001 — Session room creation

The system SHALL create a LiveKit room for every confirmed paid online booking 15 minutes before the scheduled start time via a background scheduled job. Room names SHALL be non-guessable UUIDs tied to the booking ID. Room creation failure SHALL trigger an immediate observability alert and a notification to both parties.

**Acceptance Criterion:** A confirmed online booking has a LiveKit room created exactly 15 minutes before its scheduled start time. The room name contains no predictable pattern — sequential booking IDs produce completely different room names. A simulated room creation failure triggers an observability alert within 2 minutes and both parties receive an in-app notification within 5 minutes. The room creation job has a dead man's switch alert in the observability system.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-002 — Token generation and access control

The system SHALL generate a signed LiveKit JWT token for each participant only when they request to join. Token generation SHALL require the requesting user to have a confirmed paid booking for that session. Tokens SHALL never be pre-generated or stored. Token expiry SHALL be the scheduled session duration plus 30 minutes.

**Acceptance Criterion:** A user with no booking for a session receives 403 when requesting a token — no room information is exposed in the error. An Admin requesting an observer token for a session they are not party to succeeds when the `live_sessions.admin_observe` flag is enabled. A token used after its expiry returns a LiveKit authentication error.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-003 — Tutor token permissions

The system SHALL issue Tutor tokens with the following permissions: publish audio and video, screen sharing, mute any participant, remove any participant, lock the room, end session for all participants. For group sessions the Tutor token SHALL additionally include: mute all students, grant screen sharing to specific students.

**Acceptance Criterion:** An authenticated Tutor with a valid booking token can mute a student participant via the LiveKit room API. A student with a participant token attempting to mute another participant receives a LiveKit permission error. Ending the session via the Tutor's end-session action closes the room for all participants within 10 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-004 — Student token permissions for one-on-one sessions

The system SHALL issue Student tokens for one-on-one sessions with the following permissions: publish audio and video, screen sharing enabled, cannot mute or remove other participants.

**Acceptance Criterion:** A Student with a one-on-one token successfully publishes audio and video. The same Student attempting to remove the Tutor from the room receives a LiveKit permission error. Screen sharing initiated by the Student is visible to the Tutor.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-005 — Student token permissions for group sessions

The system SHALL issue Student tokens for group sessions with the following permissions: publish audio and video (Tutor can mute), screen sharing disabled by default (Tutor can grant), raise hand signal enabled, cannot mute or remove other participants.

**Acceptance Criterion:** A Student in a group session with screen sharing disabled cannot initiate a screen share. After the Tutor grants screen sharing to that Student via the API, the Student can initiate screen sharing within 5 seconds. A raise hand signal from a Student appears in the Tutor's participant list within 2 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-006 — Pre-join screen

The system SHALL display a pre-join screen to both Tutor and Student before entering the session room. The pre-join screen SHALL include: camera preview, microphone level indicator, device selector for camera/microphone/speaker, name display, and a join button. The join button SHALL only become active 15 minutes before the scheduled session start time.

**Acceptance Criterion:** A user attempting to access the session room more than 15 minutes before the scheduled start time sees the pre-join screen with the join button disabled and a countdown timer. The join button activates at exactly 15 minutes before start. Device selection changes are reflected in the camera preview within 2 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-007 — Session room UI components

The system SHALL build the session room UI using LiveKit's React component library (`@livekit/components-react`) installed via shadcn CLI and styled with Tailwind CSS to match Mentora's design system. All LiveKit components SHALL live directly in the codebase and be fully customisable.

**Acceptance Criterion:** The session room renders correctly in Chrome, Firefox, and Safari. The UI matches Mentora's design system (colours, typography, spacing). A Tutor and Student can join a session room and see each other's video within 10 seconds of both joining. The LiveKit components are installed as local files — no black-box iframe is used.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-008 — Control bar

The system SHALL render a control bar for all participants with: toggle camera, toggle microphone, device selectors, toggle session chat, toggle whiteboard, and leave session. Tutor control bar SHALL additionally include: toggle screen sharing, mute all (group), mute individual student (group), remove participant, lock room, end session for all. Group session student control bar SHALL additionally include: raise hand toggle.

**Acceptance Criterion:** Every control bar action produces the expected LiveKit room state change within 2 seconds. Mute all in a group session mutes all student audio tracks simultaneously. End session for all closes the room and navigates all participants to the lesson confirmation screen within 10 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-009 — Shared whiteboard

The system SHALL embed Excalidraw as a shared whiteboard within the session room. Whiteboard state SHALL sync in real time for all participants via LiveKit's data channel. Whiteboard contents SHALL persist for the session duration. At session end the whiteboard SHALL be exported as a PNG and stored via Module 8 tied to the booking record.

**Acceptance Criterion:** A shape drawn by the Tutor on the whiteboard appears on the Student's screen within 2 seconds. A participant who disconnects and reconnects sees the current whiteboard state within 5 seconds of rejoining. The whiteboard PNG is accessible in the booking detail view within 5 minutes of session end.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-010 — Session chat

The system SHALL provide an in-session chat panel using LiveKit's data channel. All session chat messages SHALL be stored in the database tied to the booking ID. Session chat history SHALL be accessible to both parties in the booking detail view after the session. Admin and Super Admin SHALL be able to access session chat history for any session for dispute investigation.

**Acceptance Criterion:** A message sent in the session chat is received by all participants within 2 seconds. Session chat history is accessible from the booking detail view within 5 minutes of session end. An Admin accessing session chat history for a booking they are not party to succeeds. Session chat is separate from the main messaging module — it does not appear in the messaging inbox.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-011 — Connection quality and reconnection

The system SHALL display a connection quality indicator to each participant showing their own connection status (poor, fair, good). LiveKit SHALL attempt automatic reconnection for up to 60 seconds on connection drop. After reconnection failure the participant is returned to the pre-join screen with their session still active. A Tutor who disconnects and fails to reconnect within 10 minutes SHALL trigger a notification to Students and flag the booking for Admin review.

**Acceptance Criterion:** A simulated network interruption triggers the reconnecting indicator within 5 seconds. Successful reconnection restores the participant to the room without reloading the page. A Tutor disconnection exceeding 10 minutes sends an in-app notification to all Students within 2 minutes and creates an Admin flag within 5 minutes.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-012 — Session tracking data

The system SHALL record the following data throughout every online session: actual start time (first participant joined), each participant's join time, each participant's leave time(s) including reconnections, each participant's total time in room, overlap duration (time both Tutor and at least one Student were simultaneously present), connection quality events per participant, and whether the Tutor or timeout ended the session.

**Acceptance Criterion:** A completed session has a tracking record containing all required fields. Overlap duration is accurate to within 30 seconds. Connection quality events are logged with participant ID, quality level, and timestamp. Session tracking writes are asynchronous and do not affect session performance. A tracking write failure triggers an immediate observability alert — session tracking data loss is critical.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-013 — Session end flow

The system SHALL end a session when: the Tutor clicks end session for all, all participants leave and the departure timeout (15 minutes) passes, or the scheduled duration plus 30-minute buffer expires. On session end the system SHALL finalise tracking data, export the whiteboard, finalise session chat, notify Module 16 with the complete session data package, and navigate both parties to the lesson confirmation screen.

**Acceptance Criterion:** A Tutor clicking end session navigates all participants to the lesson confirmation screen within 10 seconds. The session data package is delivered to Module 16 within 30 seconds of session end. A session that ends before 50% of the scheduled duration automatically flags the booking for Admin review before escrow release. Session end is recorded in the audit log.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-014 — No-show handling

The system SHALL auto-close the session room if no participants join within 30 minutes of the scheduled start time. Both parties SHALL be notified. The booking SHALL be flagged for Admin review before any escrow decision.

**Acceptance Criterion:** A session room with no participants 30 minutes after the scheduled start time is closed by LiveKit's empty timeout configuration. Both parties receive an in-app notification within 5 minutes of room closure. The booking appears in the Admin flagged bookings queue within 5 minutes.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-015 — React Native compatibility

The system SHALL implement the mobile session room using LiveKit's React Native SDK (`@livekit/react-native`). The mobile UI SHALL be fully custom-built in React Native styled to match Mentora's mobile design system. Background audio SHALL continue when the app is minimised. A persistent notification SHALL display during an active session with a return-to-session action.

**Acceptance Criterion:** A session started on web can be joined from React Native using the same token generation endpoint with no backend changes. Audio continues playing when the React Native app is sent to the background. The persistent notification appears within 5 seconds of joining a session and disappears within 5 seconds of leaving.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-014-016: Flag-gated features

The system SHALL gate the following features behind feature flags that are off by default: session recordings (`live_sessions.recordings`), group sessions (`live_sessions.group_sessions`), and Admin session observation (`live_sessions.admin_observe`). LiveKit SHALL be configured to record all sessions from day one regardless of flag state — recordings are stored but not surfaced until the flag is enabled.

**Acceptance Criterion:** With `live_sessions.recordings` disabled no recording links appear in any API response. With the flag enabled, a completed session produces a recording accessible to both parties in the booking detail view. With `live_sessions.group_sessions` disabled the group session creation endpoint returns 404. One-on-one sessions are unaffected by the group sessions flag state.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 15: Messaging

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-015-001: MessagingService abstraction

The system SHALL route all messaging operations through a central `MessagingService`. No module SHALL access the conversations or messages tables directly outside of `MessagingService`.

**Acceptance Criterion:** A CI check confirms no direct database queries to the conversations or messages tables exist outside the MessagingService file. All messaging operations in other modules call MessagingService methods exclusively.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-015-002: Conversation types and access rules

The system SHALL enforce three conversation states: Inquiry (pre-payment, max 10 messages, strictest filter), Active (post-payment, full messaging, standard filter), and Archived (read-only after booking completion). An Inquiry conversation SHALL upgrade automatically to Active when a confirmed paid booking exists between the parties — history is preserved.

**Acceptance Criterion:** An Inquiry conversation at 10 messages disables the message input for both parties. A confirmed paid booking between the same parties upgrades the conversation to Active within 5 seconds. Active conversation history includes all Inquiry messages. An Archived conversation returns 400 on any send attempt.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-015-003: Tutors cannot initiate conversations

The system SHALL prevent Tutors from initiating new conversations. Only Parents and Students can start an Inquiry. Tutors can only reply to existing conversations.

**Acceptance Criterion:** A Tutor attempting to create a new conversation via the API receives 403. A Tutor replying to an existing conversation succeeds. A Parent creating a new conversation with a Tutor succeeds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-015-004: Content filter pipeline Layer 1 (explicit patterns)

The system SHALL block any outbound message containing: Cameroonian phone number formats (+237, 237, 6XXXXXXXX, 2XXXXXXXX), international phone number formats, email addresses, WhatsApp links (wa.me, chat.whatsapp.com), Telegram links (t.me), social media profile links (facebook.com, instagram.com, twitter.com, x.com, linkedin.com, tiktok.com, snapchat.com), any http/https URL, and bare domain patterns (word.com, word.net, word.org, word.cm).

**Acceptance Criterion:** A message containing "+237675644383" is blocked and never stored. A message containing "mysite.com" is blocked. A message containing "check facebook.com" is blocked. A clean message with no contact patterns is delivered successfully. Each blocked attempt is logged with the matched pattern and timestamp.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-015-005: Content filter pipeline Layer 2 (obfuscation detection)

The system SHALL normalise messages before pattern matching by: removing spaces, stripping dots and dashes, reversing common character substitutions (O to 0, l to 1, @ to a). The normalised message SHALL be run through all Layer 1 patterns. Spaced digit sequences forming valid phone number lengths SHALL be detected.

**Acceptance Criterion:** A message containing "6 7 5 6 4 4 3 8 3" is blocked as an obfuscated phone number. A message containing "675.644.383" is blocked. A message containing "67564438³" is blocked after character normalisation. A message containing "675 XAF per session" is not blocked — the digit sequence does not form a valid phone number.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-015-006: Content filter pipeline Layer 3 (intent keywords)

The system SHALL block messages containing off-platform intent keywords in English and French. The keyword list SHALL be stored in the database and configurable by Admin without a code change or deployment.

English keywords: "my number is", "call me on", "text me at", "WhatsApp me", "reach me on", "find me on", "contact me outside", "my email is", "let's continue on", "add me on", "DM me", "message me on".

French keywords: "mon numéro", "appelle-moi", "contacte-moi sur", "écris-moi sur", "mon email", "trouve-moi sur", "ajoute-moi sur", "envoie-moi un message sur".

**Acceptance Criterion:** A message containing "WhatsApp me" is blocked. A message containing "appelle-moi" is blocked. Adding a new keyword via the admin dashboard blocks messages containing that keyword within 60 seconds. Keyword matching is case-insensitive and accent-insensitive.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-015-007 — Filter escalation to Trust and Safety

The system SHALL escalate repeated filter blocks to Trust and Safety. After 3 blocked attempts in a single conversation the conversation SHALL be automatically flagged for Moderator review. After 5 blocked attempts across any conversations within 24 hours the account SHALL be flagged in Module 18.

**Acceptance Criterion:** The 3rd blocked attempt in a conversation creates a Moderator review flag within 30 seconds. The 5th blocked attempt across conversations within 24 hours creates a Trust and Safety signal within 30 seconds. Both flags are invisible to the user — no notification is sent to the flagged account.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-015-008: Message persistence and delivery

The system SHALL write every message to the database before delivering it to the recipient. Delivery SHALL use Socket.io. Message status SHALL progress from `sent` to `delivered` when the recipient's Socket.io connection receives it. If the recipient is offline the message SHALL remain `sent` until delivered on next connection.

**Acceptance Criterion:** A message sent to an offline recipient is retrievable when the recipient reconnects. Message status updates from `sent` to `delivered` within 2 seconds of Socket.io delivery. A message blocked by the content filter produces no database entry. Maximum message length is 2,000 characters — longer messages return 400.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-015-009: Read receipts

The system SHALL mark a message as read when the recipient has the conversation open and the message enters their viewport. Read status SHALL update in real time on the sender's screen via Socket.io. Unread counts SHALL be recalculated on every read event.

**Acceptance Criterion:** A message entering the viewport of an open conversation is marked read within 2 seconds. The sender's read indicator updates within 2 seconds of the read event. The unread count badge decreases within 2 seconds. Read events are batched in 500ms windows to prevent excessive database writes.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-015-010: Typing indicators

The system SHALL send transient typing indicators via Socket.io. Typing indicators SHALL never be stored in the database. A typing indicator SHALL auto-clear on the recipient's screen after 5 seconds if no stop event is received.

**Acceptance Criterion:** A typing indicator appears on the recipient's screen within 1 second of the sender starting to type. The indicator disappears within 6 seconds if the sender stops typing without sending. No typing events appear in the database or logs. An integration test confirms zero database writes occur during typing indicator events.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-015-011: Offline fallback to polling

The system SHALL fall back to polling every 10 seconds when a Socket.io connection cannot be established. A connection status indicator SHALL be shown to the user during polling mode.

**Acceptance Criterion:** With WebSocket connections blocked, the chat interface continues to receive new messages via polling within 15 seconds of delivery. The connection status indicator shows "Reconnecting..." during polling mode. When the WebSocket connection is restored polling stops automatically.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-015-012: Admin and Moderator access

The system SHALL allow Admin and Moderator to view any conversation through the admin dashboard. Flagged conversations SHALL appear in a Moderator queue with flag count, flagged content from the moderation log, and conversation context. Moderator actions on flagged conversations: mark reviewed, issue warning, freeze conversation, escalate to Admin. Admin can soft-delete individual messages — content is replaced with a translatable removal notice visible to both parties.

**Acceptance Criterion:** A Moderator accessing a conversation they are not party to via the admin dashboard succeeds. A frozen conversation returns 400 on any send attempt from either party. An Admin soft-deleting a message causes it to display the removal notice within 5 seconds on both parties' screens. All Moderator and Admin actions are recorded in the audit log.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 16: Lesson Confirmation & Disputes

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-016-001: Post-session trigger

The system SHALL receive a session data package from Module 14 (online sessions) or Module 11 (home session check-out) immediately when a session ends. On receipt the booking status SHALL move to `awaiting_confirmation` and both parties SHALL be notified.

**Acceptance Criterion:** Within 30 seconds of a session ending, the booking status is `awaiting_confirmation` and both parties have received an in-app notification prompting confirmation or dispute. The session data package is stored against the booking record and accessible to Admin.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-016-002: Confirmation window

The system SHALL open a 48-hour confirmation window when a booking moves to `awaiting_confirmation`. The Parent SHALL see two actions: Confirm lesson completed and Report an issue. A reminder notification SHALL be sent at the 24-hour mark if no action has been taken. The confirmation window duration SHALL be configurable by Super Admin.

**Acceptance Criterion:** A Parent confirming the lesson moves the booking to `confirmed` status within 5 seconds and triggers escrow release via Module 13. The 24-hour reminder notification is delivered within 30 minutes of the threshold. A Parent who has neither confirmed nor disputed after 48 hours has auto-release triggered automatically.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-016-003: Auto-release after 48 hours

The system SHALL automatically release escrow to the Tutor wallet via Module 13 if no confirmation or dispute is submitted within 48 hours of session end. Auto-release SHALL be handled by a background job created when the confirmation window opens. If a dispute is opened before auto-release the job SHALL be cancelled immediately.

**Acceptance Criterion:** A booking with no action after 48 hours moves to `auto_confirmed` status and the Tutor wallet is credited within 5 minutes of the threshold. Opening a dispute before the 48-hour threshold cancels the auto-release job within 5 seconds. The auto-release background job has a dead man's switch alert in the observability system — a missed heartbeat triggers an immediate alert.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-016-004: Auto-resolution recommendations

The system SHALL evaluate session data and set an internal auto-resolution recommendation before presenting the confirmation screen. Recommendations are internal — never shown to Parent or Tutor.

Recommendation rules:

- Recommend tutor favor: overlap above threshold (default 50%), both parties joined within 15 minutes of start, no severe connection issues
- Recommend parent favor: overlap below 20%, no Tutor join event recorded
- Recommend Admin review: overlap between 20% and 50%, severe connection events, only one party joined, implausible home session timestamps

**Acceptance Criterion:** A session with 90% overlap and normal join times receives a tutor favor recommendation. A session with no Tutor join event receives a parent favor recommendation. Recommendations are absent from all non-Admin API responses. Admin opening a dispute sees the recommendation prominently displayed with the supporting reasoning.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-016-005: Dispute opening

The system SHALL allow a Parent to open a dispute during the confirmation window. The dispute form SHALL require: dispute reason (dropdown) and description (minimum 30 characters, maximum 1000 characters). Optional evidence uploads (max 3 files, 5MB each) via Module 8 are supported. On submission escrow SHALL be frozen, the auto-release job SHALL be cancelled, and Admin SHALL be notified.

Dispute reason options: Lesson did not happen, Lesson was significantly shorter than booked, Tutor did not cover agreed subject, Tutor behaviour was inappropriate, Technical issues prevented the lesson, Other.

**Acceptance Criterion:** A dispute submitted without a reason or with a description under 30 characters returns 400. A valid dispute submission freezes escrow within 5 seconds — Module 13 confirms the escrow is in a frozen state. Admin receives an in-app notification within 30 seconds. A second dispute submission on the same booking returns 409. A dispute opened after the confirmation window has closed returns 400.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-016-006: Tutor dispute response

The system SHALL give the Tutor 24 hours to submit a response after a dispute is opened. The response form SHALL require: response statement (minimum 30 characters, maximum 1000 characters). Optional evidence uploads (max 3 files, 5MB each) via Module 8 are supported. A reminder notification SHALL be sent at the 12-hour mark. If the Tutor does not respond within 24 hours the dispute proceeds without a Tutor statement.

**Acceptance Criterion:** A Tutor response submitted within 24 hours is added to the dispute record and visible to Admin. A response submitted after 24 hours returns 400. The 12-hour reminder notification is delivered within 30 minutes of the threshold. Admin viewing a dispute where the Tutor did not respond sees a clear note: "Tutor did not submit a response."

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-016-007: Evidence package assembly

The system SHALL automatically assemble a complete evidence package on dispute opening containing: session data package, booking details, full conversation history, session chat history, whiteboard export, Parent dispute submission, Tutor response (when submitted), auto-resolution recommendation, Tutor dispute history, and Parent dispute history.

**Acceptance Criterion:** An Admin opening a dispute sees the complete evidence package with all required components. The package is assembled within 60 seconds of dispute submission. Evidence package contents are read-only — no Admin can modify them. The package is retained permanently as part of the booking record regardless of dispute outcome.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-016-008: Admin dispute resolution

The system SHALL provide Admin with two resolution options: resolve in Tutor's favor (full escrow release to Tutor wallet) and resolve in Parent's favor (full refund to Parent wallet). Every resolution SHALL require a mandatory written reason (minimum 30 characters). Resolution instructions SHALL be sent to Module 13 for execution.

**Acceptance Criterion:** A resolution attempt without a written reason returns 400. A resolution in Tutor's favor triggers Module 13 to credit the Tutor wallet within 5 seconds. A resolution in Parent's favor triggers Module 13 to credit the Parent wallet within 5 seconds. Both parties receive resolution notifications within 30 seconds. The resolution is recorded in the audit log with Admin ID, resolution type, reason, and timestamp.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-016-009: Dispute SLA and escalation

The system SHALL escalate disputes to Super Admin after 5 business days without Admin resolution. At 48 hours without action the dispute SHALL be highlighted in the Admin queue. Both thresholds SHALL be configurable by Super Admin. SLA compliance rate SHALL be visible in the analytics dashboard.

**Acceptance Criterion:** A dispute untouched for 5 business days is marked escalated and Super Admin receives an in-app notification within 30 minutes of the threshold. The dispute appears at the top of the Admin queue with a visual escalation indicator. Dispute SLA compliance rate appears in the Module 20 analytics dashboard updated daily.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-016-010: Dispute pattern monitoring

The system SHALL automatically flag Tutors with more than 3 disputes resolved against them in a 30-day window for KYC review. The system SHALL automatically flag Parents who open disputes in more than 30% of completed bookings over a 30-day rolling window for Trust and Safety review.

**Acceptance Criterion:** A Tutor's 4th dispute resolved against them in 30 days creates a KYC review flag within 30 seconds of resolution. A Parent whose dispute rate exceeds 30% over 30 days creates a Trust and Safety flag within 30 seconds of the threshold being crossed. Both flags are visible in the respective Admin queues.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 17: Ratings & Reviews

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-017-001 — Review eligibility enforcement

The system SHALL only allow reviews for bookings with status `confirmed` or `auto_confirmed`. Each party SHALL submit exactly one review per booking. The review window SHALL be 7 days from booking confirmation and configurable by Super Admin.

**Acceptance Criterion:** A review submission for a booking in `disputed` status returns 400. A second review submission for the same booking from the same user returns 409. A review submission after the 7-day window returns 400 with a translatable error. Admin reopening a review window for a specific booking allows submission within 5 seconds of the reopen action.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-017-002: Tutor review structure

The system SHALL require an overall rating (1 to 5 stars) and a rebooking answer (yes/no) for every Tutor review. Sub-ratings for Subject Knowledge, Communication and Clarity, and Punctuality SHALL be optional. Written review is optional with a minimum of 20 characters if provided.

**Acceptance Criterion:** A review submission without an overall rating returns 400. A review submission without the rebooking answer returns 400. A review submission with sub-ratings stores them independently. A review submission with no sub-ratings stores null values — not zero — for sub-rating fields. A written review under 20 characters returns 400.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-017-003: Low star incident prompt

The system SHALL display a prompt to the reviewer after selecting 1 or 2 overall stars: "It looks like this session didn't go well. Would you like to tell us what happened?" with a direct link to the incident report form. The prompt SHALL not block review submission.

**Acceptance Criterion:** Selecting 1 or 2 stars on the overall rating causes the incident prompt to appear within 1 second. The reviewer can dismiss the prompt and submit the review without filing an incident report. Selecting 3 or more stars does not trigger the prompt.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-017-004: Blind review reveal

The system SHALL withhold both parties' reviews from each other until both have submitted or the 7-day window closes. On reveal both reviews are simultaneously accessible to their recipients. A notification is sent to each recipient on reveal.

**Acceptance Criterion:** A Tutor who submitted their review cannot see the Parent's review until the Parent also submits or 7 days pass. When both submit, both reviews become accessible within 5 seconds. A review submitted on day 6 is revealed immediately if the other party already submitted. The reveal notification is delivered within 30 seconds of reveal.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-017-005: Experience review routing

The system SHALL collect a platform experience rating (1 to 5 stars, optional comment) alongside every review. Experience review data SHALL be sent exclusively to PostHog — never written to the reviews table. Experience reviews SHALL never appear in any public-facing API response.

**Acceptance Criterion:** An experience review submission creates a PostHog event within 30 seconds. No experience review data appears in the booking detail, Tutor profile, or any user-facing API response. An integration test confirms zero rows are written to the reviews table for experience review submissions.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-017-006: Bayesian rating recalculation

The system SHALL recalculate a Tutor's Bayesian-adjusted overall rating on every new review submission. The recalculated rating SHALL feed into the Module 10 composite search score within 5 seconds of the review submission.

**Acceptance Criterion:** After a new review is submitted, the Tutor's Bayesian rating updates within 5 seconds. The updated rating is reflected in the next search result for that Tutor. Removing a review via Admin action recalculates the rating within 5 seconds. A unit test confirms the Bayesian formula produces correct results for edge cases including first review, minimum threshold, and review removal.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-017-007: Tutor response to reviews

The system SHALL allow a Tutor to submit one response to any written review. Responses SHALL have a maximum of 300 characters and a 48-hour edit window. Content filter Layer 1 and Layer 2 from Module 15 SHALL run on all review responses.

**Acceptance Criterion:** A Tutor submitting a second response to the same review returns 409. A response containing a phone number is blocked by the content filter and returns 400. A response submitted and edited within 48 hours saves the updated text. A response edit attempted after 48 hours returns 400.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-017-008: Review reporting and moderation

The system SHALL allow users to report reviews for policy violations. Reported reviews SHALL enter a Moderator queue and remain visible until actioned. Moderator actions: dismiss report, remove review (soft delete with replacement notice), escalate to Admin. A Tutor who reports more than 5 reviews in 30 days SHALL be flagged in Trust and Safety.

**Acceptance Criterion:** A reported review appears in the Moderator queue within 30 seconds. A soft-deleted review displays the removal notice within 5 seconds on both parties' screens. The 6th report by the same Tutor within 30 days creates a Trust and Safety flag within 30 seconds. All Moderator actions are recorded in the audit log.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-017-009: Incident reporting

The system SHALL provide a separate incident report form after any session. Incident reports SHALL not freeze escrow or affect payment. Incident reports SHALL be tied to a specific booking and include full booking context, session data, and conversation history for Moderator review.

For Parents reporting Tutors: Inappropriate language or behaviour, Did not cover agreed subject, Was significantly late or unprepared, Made me or my child uncomfortable, Attempted to arrange off-platform contact, Other.

For Tutors reporting Parents/Students: Abusive or disrespectful behaviour, Unreasonable demands during session, Attempted to arrange off-platform contact, No-show without cancellation, Other.

**Acceptance Criterion:** An incident report submission without a description of minimum 50 characters returns 400. The report appears in the Moderator queue within 30 seconds with full booking context and session data. The Moderator can view the conversation history directly from the report. Filing an incident report does not change the booking status or escrow state.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-017-010: Review integrity and fraud detection

The system SHALL flag: more than 5 reviews for a single Tutor within 24 hours (coordinated review pattern), reviews from accounts with no other booking history submitted within a short window, and reviews removed by Moderators more than 3 times for the same account. All flags feed into Trust and Safety.

**Acceptance Criterion:** The 6th review for a single Tutor within 24 hours creates a Trust and Safety flag within 30 seconds. A cluster of reviews from zero-booking accounts within 1 hour creates a flag within 30 seconds. A 4th review removal for the same account creates a Trust and Safety flag within 30 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 18: Trust & Safety & Fraud Detection

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-018-001: Risk score architecture

The system SHALL maintain a continuously updated integer risk score for every account with a minimum of 0 and no upper cap. Every score change SHALL be accompanied by the signal that triggered it. Score SHALL decay by 5 points per 30 days of no new negative signals via a background daily job. Score SHALL never go below 0.

**Acceptance Criterion:** A new account starts with a score of 0. Adding a signal increases the score by the configured point value within 30 seconds. The decay job runs daily and reduces scores by 5 points for accounts with no new signals in the last 30 days. A score of 3 decaying does not go below 0. The decay job has a dead man's switch alert in the observability system.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-018-002: TrustSafetyService interface

The system SHALL route all trust signal recording through `TrustSafetyService.recordSignal(userId, signalType, context)`. No module SHALL write directly to the risk score table outside of TrustSafetyService.

**Acceptance Criterion:** A CI check confirms no direct writes to the risk score table exist outside the TrustSafetyService file. All signal recording in other modules calls TrustSafetyService exclusively. Signal recording is asynchronous and does not block the action that triggered it.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-018-003: Signal point values and configurability

The system SHALL implement all defined trust signals with their default point values. All point values and risk state thresholds SHALL be configurable by Super Admin through the platform configuration dashboard without a code change.

Default signal point values:

|Signal|Points|
|---|---|
|Content filter block in any conversation|+5|
|3 filter blocks in single conversation|+15 additional|
|5 filter blocks across conversations in 24hrs|+25|
|Payment initiation without completion 3+ times in 10min|+20|
|Failed payment after 5th attempt|+5|
|Dispute opened against account|+10|
|Dispute resolved against account|+20|
|Dispute resolved in account's favor|-5|
|Incident report filed against account|+15|
|Review removed by Moderator|+20|
|Coordinated review pattern detected|+40|
|Tutor reporting 5+ reviews in 30 days|+15|
|KYC application rejected|+10|
|Document flagged as suspicious|+30|
|CNI number on multiple accounts|+50 (immediate Orange)|
|No-show without cancellation|+10|
|High inquiry-to-booking failure rate after 10 inquiries|+15|
|3+ different Tutors declining same Parent in 30 days|+10|
|Same device fingerprint as suspended account|+40 (immediate Orange)|
|Same phone number as suspended/banned account|+50 (immediate Red)|
|Geo-velocity anomaly|+15|
|Multiple accounts from same IP in 24hrs|+30 per additional account|
|Tutor cancels confirmed paid booking|+15|
|Wallet pattern suggesting money laundering|+30 (immediate Admin flag)|

**Acceptance Criterion:** Each signal when triggered increases the account score by exactly the configured point value within 30 seconds. Changing a point value via the admin dashboard takes effect on the next signal of that type without a deployment. An integration test for every signal confirms the correct point value is applied.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-018-004 — Risk state behaviour

The system SHALL enforce four risk states based on score thresholds (all configurable by Super Admin):

|State|Default Score Range|Behaviour|
|---|---|---|
|Green|0-29|Normal platform experience|
|Yellow|30-59|Flagged in Moderator queue, no restrictions|
|Orange|60-89|Re-authentication required before payment, priority Moderator review within 48hrs|
|Red|90+|Immediate account suspension, Super Admin notified, human review within 24hrs|

**Acceptance Criterion:** An account reaching Red state has all active sessions invalidated within 5 seconds. The account cannot log in and sees a generic translatable suspension message. Super Admin receives an in-app notification within 2 minutes. No account moves to permanent ban without human review. Specific signals are never disclosed to the suspended user.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-018-005: Human review queue

The system SHALL provide a Trust and Safety review queue in the admin dashboard sorted by: Red state accounts first, then Orange by time in queue, then Yellow by time in queue. Each entry SHALL display account identity, current score, risk state, days in state, top contributing signals, and links to all relevant evidence.

**Acceptance Criterion:** A Red state account appears at the top of the queue within 2 minutes of reaching Red state. Clicking an entry shows the complete signal history, linked evidence, and available actions. The queue count badge on the admin dashboard navigation updates in real time.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-018-006: Account farming and duplicate detection

The system SHALL detect and flag: same device fingerprint across multiple accounts, same phone number across multiple accounts, same CNI number across multiple accounts, and multiple registrations from the same IP within 24 hours.

**Acceptance Criterion:** Two accounts registered from the same device fingerprint within 1 hour creates a Trust and Safety flag within 30 seconds. A banned account's device fingerprint appearing on a new registration creates an immediate Orange state flag. Device fingerprints are stored as one-way hashes — raw fingerprint data is never stored or logged.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-018-007: Off-platform bypass monitoring

The system SHALL monitor for off-platform bypass patterns: Tutors with inquiry-to-booking conversion below 20% after 10 or more inquiries, online bookings with no LiveKit session data, and home sessions with implausible check-in/check-out timestamps (check-out within 10 minutes of check-in for a 60-minute session).

**Acceptance Criterion:** A Tutor whose inquiry conversion drops below 20% after 10 inquiries creates a Yellow flag within 30 seconds. An online booking marked as completed with no LiveKit room event creates an Admin investigation flag within 5 minutes of the completion event. A home session with less than 10 minutes between check-in and check-out for a 60-minute booking creates a flag within 5 minutes of check-out.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 19: Admin Dashboard

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-019-001: Separate admin frontend

The system SHALL serve the admin dashboard as a separate frontend application at `admin.mentora.cm`. Any role other than Admin, Moderator, Super Admin, or Support Agent attempting to access the subdomain SHALL receive 403 before any page loads. Admin dashboard routes and components SHALL be completely separate from the main user application.

**Acceptance Criterion:** An authenticated Parent navigating to `admin.mentora.cm` receives 403. An authenticated Admin accesses the dashboard successfully. The admin frontend build produces a separate deployable artifact from the main user frontend. No admin routes or components are accessible from the main app domain.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-019-002: Role-gated navigation sections

The system SHALL hide admin dashboard navigation sections the current user's role cannot access. Role-gated sections SHALL return 403 on direct API access regardless of frontend visibility.

|Section|Roles with Access|
|---|---|
|KYC & Verification|Admin, Super Admin|
|User Management|Admin, Super Admin, Support Agent|
|Bookings|Admin, Super Admin, Support Agent|
|Payments & Escrow|Admin, Super Admin|
|Disputes|Admin, Super Admin|
|Trust & Safety|Admin, Super Admin, Moderator|
|Ratings & Moderation|Admin, Super Admin, Moderator|
|Notifications|Admin, Super Admin|
|Platform Configuration|Super Admin only|
|Audit Logs|Admin, Super Admin|

**Acceptance Criterion:** A Moderator navigating directly to the Payments section URL receives 403. A Support Agent accessing the Disputes section API endpoint receives 403. Hidden navigation items are absent from the DOM — not just visually hidden.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-019-003: Global search

The system SHALL provide a global search bar that searches across users, bookings, payments, and disputes simultaneously, returning categorised results.

**Acceptance Criterion:** Searching a user's email returns their account in the users category. Searching a booking ID returns that booking in the bookings category. Searching a receipt reference number returns the transaction in the payments category. Results are returned within 1 second for queries under 50 characters.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-019-004: KYC queue and review interface

The system SHALL display the KYC queue sorted into three sections (System Recommends Approve, System Recommends Review, New Documentation Required) with SLA indicators. The review interface SHALL enforce the 60-second disable and mandatory checklist as defined in Module 9.

**Acceptance Criterion:** Applications exceeding the SLA threshold are visually distinct from in-progress applications. The approve button is disabled for 60 seconds server-side after the application is opened. All checklist items must be submitted as part of the approve request body — missing checklist items return 400.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-019-005: User management

The system SHALL provide full user profile views for Admin and Support Agent including: private profile data, KYC history, booking history, payment history, wallet balances, dispute history, review history, risk score history, audit log entries, and active sessions. Admin actions: issue warning, suspend, lift suspension, issue permanent ban, force password reset, terminate all sessions, adjust storage quota.

**Acceptance Criterion:** Searching a user by phone number returns their full profile to Admin within 2 seconds. An Admin suspending a user invalidates all their active sessions within 5 seconds. A Support Agent accessing a user profile cannot see the suspension action button. All Admin actions on user profiles are recorded in the audit log.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-019-006: Finance dashboard

The system SHALL display the following financial data in real time: Parent wallet balances total, Tutor wallet balances total, escrow balance total, commission balance, available NotchPay merchant wallet balance, NotchPay withdrawal threshold, pending payouts count, failed withdrawal queue, and full payment ledger with filters.

**Acceptance Criterion:** The three balance categories (escrow, tutor wallets, commission) sum to the total NotchPay merchant wallet balance within a 5-minute reconciliation window. The failed withdrawal queue shows all failed payouts with Support Agent action buttons. Super Admin withdrawing platform commission produces an audit log entry within 5 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-019-007: Platform configuration

The system SHALL allow Super Admin to configure the following settings without a code change or deployment: commission mode, per-session commission percentage, monthly fee amount, wallet minimum top-up floor (cannot go below `WALLET_MIN_TOPUP` env var), Tutor payout cooling-off period, Parent cancellation window, payment window after acceptance, auto-release window, search ranking weights, risk score signal point values, risk state thresholds, review window duration, KYC SLA thresholds, dispute SLA thresholds, session overlap threshold, city allowlist, subject taxonomy, content filter keyword list, downloadability toggles per content type, and feature flags.

**Acceptance Criterion:** Changing the per-session commission percentage takes effect on new bookings within 60 seconds with no deployment. Changing the search ranking weights takes effect on the next search result computation. Setting the wallet minimum top-up to a value below the `WALLET_MIN_TOPUP` environment variable returns 400. Every configuration change is recorded in the audit log.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 19.5: Support Tickets

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-019.5-001: Support ticket creation

The system SHALL allow any authenticated user to open a support ticket from their account settings. Tickets SHALL include: category (dropdown), subject (max 100 characters), description (min 50 characters, max 2000 characters), and optional file attachments (max 3 files, 5MB each via Module 8). Tickets SHALL be automatically linked to the user's account, booking history, payment history, and wallet balance for Support Agent context.

**Acceptance Criterion:** A ticket submitted without a description of minimum 50 characters returns 400. A valid ticket creates a support ticket entry and notifies a Support Agent within 5 minutes via in-app notification. The ticket is automatically linked to the submitting user's account data. A Guest cannot submit a support ticket — 401 is returned.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-019.5-002: Support ticket queue and response

The system SHALL provide Support Agents with a ticket queue sorted by: open tickets oldest first, then pending user response, then resolved. Support Agents SHALL be able to respond to tickets, request additional information, escalate to Admin, and mark as resolved.

**Acceptance Criterion:** A Support Agent responding to a ticket notifies the submitting user within 30 seconds via in-app and email. Escalating a ticket to Admin creates an Admin notification within 30 seconds. Marking a ticket as resolved notifies the user within 30 seconds. A resolved ticket can be reopened by the user within 7 days of resolution.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-019.5-003: Failed payout support tickets

The system SHALL automatically create a support ticket when a Tutor withdrawal fails. The ticket SHALL be pre-populated with the withdrawal amount, destination account, failure reason from NotchPay, and the Tutor's registered payout accounts. Support Agents SHALL be able to initiate a manual payout retry from the ticket.

**Acceptance Criterion:** A failed payout creates a support ticket within 30 seconds. The ticket appears in the Support Agent queue with all pre-populated fields. A Support Agent initiating a manual retry from the ticket triggers a new NotchPay payout attempt within 5 seconds. The retry attempt and outcome are recorded in the audit log.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-019.5-004: Pending reconciliation support tickets

The system SHALL automatically create a support ticket when a payment moves to `pending_reconciliation` status. The ticket SHALL contain the payment initiation details, the NotchPay query result, and the Parent's wallet balance for Support Agent investigation.

**Acceptance Criterion:** A `pending_reconciliation` payment creates a support ticket within 30 seconds. The ticket contains the NotchPay transaction ID and query result. The Support Agent can manually resolve the ticket by marking the payment as confirmed or failed, which triggers the appropriate wallet and escrow updates within 5 seconds.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 20: Analytics & Reporting

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-020-001 — Pre-computed analytics snapshots

The system SHALL pre-compute all dashboard analytics metrics via a background job running every hour and store results in an `analytics_snapshots` table. Live dashboard loads SHALL read from snapshots — never from raw aggregation queries at request time.

**Acceptance Criterion:** The analytics dashboard loads within 500ms for p95 of requests. With the snapshot job artificially stopped for 2 hours, the dashboard still loads but displays a "last updated X hours ago" indicator. The snapshot job has a dead man's switch alert in the observability system.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-020-002 — Revenue metrics

The system SHALL display on the analytics dashboard: total revenue today, this week, this month, and all time; revenue by top 5 cities; revenue by top 10 subjects; average transaction value this month; commission earned vs total transacted ratio; and month-over-month revenue growth rate.

**Acceptance Criterion:** Revenue figures match the payment ledger in Module 13 within the snapshot refresh window (max 1 hour). Month-over-month growth rate is accurate to two decimal places. All figures update within 60 minutes of transactions occurring.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-020-003: User metrics

The system SHALL display: total registered users by role, new registrations today/this week/this month by role, active users this month (at least one booking in last 30 days), Tutor KYC approval rate, user retention rate, and geographic distribution by city.

**Acceptance Criterion:** Total user counts match the users table count within the snapshot window. Active user count correctly excludes users with no bookings in the last 30 days. KYC approval rate correctly calculates approved applications as a percentage of total applications including all statuses.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-020-004: Demand signal dashboard

The system SHALL display unmet demand signals from Module 10 zero-results searches: subjects with zero-result searches ranked by frequency, cities with zero-result searches ranked by frequency, and notify-me opt-in counts per subject and city combination. Data SHALL be exportable as CSV.

**Acceptance Criterion:** A zero-result search creates a demand signal entry within 60 seconds. The demand signal dashboard reflects the entry within the snapshot window. Exporting the demand signal data produces a CSV containing subject, city, search count, and notify-me opt-in count columns.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-020-005: On-demand reports

The system SHALL allow Super Admin and Admin to generate custom reports by selecting report type, date range, and filters. Reports SHALL be generated as background jobs and delivered as downloadable CSV or PDF files. Reports SHALL be available for download for 7 days. Every report generation SHALL be recorded in the audit log.

**Acceptance Criterion:** A custom report request creates a background job and notifies the requester when complete within 10 minutes for standard date ranges. The download link is accessible for exactly 7 days then returns 404. The audit log entry for the report generation contains the requester's ID, report type, filters, date range, and timestamp.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-020-006: Scheduled reports

The system SHALL allow Super Admin to configure scheduled reports with: report type, schedule (daily/weekly/monthly), rolling date range, recipient email addresses, and format (CSV or PDF). Scheduled report runs SHALL be logged. Failures SHALL trigger an observability alert and Super Admin notification.

**Acceptance Criterion:** A scheduled weekly report delivers to the configured email addresses within 30 minutes of the scheduled time. A failed scheduled report delivery triggers an observability alert within 5 minutes and a Super Admin in-app notification within 30 minutes. The scheduled report run is recorded in the audit log regardless of success or failure.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-020-007: Tutor performance reports

The system SHALL generate individual Tutor performance reports accessible to Admin and Super Admin containing: total sessions completed, average rating breakdown, rebooking rate, dispute rate and outcomes, revenue generated, most booked subjects, response rate, and availability utilisation.

**Acceptance Criterion:** A Tutor performance report is generated within 30 seconds of request. All metrics are accurate to the last completed transaction and review. The report is accessible to Admin from the User Management section. Tutors cannot access other Tutors' performance reports — only their own simplified version from their dashboard.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 2: Platform Observability & Product Analytics

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-021-001: PostHog event tracking

The system SHALL track all defined PostHog events using a shared `analytics.track(event, properties)` helper. All events SHALL include standard properties: hashed user ID, user role, session ID, platform, city, and timestamp. No sensitive fields SHALL be included in any event.

**Acceptance Criterion:** Every tracked event appears in PostHog within 30 seconds of the user action. A CI check fails on any direct PostHog SDK call outside the analytics helper. An integration test confirms no PII (phone number, email, raw user ID, CNI number) appears in any PostHog event payload.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-021-002: Pre-configured PostHog funnels

The system SHALL have the following funnels pre-configured in PostHog before launch: Parent onboarding funnel, Tutor onboarding funnel, search-to-booking funnel, and session completion funnel. Each funnel SHALL be filterable by city, subject, session type, and user cohort.

**Acceptance Criterion:** Each funnel is visible in the PostHog dashboard before go-live. Drop-off rates at each step are accurately calculated from real event data within 24 hours of user activity. Filtering a funnel by city returns only events from users with that city on their profile.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-021-003: Session recordings and heatmaps

The system SHALL enable PostHog session recording for all users with all sensitive form fields masked. Recordings SHALL be retained for 30 days. PostHog heatmaps SHALL be enabled on: search results page, Tutor profile page, booking flow pages, session room page, and dashboard home screens.

**Acceptance Criterion:** A session recording for a user who submitted a payment form shows the payment input fields as masked. Recordings are automatically deleted after 30 days. Heatmaps for all five key pages show click density data within 24 hours of user activity on those pages.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-021-004: Prometheus metrics collection

The system SHALL expose application metrics to Prometheus via `prom-client`. Prometheus SHALL scrape metrics every 15 seconds. The following metrics SHALL be tracked: request count per endpoint, response time histogram (p50/p95/p99) per endpoint, error rate per endpoint, CPU usage, memory usage, disk usage, database connection pool, Redis hit rate, and external service response times.

**Acceptance Criterion:** All defined metrics are visible in Grafana within 30 seconds of application startup. A simulated CPU spike to 95% appears in the Grafana system overview dashboard within 60 seconds. External service metrics correctly reflect response times from NotchPay, LiveKit, Resend, and WhatsApp API.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-021-005: Background job dead man's switches

The system SHALL register a heartbeat in Redis on every successful completion of each critical background job. Prometheus SHALL monitor each heartbeat and fire an alert if a job has not run within its expected window.

|Job|Expected Window|
|---|---|
|Escrow auto-release|Every 5 minutes|
|Session reminder scheduler|Every 5 minutes|
|Risk score decay|Every 24 hours|
|Analytics snapshot|Every hour|
|KYC SLA escalation|Every 30 minutes|
|Tutor boost expiry|Every hour|
|Review window close|Every hour|
|Scheduled reports|Every hour|
|Hard delete (30-day files)|Every 24 hours|
|Monthly fee deduction|Every 24 hours|

**Acceptance Criterion:** Stopping any critical background job triggers a Grafana alert within the expected window plus 5 minutes. The alert is delivered to the developer within 10 minutes of the job missing its heartbeat. Restarting the job clears the alert within the next expected window.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-021-006: Grafana alerting rules

The system SHALL have the following Grafana alerts configured before go-live:

Warning alerts (investigate when possible):

- CPU above 70% for 10 minutes
- Memory above 75% for 10 minutes
- Disk above 70% capacity
- p95 response time above 1 second on any endpoint for 5 minutes
- Error rate above 0.5% on any endpoint for 5 minutes
- Redis hit rate below 80%

Critical alerts (investigate immediately):

- CPU above 90% for 5 minutes
- Memory above 90% for 5 minutes
- Disk above 85% capacity
- Any payment endpoint returning 5xx errors
- Any background job missing heartbeat
- Database connection pool exhausted
- Application process restart detected
- p95 response time above 2 seconds on payment or booking endpoints

**Acceptance Criterion:** Each alert condition when simulated in staging triggers a developer notification within 10 minutes. All alerts are configured in version-controlled Grafana configuration files before go-live. Critical alerts deliver via both email and developer WhatsApp number.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-021-007: Sentry error tracking

The system SHALL have Sentry configured on both the Node.js backend and React frontend before the first production deployment. Every unhandled exception SHALL be captured with full stack trace and request context. PII scrubbing rules SHALL strip phone numbers, email addresses, and payment data from all error reports. Source maps SHALL be uploaded on every deployment.

**Acceptance Criterion:** An intentionally thrown unhandled error in production appears in Sentry within 60 seconds with a readable stack trace pointing to the original source file. The same error occurring 100 times appears as one issue with a count of 100. A simulated error containing a phone number has the phone number absent from the Sentry report. A new deployment creates a new Sentry release and subsequent errors are attributed to that release.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

### Module 22: Learning Analytics

**Module Summary**

|Milestone|Status|
|---|---|
|All implementations complete|[ ]|
|All unit tests passing|[ ]|
|All integration tests passing|[ ]|
|Load test passing|[ ]|
|Deployed to staging|[ ]|
|QA sign-off|[ ]|
|Deployed to production|[ ]|
|Client demo completed|[ ]|

---

#### REQ-022-001: Analytics snapshot computation

The system SHALL compute learning analytics from existing records in Modules 11, 8.5, 17, and 7. Computed analytics SHALL be stored in a `learning_analytics_snapshots` table updated by a background job every 24 hours. No analytics SHALL be computed at query time.

**Acceptance Criterion:** The learning analytics dashboard loads within 500ms for p95 of requests. Snapshots reflect data within 24 hours of the underlying records changing. The snapshot job has a dead man's switch alert in the observability system.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-022-002: Data scoping

The system SHALL scope all learning analytics strictly by user. A Parent SHALL only see analytics for their own student profiles. A Tutor SHALL only see analytics for their own students. No cross-user data SHALL be accessible.

**Acceptance Criterion:** A Parent requesting analytics for a student profile they do not own receives 403. A Tutor requesting analytics for a student they have never had a booking with receives 403. A Parent can see analytics for all their own student profiles in a single dashboard response.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-022-003: Parent and student learning dashboard

The system SHALL provide the following analytics for each student profile: sessions completed this month per subject, learning streak (consecutive weeks with at least one session), session frequency trend (sparkline over 6 months), consistency score per subject (percentage of weeks with at least one session in last 3 months), topics covered log (populated from tutor lesson plans), materials accessed ratio (unique materials opened vs total available), last material accessed (date and title), and tutor engagement trend (improving/stable/declining — only after 3 sessions with the same Tutor).

**Acceptance Criterion:** Learning streak correctly counts consecutive weeks with at least one completed session and resets to 0 on a missed week. Topics covered only displays entries linked to published tutor lesson plans. Materials ratio correctly counts unique materials — opening the same material multiple times counts as 1. Engagement trend is absent from the response when fewer than 3 sessions exist with the same Tutor.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-022-004: Tutor teaching effectiveness dashboard

The system SHALL provide the following analytics for Tutors: per-student engagement overview (sessions completed, last session date, materials accessed ratio, engagement trend, rebooking status), subject rebooking rate per subject, average sessions before student churn per subject, materials access rate per subject, sessions per week trend (12 weeks), and student retention rate (percentage who booked a second session).

**Acceptance Criterion:** Rebooking status correctly categorises students as active (booked in last 30 days), dormant (31-60 days), or churned (60+ days). Subject rebooking rate correctly calculates second session bookings as a percentage of first session bookings per subject. Student data from sessions with other Tutors is absent from the Tutor's view — only their shared history is shown.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-022-005: Constructive framing enforcement

The system SHALL use only constructive and neutral language across all learning analytics. No letter grades, percentage scores as pass/fail indicators, or judgment labels SHALL appear. Trend indicators SHALL use: improving, stable, or declining only. Empty states SHALL use encouraging language.

**Acceptance Criterion:** A code review check confirms no judgment language (good, bad, poor, excellent, failing) appears in learning analytics UI text strings. Empty state messages for all analytics components use encouraging language as defined in the translation files. A QA review of all analytics screens confirms no score is presented as a pass/fail indicator.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

---

#### REQ-022-006: Platform learning health aggregates for Module 20

The system SHALL compute the following anonymised aggregate signals and send them to the Module 20 analytics snapshots: platform-wide average sessions before student churn per subject, correlation between material upload frequency and student rebooking rate, correlation between session consistency and rebooking rate, average topics covered before student churn, and subjects with highest learning streaks.

**Acceptance Criterion:** Aggregate signals contain no individual user identifiers — an integration test confirms this before any signal is written to Module 20 snapshots. Aggregate signals are visible in the Module 20 Learning Health section of the Super Admin analytics dashboard. Signals update within 24 hours of underlying data changes.

|DB|API|Impl|UT|IT|STG|PROD|
|---|---|---|---|---|---|---|
|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|[ ]|

## 4. External Interface Requirements

### 4.1 User Interfaces

#### 4.1.1 Main Web Application

- The main application SHALL be a React single-page application served at the root domain
- The application SHALL be fully usable on Chrome, Firefox, Safari, and Edge on desktop and mobile browsers
- A React Native Mobile application that runs on Android and IOS
- The application SHALL be responsive: all pages SHALL be usable on screen widths from 320px (small mobile) to 2560px (large desktop)
- The application SHALL be usable on a 2G or slow 3G connection: key pages (search, tutor profile, booking flow) SHALL load within 5 seconds on a simulated slow 3G connection
- All images SHALL be served in WebP format with responsive sizes: never raw uploads
- All images below the fold SHALL use lazy loading
- The application SHALL support French and English with the language switchable from any page
- No page SHALL show a blank screen to the user: empty states, loading states, and error states SHALL always render something meaningful

#### 4.1.2 Admin Dashboard

- The admin dashboard SHALL be a separate React application served at `admin.mentora.cm`
- The admin dashboard SHALL be optimised for desktop use — minimum supported screen width is 1024px
- The admin dashboard SHALL support French and English
- The admin dashboard SHALL never be indexed by search engines — `robots.txt` SHALL disallow all crawlers on the admin subdomain

#### 4.1.3 React Native Mobile Application

- The mobile application is a future phase deliverable — the current build is web only
- All backend APIs SHALL be designed to support React Native clients from day one — no web-only assumptions in API design
- LiveKit token generation, media signed URLs, and WebSocket connections SHALL work identically for React Native clients

---

### 4.2 Hardware Interfaces

#### 4.2.1 VPS Infrastructure

- The system SHALL run on a Linux VPS (Ubuntu 24 LTS) with minimum 2 vCPU and 4GB RAM for the initial launch
- All services SHALL run in Docker containers managed by Docker Compose
- The same Docker Compose configuration SHALL work on any VPS provider — no cloud-provider-specific dependencies
- Upgrading VPS specs or migrating to a different host SHALL require only infrastructure-level changes — no application code changes

#### 4.2.2 Camera and Microphone

- The live session module SHALL request camera and microphone permissions from the browser before entering a session room
- Permission denial SHALL display a clear translatable error with instructions to enable permissions in browser settings
- Device selection (camera, microphone, speaker) SHALL be available on the pre-join screen

---

### 4.3 Software Interfaces

All third-party services used by the system are listed below with their purpose, tier, and upgrade path.

|Service|Purpose|Tier at Launch|Upgrade Path|
|---|---|---|---|
|Clerk|Authentication, OAuth, session management|Free (under 10,000 MAU)|Paid per MAU when exceeded|
|NotchPay|MTN MoMo and Orange Money payments|Pay per transaction|Volume pricing at scale|
|LiveKit (self-hosted)|Video session infrastructure|Free (self-hosted)|LiveKit Cloud if VPS cannot handle load|
|Resend|Transactional email delivery|Free (3,000/month, 100/day)|Paid plan when exceeded|
|WhatsApp Cloud API|WhatsApp notifications|Free (1,000 conversations/month)|Pay per conversation when exceeded|
|Firebase Cloud Messaging|Push notifications|Free (no meaningful limits)|No upgrade needed|
|Interserver Object Storage|File and media storage|Client's existing plan|Upgrade storage plan at scale|
|Cloudflare|CDN for media delivery|Free tier|Pro plan at scale|
|PostHog (self-hosted)|Product analytics and session recording|Free (self-hosted)|PostHog Cloud if self-hosting becomes complex|
|Grafana + Prometheus (self-hosted)|Infrastructure observability|Free (self-hosted)|No upgrade needed|
|Grafana Loki + Promtail (self-hosted)|Application log aggregation|Free (self-hosted)|No upgrade needed|
|Sentry|Error tracking|Free tier (5,000 errors/month)|Paid plan or self-hosted at scale|
|Flagsmith (self-hosted)|Feature flags|Free (self-hosted)|Flagsmith Cloud if needed|
|Tolgee (self-hosted)|Translation management|Free (self-hosted)|Tolgee Cloud if needed|
|ClamAV (self-hosted)|Virus scanning for file uploads|Free (self-hosted)|No upgrade needed|
|Redis|Caching, rate limiting, session store, job coordination|Free (self-hosted)|Redis Cloud at scale|
|PostgreSQL|Primary database|Free (self-hosted)|Managed PostgreSQL at scale|

---

### 4.4 Communication Interfaces

#### 4.4.1 HTTPS

- All communication between clients and the server SHALL use HTTPS exclusively
- HTTP requests SHALL be redirected to HTTPS at the infrastructure level
- TLS version 1.2 or higher SHALL be enforced — TLS 1.0 and 1.1 SHALL be disabled
- SSL certificates SHALL be managed via Let's Encrypt with automatic renewal

#### 4.4.2 REST API

- The backend SHALL expose a RESTful API documented in OpenAPI 3.0 format
- All API endpoints SHALL be prefixed with `/api/v1/`
- API versioning SHALL be path-based: future breaking changes use `/api/v2/` without removing `/api/v1/`
- All request and response bodies SHALL use JSON with `Content-Type: application/json`
- All timestamps SHALL use ISO 8601 format in UTC
- All monetary amounts SHALL be integers in XAF (no decimals: XAF has no subunit)
- All IDs SHALL be UUIDs

#### 4.4.3 WebSocket

- Real-time features (messaging, notifications, booking request updates, dashboard counts) SHALL use Socket.io over WebSocket
- Socket.io SHALL fall back to long polling when WebSocket is unavailable
- All Socket.io connections SHALL require a valid session token before joining any room
- Socket.io connections SHALL be load-balanced across VPS instances using Redis adapter when horizontal scaling is applied

#### 4.4.4 Webhooks

- The system SHALL expose webhook endpoints to receive events from: NotchPay (payment confirmation, payout status), WhatsApp Cloud API (message delivery status, opt-out events), Resend (email delivery status), LiveKit (room events, participant events)
- All incoming webhooks SHALL validate the provider's signature before processing
- Webhook processing SHALL be idempotent — receiving the same webhook event twice SHALL not produce duplicate state changes
- Failed webhook processing SHALL be retried up to 3 times with exponential backoff
- Webhook endpoints SHALL respond with 200 within 5 seconds — heavy processing SHALL be offloaded to background jobs

#### 4.4.5 Background Jobs

- All background jobs SHALL use a Redis-backed job queue (Bull or BullMQ)
- Job definitions SHALL include: job type, payload schema, retry configuration, and dead man's switch heartbeat interval
- Failed jobs SHALL be moved to a dead letter queue after exhausting retries
- Dead letter queue contents SHALL be visible to Super Admin in the admin dashboard
- The job queue dashboard SHALL be accessible to developers at an internal URL protected by HTTP basic auth

---

## 5. Non-Functional Requirements

### 5.1 Performance

|Requirement|Target|Measurement Method|
|---|---|---|
|Search endpoint response time|p95 under 500ms under 100 concurrent requests|k6 load test|
|General API endpoint response time|p95 under 2 seconds under normal load|Prometheus/Grafana|
|Payment endpoint response time|p95 under 600ms under normal load|Prometheus/Grafana|
|Dashboard load time|p95 under 500ms|Prometheus/Grafana|
|Real-time notification delivery|Under 2 seconds via WebSocket|Integration test|
|Escrow release on confirmation|Under 5 seconds|Integration test|
|KYC status change visibility|Under 5 seconds|Integration test|
|Search results page load on slow 3G|Under 5 seconds|Browser DevTools throttling|
|API response payload for listing endpoints|Under 200KB|API contract test|
|File upload pipeline completion|Under 60 seconds for files under 50MB|Integration test|
|Video transcoding (720p, under 200MB)|Under 10 minutes|Integration test|

---

### 5.2 Security

- All passwords SHALL be hashed using bcrypt with a minimum cost factor of 12 — Clerk handles this
- All session tokens SHALL be signed JWTs stored in httpOnly cookies — Clerk handles this
- No sensitive data (passwords, payment credentials, CNI numbers, full phone numbers) SHALL ever appear in application logs
- All KYC documents SHALL be stored in a private storage bucket and served exclusively via signed URLs
- All API endpoints SHALL validate the session token and check RBAC permissions before executing any business logic
- SQL injection and NoSQL injection SHALL be prevented by parameterised queries — no raw query string construction from user input
- All file uploads SHALL be virus-scanned by ClamAV before becoming accessible
- MIME type validation SHALL use file content — not file extension or Content-Type header
- The admin dashboard SHALL only be accessible from known developer IP addresses in addition to role authentication
- All third-party API credentials SHALL be stored in environment variables — never in code or version control

---

### 5.3 Reliability and Availability

|Requirement|Target|
|---|---|
|Platform uptime|99.5% measured monthly|
|Scheduled maintenance window|Maximum 2 hours per month, announced 48 hours in advance|
|Recovery Time Objective (RTO)|Under 1 hour for critical failures|
|Recovery Point Objective (RPO)|Maximum 24 hours of data loss in worst case|
|Database backup frequency|Daily automated backups retained for 30 days|
|Audit log backup frequency|Daily automated backups to separate storage, retained for 2 years|
|Background job failure visibility|All failures visible in dead letter queue within 5 minutes|

---

### 5.4 Scalability

- The system SHALL be containerised via Docker from day one — moving to a higher-spec VPS or different host requires only infrastructure changes
- The database schema SHALL use UUIDs as primary keys to support horizontal database scaling without ID conflicts
- The caching layer (Redis) SHALL be external to the application containers — allows scaling without losing cache state
- The file storage layer (Interserver S3-compatible) SHALL be external to the VPS — storage scales independently of compute
- Feature flags SHALL allow new features to be deployed and enabled progressively without a big-bang release
- The city allowlist flag SHALL allow geographic expansion without a code change or deployment

---

### 5.5 Maintainability

- All code SHALL be written in TypeScript — no plain JavaScript in production code
- Every module SHALL have its own directory with consistent structure: `routes/`, `services/`, `repositories/`, `types/`, `tests/`
- No module SHALL import directly from another module's internal files — inter-module communication goes through defined service interfaces
- Every API endpoint SHALL be documented in the OpenAPI spec before implementation
- Every environment variable SHALL be documented in a `.env.example` file with a comment explaining its purpose
- Any engineer SHALL be able to clone the repository and have the full development environment running locally within 15 minutes by following the README
- ADRs (Architecture Decision Records) SHALL be written for every significant technical decision and stored in `docs/ADRs/`

---

### 5.6 Testability

|Test Type|Coverage Target|Tool|
|---|---|---|
|Unit tests|All service layer functions|Jest|
|Integration tests|All API endpoints|Jest + Supertest|
|Contract tests|All external integrations (NotchPay, LiveKit, Resend, WhatsApp)|Jest|
|End-to-end tests|All critical user flows|Playwright|
|Load tests|All p95 performance targets|k6|
|Security header tests|All endpoints|Automated scan|

- Every requirement in this SRS SHALL have at least one corresponding test
- A feature with no test SHALL not be merged to main — enforced by CI pipeline
- The test database SHALL be a separate PostgreSQL instance seeded with known test data — never the production database
- All tests SHALL run in under 10 minutes in the CI pipeline — tests exceeding this target SHALL be parallelised

---

### 5.7 Localisation

- French and English SHALL be supported from day one
- All user-facing strings SHALL use the `t('namespace.key', 'fallback')` helper — no hardcoded strings
- All monetary amounts SHALL display in XAF with locale-appropriate formatting
- All dates SHALL display in locale-appropriate format (DD/MM/YYYY for French, MM/DD/YYYY for English)
- The system SHALL be architected to support additional languages without code changes

---

### 5.8 Low Bandwidth Optimisation

- All API responses for listing and search endpoints SHALL be under 200KB
- All images SHALL be served in WebP format via Cloudflare CDN
- All images SHALL have responsive sizes — the browser receives the appropriate size for the viewport, not a full-resolution image
- All images below the fold SHALL use lazy loading
- Video streaming SHALL use range requests — the browser buffers progressively rather than downloading the full file
- Audio streaming SHALL use range requests
- The search results page, tutor profile page, and booking flow pages SHALL be usable on a simulated slow 3G connection (750kbps) within 5 seconds

---

## 6. Other Requirements

### 6.1 Legal and Compliance

- All personal data collected SHALL be used only for the purposes described in the platform's Privacy Policy
- KYC documents (CNI photos, degree certificates) SHALL be retained for a minimum of 2 years for regulatory purposes — soft deletion is used, physical deletion requires Super Admin action
- Payment transaction records SHALL be retained permanently — they are never deleted, only anonymised if the associated account is deactivated after the 30-day grace period
- Audit log entries SHALL be retained for a minimum of 2 years with cold storage archival after that period
- The platform SHALL never store raw passwords — Clerk handles all credential storage
- The platform SHALL never store raw MoMo/Orange Money PINs or payment credentials — NotchPay handles all payment credential processing
- WhatsApp opt-in consent SHALL be stored with a timestamp per user — proof of consent is retained for the lifetime of the account
- The platform SHALL comply with Meta's WhatsApp Business Policy for template messaging

### 6.2 Data Retention Summary

|Data Type|Retention Period|Deletion Method|
|---|---|---|
|User personal data (active account)|Indefinite while account is active|N/A|
|User personal data (deactivated account)|30-day grace period then anonymised|Background job|
|KYC documents|Minimum 2 years from submission|Super Admin action only|
|Payment transaction records|Permanent|Never deleted|
|Audit log entries|2 years hot, then cold storage|Background job archives|
|Application logs|30 days|Automatic Loki expiry|
|Soft-deleted files|30 days|Background hard-delete job|
|Read notifications|90 days|Background cleanup job|
|Blocked message attempts (moderation log)|1 year|Background cleanup job|
|Session recordings (when enabled)|Defined by client — TBD|TBD|
|PostHog session recordings|30 days|Automatic PostHog expiry|

### 6.3 Financial Compliance

- Every payment transaction SHALL generate a PDF receipt with a unique verifiable reference number
- Tutor earnings statements SHALL be available for any date range on demand
- The platform commission ledger SHALL be separately tracked and never commingled with escrow funds in the ledger (though both sit in the same NotchPay merchant wallet)
- All commission withdrawals by Super Admin SHALL be recorded in the audit log with amount and destination

### 6.4 Content Policy

- The platform content filter SHALL block contact information sharing in all user-generated text fields that could facilitate off-platform bypass
- Tutors SHALL only be permitted to teach subjects backed by an Admin-approved credential
- Materials that violate platform policy SHALL be soft-deleted with the evidence retained for dispute purposes
- The platform SHALL maintain a terms of service and privacy policy in both English and French accessible from all pages

---

## 7. Appendices

### Appendix A: Module Dependency Map

The following table shows which modules each module depends on. A module cannot be implemented until all its dependencies are complete.

| Module                                         | Depends On               |
| ---------------------------------------------- | ------------------------ |
| 1. Authorization & RBAC                        | None                     |
| 2. Localization (i18n)                         | None                     |
| 3. Rate Limiting & API Security                | 1                        |
| 4. Feature Flags                               | 1                        |
| 5. Audit Logs & Application Logging            | 1, 2                     |
| 6. Authentication & Identity                   | 1, 2, 3, 5               |
| 6.5. Dashboards & Home Screens                 | 6, 7, 11, 13, 15, 16, 17 |
| 7. User Profiles                               | 6, 8                     |
| 8. Media Management & CDN                      | 1, 3                     |
| 8.5. Learning Materials                        | 7, 8, 11                 |
| 9. Tutor Onboarding & KYC                      | 7, 8, 12                 |
| 10. Tutor Discovery & Search                   | 7, 9                     |
| 11. Booking & Scheduling                       | 7, 10, 12, 13            |
| 12. Notifications                              | 2, 6                     |
| 13. Payments & Escrow                          | 6, 11, 12                |
| 14. Live Sessions (LiveKit)                    | 11, 12                   |
| 15. Messaging                                  | 6, 11, 12                |
| 16. Lesson Confirmation & Disputes             | 11, 13, 14, 15           |
| 17. Ratings & Reviews                          | 16                       |
| 18. Trust & Safety & Fraud Detection           | 15, 13, 17               |
| 19. Admin Dashboard                            | 9, 11, 13, 16, 17, 18    |
| 19.5. Support Tickets                          | 6, 13, 19                |
| 20. Analytics & Reporting                      | 11, 13, 16, 17, 10       |
| 21. Platform Observability & Product Analytics | All modules              |
| 22. Learning Analytics                         | 11, 8.5, 17, 7           |

---

### Appendix B: Tech Stack Decisions

All Architecture Decision Records are stored in `docs/ADRs/` in the repository. The following is a summary.

|Decision|Choice|Reason|
|---|---|---|
|Authentication|Clerk|Free under 10k MAU, handles OAuth and session management, swappable later|
|Payments|NotchPay|Single integration for both MTN MoMo and Orange Money, Cameroon-native|
|Video|LiveKit (self-hosted)|Open source Apache 2.0, production-grade, free self-hosted, same code if migrating to LiveKit Cloud|
|Email|Resend|Best-in-class Node.js SDK, 3,000/month free tier, excellent deliverability|
|Push notifications|Firebase Cloud Messaging|Free with no meaningful limits, works for web and React Native|
|WhatsApp notifications|WhatsApp Cloud API|Free 1,000 conversations/month, replaces SMS entirely for Cameroon|
|Feature flags|Flagsmith (self-hosted)|Open source, self-hostable, same API if migrating to Flagsmith Cloud|
|Translations|i18next + Tolgee (self-hosted)|Industry standard i18n library, Tolgee provides UI management, both free|
|Product analytics|PostHog (self-hosted)|Open source, self-hostable, full funnel and session recording, free|
|Infrastructure observability|Grafana + Prometheus + Loki (self-hosted)|Industry standard stack, entirely free, runs on same VPS|
|Error tracking|Sentry|Industry standard, free tier sufficient for launch|
|Database|PostgreSQL|Industry standard relational database, migration-based, scales well|
|Cache|Redis|Industry standard, used for sessions, rate limiting, job queues, feature flag cache|
|ORM|Prisma|TypeScript-first, migration-based, excellent DX|
|Background jobs|BullMQ (Redis-backed)|TypeScript-native, reliable, observable|
|File storage|Interserver S3-compatible|Client's existing plan, S3-compatible API means standard AWS SDK works|
|CDN|Cloudflare free tier|Global edge network with African POPs, free|
|Virus scanning|ClamAV (self-hosted)|Open source, runs on VPS, free|
|ERD and schema documentation|dbdiagram.io + dbdocs.io|DBML-based, generates SQL, shareable documentation, version controllable|
|Runtime|Node.js with TypeScript|Team expertise, strong ecosystem, excellent for I/O-heavy workloads|
|API framework|Express.js|Mature, well-understood, minimal magic|
|Frontend framework|React|Team expertise, large ecosystem, LiveKit has first-class React support|
|Mobile framework|React Native (future phase)|Code sharing with web, LiveKit has official React Native SDK|
|Containerisation|Docker + Docker Compose|Industry standard, VPS-portable, same artifact from dev to prod|

---

### Appendix C — Open Questions Pending PM Confirmation

The following questions were sent to the PM and client. Items marked RESOLVED have been answered. Items marked PENDING are still awaited.

|#|Question|Status|Answer|
|---|---|---|---|
|1|Where does payment sit and who has access|RESOLVED|Mentora NotchPay merchant wallet, Mentora only|
|2|Commission model|RESOLVED|Admin-configurable: per-session (default 15%), monthly fee (default 1,000 XAF), or both|
|3|Payment provider risk|RESOLVED|Mentora assists verification only, not liable for provider failures|
|4|Direct payout vs in-app wallet|RESOLVED|Tutor in-app wallet, manual withdrawal|
|5|Wrong/inactive MoMo number|RESOLVED|Tutor contacts support|
|6|Payout timing|RESOLVED|On-demand withdrawal by Tutor|
|7|MoMo transaction fee|RESOLVED|Deducted from Tutor withdrawal amount, shown before confirmation|
|8|Platform commission destination|RESOLVED|Stays in NotchPay merchant wallet, Super Admin withdraws on demand|
|9|Who withdraws commission|RESOLVED|Super Admin through admin dashboard|
|10|Finance dashboard in app|RESOLVED|Yes, required|
|11|Payment window duration|RESOLVED|24 hours|
|12|Slot reopens after cancellation|RESOLVED|Yes|
|13|Multiple session payment|RESOLVED|Parent wallet, can top up and withdraw unused balance|
|14|Tutor cancellation refund|RESOLVED|Automatic full refund to Parent wallet|
|15|Parent cancellation policy|RESOLVED|Full refund if 12+ hours before session, no refund if under 12 hours|
|16|Technical failure during session|RESOLVED|Platform-confirmed outage triggers automatic refund|
|17|Dispute resolution timeline|RESOLVED|5 business days|
|18|Recurring bookings|RESOLVED|Yes, supported|
|19|Session packages|RESOLVED|Per-session pricing only, no packages|
|20|Home tutoring verification|RESOLVED|Both parties check in and check out through the app|
|21|Network drop reconciliation|RESOLVED|System auto-detects, queries NotchPay, creates pending_reconciliation if unknown|
|22|Partial dispute resolution|RESOLVED|All-or-nothing only|
|23|Cross-operator payouts|RESOLVED|Supported via wallet architecture — operator only matters at top-up and withdrawal|
|25|Auto-release on no action|RESOLVED|Auto-release to Tutor after 48 hours|
|26|Multiple payout accounts|RESOLVED|Unlimited accounts, choose at withdrawal time, 48-hour cooling-off on new accounts|
|30|NotchPay withdrawal threshold|RESOLVED|Displayed clearly in admin finance dashboard|

---

### Appendix D: Out of Scope Items

The following items were explicitly excluded from the current build. They may be added in future versions with new scope agreements.

|Feature|Reason for Exclusion|
|---|---|
|AI tutor recommendations|Removed by PM — no defined requirements|
|School partnerships|Removed by PM — no defined requirements|
|Mobile application (React Native)|Explicitly excluded from current timeline — backend APIs designed for React Native compatibility|
|Multi-country support|Future expansion — i18n and city allowlist architecture supports it without code changes|
|SMS notifications|No free tier available for Cameroon — stub implemented, real integration when funded|
|Phone support|No staff infrastructure — in-app support tickets only|
|Learning analytics gamification (badges, streaks display)|Flag-gated, off by default — enabled when client approves|
|Session notes by Tutor post-session|Flag-gated, off by default — enabled when client approves|
|Session recordings surfaced to users|Flag-gated, off by default — LiveKit configured to record from day one|
|Quiz module|Data model designed for, UI not built — enabled via flag when client approves|
|Video call before booking|Rejected — creates off-platform bypass risk, replaced by inquiry messaging|
|Paid learning material collections|Deferred — PM decision: all materials free with any booking. Architecture supports paid collections via feature flag when policy changes|

---

### Appendix E: Pre-Launch Checklist

The following items must be completed before the system goes live in production. These are not code tasks — they are configuration, registration, and legal tasks.

|Task|Owner|Status|
|---|---|---|
|WhatsApp Business account created and verified|Client|[ ]|
|All WhatsApp notification templates submitted to Meta for approval|Developer|[ ]|
|NotchPay merchant account created and verified for Cameroon|Client|[ ]|
|NotchPay API credentials for production obtained|Client|[ ]|
|Clerk production application created|Developer|[ ]|
|Firebase project created and FCM credentials obtained|Developer|[ ]|
|Interserver storage bucket created and credentials obtained|Client|[ ]|
|Cloudflare account created and domain pointed to Cloudflare|Client|[ ]|
|SSL certificate provisioned via Let's Encrypt|Developer|[ ]|
|Sentry project created and DSN obtained|Developer|[ ]|
|Production VPS provisioned and hardened|Developer|[ ]|
|All environment variables set in production environment|Developer|[ ]|
|Database seed script run — Super Admin account created|Developer|[ ]|
|Super Admin TOTP setup completed|Client|[ ]|
|All Grafana dashboards configured|Developer|[ ]|
|All Grafana alert rules configured and tested|Developer|[ ]|
|All background job dead man's switches verified|Developer|[ ]|
|Privacy Policy and Terms of Service published in English and French|Client|[ ]|
|Launch city allowlist configured (Buea, Douala, Yaoundé)|Developer|[ ]|
|Initial subject taxonomy configured|Developer + Client|[ ]|
|Commission mode configured in platform settings|Client (via Super Admin)|[ ]|
|k6 load tests passing on staging environment|Developer|[ ]|
|All CI/CD pipeline stages passing|Developer|[ ]|
|QA sign-off on all 22 modules|QA|[ ]|
|Client demo and acceptance sign-off|Client|[ ]|

---

**End of Software Requirements Specification**

**Document version:** 1.0 **Status:** Draft: pending final client sign-off **Next review:** After Module 11 and Module 13 implementation begins