import { registry } from "../../docs/openapi.registry";
import { z } from "zod";
import { UpdateMyTutorProfileSchema, UpdateSubjectPricingSchema } from "./tutor.schema";

// ============================================================
// TUTOR — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Tutor"];
const basePath = "/api/v1/tutors";
const bearer = { security: [{ bearerAuth: [] }] };

registry.registerPath({
  method: "get",
  path: `${basePath}/me`,
  tags,
  summary: "Get the caller's own tutor profile",
  description:
    "Full detail, including KYC-internal fields (credentials, kycStatus) that " +
    "never appear on the public GET /tutors/{id} endpoint. Also includes " +
    "needsIntroVideo (true once KYC is IDENTITY_APPROVED/ACTIVE but no " +
    "verified introduction video has been uploaded yet — the signal a " +
    "profile banner uses to prompt the upload) and " +
    "introVideoMinDurationSeconds (the admin-configured minimum, for the " +
    "banner copy).",
  ...bearer,
  responses: {
    200: { description: "The caller's profile (or null if not created yet)" },
    401: { description: "No valid session token" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/intro-video`,
  tags,
  summary: "Upload the introduction video",
  description:
    "Multipart, single field 'video' (mp4/mov, max 200MB). The only way " +
    "introVideoUrl/introVideoVerified are ever set — the uploaded file's " +
    "actual duration is probed server-side and rejected if shorter than " +
    "the admin-configured minimum (default 60s, see " +
    "GET/PATCH /admin/kyc/intro-video-config). A tutor with kycStatus " +
    "ACTIVE but no verified intro video is excluded from search results " +
    "and from the public profile endpoint.",
  ...bearer,
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({ video: z.string().openapi({ type: "string", format: "binary" }) }),
        },
      },
    },
  },
  responses: {
    200: { description: "Profile updated, introVideoVerified is now true" },
    400: { description: "No file provided, or the video is shorter than the configured minimum" },
    404: { description: "No tutor profile yet" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/me`,
  tags,
  summary: "Create or update the caller's own tutor profile",
  description:
    "Upsert — this is the only way a TutorProfile row comes into existence, " +
    "which is also what the KYC completion gate (Module 7) checks for. " +
    "bio, teachingMode, and cityId are required on every call because they " +
    "are NOT NULL columns — there is no partially-valid TutorProfile state. " +
    "minRateXaf/maxRateXaf normally auto-sync to the min/max across the " +
    "tutor's open, approved subjects (see PATCH /me/subjects/{subjectId}) — " +
    "passing either field here marks them as manually overridden, and the " +
    "auto-sync never touches them again.",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: UpdateMyTutorProfileSchema } } },
  },
  responses: {
    200: { description: "Profile created or updated" },
    400: { description: "Validation error, e.g. maxRateXaf below minRateXaf" },
    401: { description: "No valid session token" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/me/subjects/{subjectId}`,
  tags,
  summary: "Set per-subject session pricing and booking availability",
  description:
    "Only works on a subject the tutor has already claimed via a KYC credential " +
    "submission — pricing never creates the claim itself, it only prices an " +
    "existing one (approved or still pending review). Exactly two rates exist, " +
    "both hourly: ratePerOnlineHourXaf and ratePerHomeHourXaf — a booking's " +
    "price is always hourlyRate(sessionType) × duration / 60, there is no " +
    "flat per-session fee. isOpenForBooking gates both whether " +
    "students can book this subject and whether it appears on the tutor's " +
    "public profile/search results; it can only be set true on an APPROVED " +
    "subject that already has at least one of the two rates configured. Any " +
    "change here also recomputes the tutor's profile-level minRateXaf/" +
    "maxRateXaf (unless the tutor has manually overridden them via PATCH /me).",
  ...bearer,
  request: {
    params: z.object({ subjectId: z.string().uuid() }),
    body: { content: { "application/json": { schema: UpdateSubjectPricingSchema } } },
  },
  responses: {
    200: { description: "Pricing and/or availability updated" },
    400: {
      description:
        "No field was provided, or isOpenForBooking:true was requested on a " +
        "subject that isn't APPROVED or has no rate configured",
    },
    404: { description: "No TutorProfile yet, or this subject hasn't been claimed" },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}`,
  tags,
  summary: "Public tutor profile",
  description:
    "No auth required. Only ever returns tutors with kycStatus ACTIVE — a " +
    "pending, suspended, or banned tutor 404s exactly the same as an id that " +
    "doesn't exist at all, so their status is never leaked. Only APPROVED " +
    "subjects the tutor has opened for booking (isOpenForBooking) appear; " +
    "KYC-internal fields (credentials, kycStatus, address) are never " +
    "included. Includes lessonPlans — one entry per published " +
    "collection with a published lesson plan, each topic carrying a " +
    "computed status ('coming_soon' if unlinked or its section has no " +
    "materials yet, otherwise 'available'). A collection with no published " +
    "lesson plan is simply absent from the array, not shown empty.",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "Public profile" },
    404: { description: "Tutor not found or not currently ACTIVE" },
  },
});
