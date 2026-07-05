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
  path: `${basePath}/me`,
  tags: tutorTags,
  summary: "Get my KYC application (creates the first draft on first call)",
  description:
    "Requires a 100% complete profile (Module 7 completion rules) — returns " +
    "403 with redirect: profile_completion otherwise. Resumes exactly where " +
    "the tutor left off: currentStep reflects the last step saved.",
  ...bearer,
  responses: {
    200: { description: "Current application, credentials, and any rejection flags" },
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
    400: { description: "Missing file(s), invalid CNI number format, or application is read-only" },
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
  request: { body: { content: { "application/json": { schema: KycStep2Schema } } } },
  responses: {
    200: { description: "Step 2 saved, advances to STEP_3_CREDENTIALS" },
    400: { description: "Step 1 not complete yet, or a required field is missing" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/credentials`,
  tags: tutorTags,
  summary: "Add a credential (Step 3)",
  description:
    "Multipart: institutionName, qualificationType, fieldOfStudy, " +
    "gradeOrClassification, yearAwarded, subjectIds (JSON array, min 1), and " +
    "a document file (PDF/JPEG/PNG, max 10MB). Can be called any number of " +
    "times — there is no cap on credentials per application.",
  ...bearer,
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: CredentialInputSchema.extend({
            subjectIds: z.string().openapi({ description: "JSON-encoded array of subject UUIDs" }),
            document: z.string().openapi({ type: "string", format: "binary" }),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: "Credential added, PENDING review" },
    400: { description: "No document attached, invalid subject id, or application is read-only" },
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
    409: { description: "Credential has already been reviewed and can no longer be removed" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/cv`,
  tags: tutorTags,
  summary: "Upload an optional CV",
  description: "PDF only, max 10MB. Purely supporting context for Admin — never required.",
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
  summary: "Claim an additional subject after already going ACTIVE",
  description:
    "The lighter post-approval flow — reuses the same credential submission " +
    "path, but only reachable once KYC status is ACTIVE, and lands in the " +
    "dedicated additional-subject admin queue rather than the full KYC queue.",
  ...bearer,
  responses: {
    201: { description: "Additional subject credential submitted" },
    409: { description: "Tutor is not currently ACTIVE" },
  },
});

// ── Admin review ─────────────────────────────────────────────

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/queue`,
  tags: adminTags,
  summary: "Full KYC review queue",
  description: "PENDING, fully submitted applications, oldest first. Escalated applications are marked isEscalated.",
  ...bearer,
  responses: { 200: { description: "Queue" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/applications/{id}`,
  tags: adminTags,
  summary: "Full review card for one application",
  description:
    "Returns every document, credential, and prior rejection for this " +
    "tutor. The first time a given admin opens a given application, the " +
    "server starts an internal review-duration clock used by the spot-check " +
    "governance system (an approval decided in under 90 seconds is " +
    "automatically flagged for Super Admin secondary review).",
  ...bearer,
  responses: { 200: { description: "Review card" }, 404: { description: "Not found" } },
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
  request: { body: { content: { "application/json": { schema: KycApproveIdentitySchema } } } },
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
  request: { body: { content: { "application/json": { schema: KycRejectSchema } } } },
  responses: { 200: { description: "Rejected" }, 400: { description: "No flags provided" } },
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
  request: { body: { content: { "application/json": { schema: KycBanSchema } } } },
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
  request: { body: { content: { "application/json": { schema: KycSuspendTutorSchema } } } },
  responses: { 200: { description: "Suspended" }, 409: { description: "Tutor is not ACTIVE" } },
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
    "newDocumentationRequired. Each entry carries a 0-100 score and a " +
    "one-sentence explanation.",
  ...bearer,
  responses: { 200: { description: "Sectioned queue" } },
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
    "approved subject and identity is already approved, the tutor goes ACTIVE.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: ApproveSubjectSchema } } } },
  responses: { 200: { description: "Approved" } },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/subjects/{tutorSubjectId}/reject`,
  tags: adminTags,
  summary: "Reject a subject claim",
  description: "Never affects any other subject's status — a single-row decision.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: RejectSubjectSchema } } } },
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
  request: { body: { content: { "application/json": { schema: ReviewCredentialSchema } } } },
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
  request: { body: { content: { "application/json": { schema: SpotCheckVerdictSchema } } } },
  responses: { 200: { description: "Verdict recorded" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/stats/{adminId}`,
  tags: adminTags,
  summary: "Per-admin governance statistics",
  description: "Total reviewed, rejection rate, average review duration, and flagged-approval count over a trailing window.",
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
  description: "Defaults are 48 target hours and 5 max business days — persisted in PlatformConfig.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: KycSlaConfigSchema } } } },
  responses: { 200: { description: "Updated config" } },
});
