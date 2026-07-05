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
    "never appear on the public GET /tutors/{id} endpoint.",
  ...bearer,
  responses: {
    200: { description: "The caller's profile (or null if not created yet)" },
    401: { description: "No valid session token" },
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
    "are NOT NULL columns — there is no partially-valid TutorProfile state.",
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
  summary: "Set per-subject session pricing",
  description:
    "Only works on a subject the tutor has already claimed via a KYC credential " +
    "submission — pricing never creates the claim itself, it only prices an " +
    "existing one (approved or still pending review).",
  ...bearer,
  request: {
    params: z.object({ subjectId: z.string().uuid() }),
    body: { content: { "application/json": { schema: UpdateSubjectPricingSchema } } },
  },
  responses: {
    200: { description: "Pricing updated" },
    400: { description: "Neither rate field was provided" },
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
    "subjects appear; KYC-internal fields (credentials, kycStatus, address) " +
    "are never included.",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "Public profile" },
    404: { description: "Tutor not found or not currently ACTIVE" },
  },
});
