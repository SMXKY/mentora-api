import { registry } from "../../docs/openapi.registry";
import { z } from "zod";
import {
  KycStep1Schema,
  KycStep2Schema,
  CredentialInputSchema,
  KycApproveIdentitySchema,
  KycRejectSchema,
  KycBanSchema,
  KycSuspendTutorSchema,
  ApproveSubjectSchema,
  RejectSubjectSchema,
  ReviewCredentialSchema,
  SpotCheckVerdictSchema,
  KycSlaConfigSchema,
  KycStatusResponseSchema,
  KycQueueQuerySchema,
  KycSubjectQueueQuerySchema,
  UpdateSubjectLevelsSchema,
  QualificationTypeEnum,
  IntroVideoConfigSchema,
} from "./kyc.types";

// ============================================================
// KYC — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tutorTags = ["KYC — Tutor"];
const adminTags = ["KYC — Admin"];
const basePath = "/api/v1/kyc";
const adminBasePath = "/api/v1/admin/kyc";
const bearer = { security: [{ bearerAuth: [] }] };

// ── Tutor-facing wizard ──────────────────────────────────────

registry.registerPath({
  method: "get",
  path: `${basePath}/me/status`,
  tags: tutorTags,
  summary: "Lightweight KYC status check for UI gating",
  description:
    "Answers 'has this user started KYC, and what state are they in' without " +
    "the full application payload getMyApplication returns. Does not require " +
    "profile completion — safe to call from any profile screen to decide " +
    "whether to show 'Complete KYC', 'Continue KYC', 'Under review', or " +
    "'Verified'. hasStarted is false if the tutor has never touched the " +
    "wizard (or has no tutor profile at all, e.g. Parent/Student users).",
  ...bearer,
  responses: {
    200: {
      description: "Status snapshot",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: KycStatusResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/me`,
  tags: tutorTags,
  summary: "Get my KYC application (creates the first draft on first call)",
  description:
    "Requires a 100% complete profile (Module 7 completion rules) — returns " +
    "403 with redirect: profile_completion otherwise. Resumes exactly where " +
    "the tutor left off: currentStep reflects the last step saved.",
  ...bearer,
  responses: {
    200: {
      description: "Current application, credentials, and any rejection flags",
    },
    403: { description: "Profile is not yet 100% complete" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/step-1`,
  tags: tutorTags,
  summary: "Step 1 — identity document (CNI or récépissé)",
  description:
    "Multipart: cniFront, cniBack, selfie, nonConvictionCertificate files " +
    "(images JPEG/PNG max 5MB each, certificate is PDF) plus idDocumentType " +
    "and cniNumber fields. All four files are required together — partial " +
    "submission is rejected. Files are processed and stored exclusively " +
    "through the Media module (virus scan, MIME sniffing, quota).",
  ...bearer,
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: KycStep1Schema.extend({
            cniFront: z.string().openapi({ type: "string", format: "binary" }),
            cniBack: z.string().openapi({ type: "string", format: "binary" }),
            selfie: z.string().openapi({ type: "string", format: "binary" }),
            nonConvictionCertificate: z
              .string()
              .openapi({ type: "string", format: "binary" }),
          }),
        },
      },
    },
  },
  responses: {
    200: { description: "Step 1 saved, advances to STEP_2_BIOGRAPHY" },
    400: {
      description:
        "Missing file(s), invalid CNI number format, or application is read-only",
    },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/step-2`,
  tags: tutorTags,
  summary: "Step 2 — background information",
  description:
    "Full legal name, DOB, gender, current address, city/region of origin, " +
    "emergency contact, and an optional self-declaration statement. Never " +
    "shown publicly — visible only to Admin/Super Admin during review.",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: KycStep2Schema } } },
  },
  responses: {
    200: { description: "Step 2 saved, advances to STEP_3_CREDENTIALS" },
    400: {
      description: "Step 1 not complete yet, or a required field is missing",
    },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/credentials`,
  tags: tutorTags,
  summary: "Add a credential (Step 3)",
  description:
    "Multipart: institutionName, qualificationType, fieldOfStudy, " +
    "gradeOrClassification, yearAwarded, subjects (JSON array, min 1, each " +
    "{subjectId, levelIds: string[] (min 1)} for an existing catalog " +
    "subject, OR {newSubject: {name, description, domainId}, levelIds} to " +
    "propose a subject not yet on the platform — created PENDING and " +
    "reviewed alongside the tutor's credential — grade levels are selected " +
    "per subject, since one credential can cover subjects taught at " +
    "different levels), and a document file (PDF/JPEG/PNG, max 10MB). Can " +
    "be called any number of times — there is no cap on credentials per " +
    "application.",
  ...bearer,
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: CredentialInputSchema.extend({
            subjects: z.string().openapi({
              description:
                "JSON-encoded array of {subjectId, levelIds} or " +
                "{newSubject: {name, description, domainId}, levelIds}",
            }),
            document: z.string().openapi({ type: "string", format: "binary" }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Credential added, PENDING review" },
    400: {
      description:
        "No document attached, invalid subject id, invalid level id, or application is read-only",
    },
  },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/me/credentials/{credentialId}`,
  tags: tutorTags,
  summary: "Remove a not-yet-reviewed credential",
  ...bearer,
  request: { params: z.object({ credentialId: z.string().uuid() }) },
  responses: {
    200: { description: "Credential removed" },
    404: { description: "Credential not found" },
    409: {
      description:
        "Credential has already been reviewed and can no longer be removed",
    },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/cv`,
  tags: tutorTags,
  summary: "Upload an optional CV",
  description:
    "PDF only, max 10MB. Purely supporting context for Admin — never required.",
  ...bearer,
  responses: { 200: { description: "CV attached to the current application" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/submit`,
  tags: tutorTags,
  summary: "Step 4 — final submission",
  description:
    "Validates every prior step is genuinely complete (not just trusting " +
    "client-reported progress), accepts the declaration, and moves KYC " +
    "status to PENDING. Sends KYC_SUBMITTED to the tutor and notifies " +
    "everyone with kyc.queue.read that a new application is waiting.",
  ...bearer,
  responses: {
    200: { description: "Submitted — status is now PENDING" },
    400: { description: "One or more steps are still incomplete" },
    409: { description: "Not a valid transition from the current status" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/resubmit`,
  tags: tutorTags,
  summary: "Re-open a rejected application for editing",
  description:
    "Only callable when status is REJECTED. Creates a new application " +
    "version pre-populated with every previously submitted field — the " +
    "tutor edits only what was flagged, then calls submit again.",
  ...bearer,
  responses: {
    200: { description: "New editable version created" },
    409: { description: "Current application is not REJECTED" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/additional-subject`,
  tags: tutorTags,
  summary: "Apply for an additional subject after already going ACTIVE",
  description:
    "Multipart: institutionName, qualificationType, fieldOfStudy, " +
    "gradeOrClassification, yearAwarded, levelIds (JSON array, min 1), a " +
    "document file, and exactly one of subjectId (an existing, approved " +
    "subject) or newSubject ({ name, description, domainId }) when the " +
    "subject the tutor teaches isn't in the taxonomy yet. A proposed new " +
    "subject is created PENDING and inactive — invisible in search/catalog " +
    "— until an admin approves it via the subject-verification queue, at " +
    "which point it also becomes available to every other tutor. Only " +
    "reachable once KYC status is ACTIVE.",
  ...bearer,
  request: {
    body: {
      content: {
        // Built as a standalone object rather than AdditionalSubjectSchema.extend(...)
        // — Zod doesn't allow .extend() on a schema carrying a .refine(),
        // which AdditionalSubjectSchema does (the subjectId-xor-newSubject check).
        "multipart/form-data": {
          schema: z.object({
            institutionName: z.string(),
            qualificationType: QualificationTypeEnum,
            fieldOfStudy: z.string(),
            gradeOrClassification: z.string().optional(),
            yearAwarded: z.number().int(),
            subjectId: z.string().uuid().optional(),
            newSubject: z
              .string()
              .optional()
              .openapi({ description: "JSON-encoded { name, description, domainId }" }),
            levelIds: z
              .string()
              .openapi({ description: "JSON-encoded array of level UUIDs" }),
            document: z.string().openapi({ type: "string", format: "binary" }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Additional subject credential submitted" },
    400: { description: "Invalid level, invalid subject, or subject already claimed" },
    409: { description: "Tutor is not currently ACTIVE" },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/me/subjects`,
  tags: tutorTags,
  summary: "List my subjects with status and levels",
  description:
    "Every subject the tutor has ever claimed (PENDING, APPROVED, or " +
    "REJECTED) with the levels they've selected for it — backs the tutor " +
    "subject-application settings screen.",
  ...bearer,
  responses: { 200: { description: "Tutor's subjects with levels" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/me/subjects/{tutorSubjectId}/levels`,
  tags: tutorTags,
  summary: "Update the levels taught for one of my subjects",
  ...bearer,
  request: {
    params: z.object({ tutorSubjectId: z.string().uuid() }),
    body: { content: { "application/json": { schema: UpdateSubjectLevelsSchema } } },
  },
  responses: {
    200: { description: "Updated levels" },
    404: { description: "Subject claim not found" },
  },
});

// ── Admin review ─────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/queue`,
  tags: adminTags,
  summary: "Full KYC review queue — searchable, filterable, sortable, paginated",
  description:
    "Defaults to PENDING, fully submitted applications, oldest first. Every " +
    "row carries everything the queue table needs to render without a " +
    "per-row re-fetch: tutor name/email/phone/avatar, city/region, " +
    "document-completeness flags, credential and subject counts, prior " +
    "rejection count, and SLA countdown (isEscalated, escalationDeadline, " +
    "slaHoursRemaining). meta.counts carries dashboard-tile totals " +
    "(by status, pendingEscalated, pendingDueSoon) so status tabs don't " +
    "need a separate call. Query params: page, limit (max 100), sortBy " +
    "(submittedAt|updatedAt|createdAt|fullLegalName|escalationDeadline), " +
    "sortOrder (asc|desc), search (matches tutor name/email/phone or " +
    "application fullLegalName/surname/cniNumber), status (comma-separated " +
    "KycStatus list, defaults to PENDING), cityId, regionId, escalatedOnly.",
  ...bearer,
  request: { query: KycQueueQuerySchema },
  responses: {
    200: {
      description: "Paginated, enriched queue rows with meta.counts for dashboard tiles",
    },
  },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/queue/stats`,
  tags: adminTags,
  summary: "Dashboard-tile counts for the KYC queue",
  description:
    "Counts by KycStatus plus pendingEscalated/pendingDueSoon, independent " +
    "of any queue filter — the same object embedded as meta.counts on " +
    "GET /queue, exposed standalone for dashboard widgets that only need " +
    "the totals.",
  ...bearer,
  responses: { 200: { description: "{ byStatus, pendingEscalated, pendingDueSoon }" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/applications/{id}`,
  tags: adminTags,
  summary: "Full review card for one application",
  description:
    "Returns every document, credential, and prior rejection for this " +
    "tutor, plus the tutor's contact info (name/email/phone/avatar) and " +
    "resolved, directly-viewable URLs for every uploaded file — " +
    "application.documentUrls (cniFrontPhotoUrl, cniBackPhotoUrl, " +
    "selfieWithCniUrl, nonConvictionCertificateUrl, cvFileUrl) and each " +
    "credential's documentViewUrl. The generic owner-scoped " +
    "/media/:id/url endpoint 404s for an admin viewing someone else's " +
    "file, so this is the only way to actually see a KYC document. The " +
    "first time a given admin opens a given application, the server " +
    "starts an internal review-duration clock (returned as review.openedAt, " +
    "with review.minReviewSeconds = 90) used by the spot-check governance " +
    "system — an approval decided before minReviewSeconds elapses is " +
    "automatically flagged for Super Admin secondary review; the frontend " +
    "can use openedAt to disable the approve button until then.",
  ...bearer,
  responses: {
    200: { description: "Review card" },
    404: { description: "Not found" },
  },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/applications/{id}/approve-identity`,
  tags: adminTags,
  summary: "Approve identity verification",
  description:
    "The five-item checklist must be entirely true — enforced server-side " +
    "regardless of what the client sends. Moves status to IDENTITY_APPROVED.",
  ...bearer,
  request: {
    body: {
      content: { "application/json": { schema: KycApproveIdentitySchema } },
    },
  },
  responses: {
    200: { description: "Identity approved" },
    400: { description: "One or more checklist items is false" },
    409: { description: "Not a valid transition from the current status" },
  },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/applications/{id}/reject`,
  tags: adminTags,
  summary: "Reject the identity application",
  description: "At least one flagged item with a reason is required.",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: KycRejectSchema } } },
  },
  responses: {
    200: { description: "Rejected" },
    400: { description: "No flags provided" },
  },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/tutors/{tutorProfileId}/ban`,
  tags: adminTags,
  summary: "Permanently ban a tutor from KYC",
  description:
    "Callable from any non-BANNED status. Also suspends the underlying user " +
    "account (login blocked, sessions invalidated) and auto-cancels pending " +
    "bookings, flagging paid ones for manual handling.",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: KycBanSchema } } },
  },
  responses: { 200: { description: "Banned" } },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/tutors/{tutorProfileId}/suspend`,
  tags: adminTags,
  summary: "Suspend a previously ACTIVE tutor",
  description:
    "Reason must be at least 20 characters. Only valid from ACTIVE — this " +
    "is never an initial application outcome.",
  ...bearer,
  request: {
    body: {
      content: { "application/json": { schema: KycSuspendTutorSchema } },
    },
  },
  responses: {
    200: { description: "Suspended" },
    409: { description: "Tutor is not ACTIVE" },
  },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/tutors/{tutorProfileId}/unsuspend`,
  tags: adminTags,
  summary: "Lift a tutor suspension",
  ...bearer,
  responses: { 200: { description: "Restored to ACTIVE" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/subjects/queue`,
  tags: adminTags,
  summary: "Confidence-scored subject verification queue",
  description:
    "Every pending subject claim, scored against the trained inference " +
    "engine and split into recommendApprove / recommendReview / " +
    "newDocumentationRequired. Each entry carries a 0-100 score, a " +
    "one-sentence explanation, the matched/candidate credentials, and an " +
    "embedded tutor summary (name, email, avatar) so the queue table needs " +
    "no per-row re-fetch. Each entry's nested subject carries status " +
    "(PENDING/APPROVED/REJECTED), description, and submittedById — a " +
    "tutor-proposed subject not yet in the taxonomy shows status PENDING " +
    "here. Optional ?search matches the subject name or the claiming " +
    "tutor's name/email.",
  ...bearer,
  request: { query: KycSubjectQueueQuerySchema },
  responses: { 200: { description: "Sectioned queue with meta.total" } },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/subjects/{tutorSubjectId}/approve`,
  tags: adminTags,
  summary: "Approve a subject claim",
  description:
    "Optionally pass trainWeight (0-100) to teach the inference engine — " +
    "upserts the (qualificationType, fieldOfStudy, subject) relationship " +
    "weight future claims are scored against. If this is the tutor's first " +
    "approved subject and identity is already approved, the tutor goes ACTIVE. " +
    "If the underlying subject was a tutor-proposed PENDING taxonomy entry, " +
    "approving this claim also promotes it to APPROVED/active — available to " +
    "every tutor and visible in search/catalog from then on, not just this one.",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: ApproveSubjectSchema } } },
  },
  responses: { 200: { description: "Approved" } },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/subjects/{tutorSubjectId}/reject`,
  tags: adminTags,
  summary: "Reject a subject claim",
  description:
    "Never affects any other subject's status — a single-row decision.",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: RejectSubjectSchema } } },
  },
  responses: { 200: { description: "Rejected" } },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/credentials/{credentialId}/review`,
  tags: adminTags,
  summary: "Approve, reject, or revoke a credential",
  description:
    "Transitioning an already-APPROVED credential to REJECTED is treated as " +
    "a revocation: every subject backed *solely* by this credential (no " +
    "other approved credential also covers it) is automatically demoted " +
    "back to PENDING and disappears from the tutor's public profile until " +
    "re-verified.",
  ...bearer,
  request: {
    body: {
      content: { "application/json": { schema: ReviewCredentialSchema } },
    },
  },
  responses: { 200: { description: "Reviewed" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/spot-check-queue`,
  tags: adminTags,
  summary: "Super Admin spot-check sample",
  description:
    "Recent identity approvals flagged for secondary review — either " +
    "randomly sampled or because the reviewing admin spent under 90 " +
    "seconds on the decision. Excludes anything already given a verdict.",
  ...bearer,
  responses: { 200: { description: "Sample" } },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/spot-check/{kycStatusHistoryId}/verdict`,
  tags: adminTags,
  summary: "Record a spot-check verdict",
  description:
    "A BAD verdict counts against the original approving admin. More than " +
    "3 BAD verdicts in a trailing 30-day window sets that admin's " +
    "kycCountersignatureRequired flag and sends them a warning notification.",
  ...bearer,
  request: {
    body: {
      content: { "application/json": { schema: SpotCheckVerdictSchema } },
    },
  },
  responses: { 200: { description: "Verdict recorded" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/stats/{adminId}`,
  tags: adminTags,
  summary: "Per-admin governance statistics",
  description:
    "Total reviewed, rejection rate, average review duration, and flagged-approval count over a trailing window.",
  ...bearer,
  responses: { 200: { description: "Stats" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/sla-config`,
  tags: adminTags,
  summary: "Get the current KYC SLA configuration",
  ...bearer,
  responses: { 200: { description: "{ targetHours, maxBusinessDays }" } },
});

registry.registerPath({
  method: "patch",
  path: `${adminBasePath}/sla-config`,
  tags: adminTags,
  summary: "Update the KYC SLA configuration",
  description:
    "Defaults are 48 target hours and 5 max business days — persisted in PlatformConfig.",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: KycSlaConfigSchema } } },
  },
  responses: { 200: { description: "Updated config" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/intro-video-config`,
  tags: adminTags,
  summary: "Get the minimum required intro-video duration",
  ...bearer,
  responses: { 200: { description: "{ minDurationSeconds }" } },
});

registry.registerPath({
  method: "patch",
  path: `${adminBasePath}/intro-video-config`,
  tags: adminTags,
  summary: "Update the minimum required intro-video duration",
  description:
    "Default is 60 seconds — persisted in PlatformConfig under " +
    "tutor.intro_video_min_duration_seconds. Only future uploads are " +
    "checked against a new value; already-verified tutors are not retroactively re-checked.",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: IntroVideoConfigSchema } } },
  },
  responses: { 200: { description: "Updated config" } },
});
