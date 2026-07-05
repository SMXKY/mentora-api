import { registry } from "../../docs/openapi.registry";
import { z } from "zod";
import { UpdateMyStudentProfileSchema, AddSubjectOfInterestSchema } from "./student.schema";

// ============================================================
// STUDENT — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Student"];
const basePath = "/api/v1/students";
const bearer = { security: [{ bearerAuth: [] }] };

registry.registerPath({
  method: "get",
  path: `${basePath}/me`,
  tags,
  summary: "Get the caller's own student profile",
  description:
    "Returns `{ profile: null }` (200, not 404) when the caller hasn't set up " +
    "a profile yet — a self-registered Student has no StudentProfile row until " +
    "their first PATCH /me call, the same first-touch gap the KYC tutor wizard has.",
  ...bearer,
  responses: {
    200: {
      description: "The caller's profile (or null), including subjects of interest",
    },
    401: { description: "No valid session token" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/me`,
  tags,
  summary: "Create or update the caller's own student profile",
  description: "Upsert — creates the profile on first call, updates it on every call after.",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: UpdateMyStudentProfileSchema } } },
  },
  responses: {
    200: { description: "Profile created or updated" },
    400: { description: "Validation error" },
    401: { description: "No valid session token" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/subjects`,
  tags,
  summary: "Add a subject of interest",
  description: "Idempotent — adding the same subject twice is a no-op, not an error.",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: AddSubjectOfInterestSchema } } },
  },
  responses: {
    201: { description: "Subject added" },
    400: { description: "Subject does not exist" },
    404: { description: "No student profile yet — call PATCH /me first" },
  },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/me/subjects/{subjectId}`,
  tags,
  summary: "Remove a subject of interest",
  ...bearer,
  request: { params: z.object({ subjectId: z.string().uuid() }) },
  responses: {
    200: { description: "Removed (or was already absent)" },
    404: { description: "No student profile yet" },
  },
});
