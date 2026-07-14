import { registry } from "../../docs/openapi.registry";
import { z } from "zod";
import {
  CollectionCreateSchema,
  CollectionUpdateSchema,
  SectionCreateSchema,
  SectionUpdateSchema,
  ReorderSchema,
  MaterialCreateSchema,
  WrittenNoteCreateSchema,
  MaterialUpdateSchema,
  WrittenNoteContentUpdateSchema,
  LessonPlanCreateSchema,
  LessonPlanUpdateSchema,
  LessonPlanTopicCreateSchema,
  LessonPlanTopicUpdateSchema,
} from "./materials.types";

// ============================================================
// MATERIALS — TUTOR OPENAPI ROUTE REGISTRATIONS (Module 8.5)
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Materials — Tutor"];
const basePath = "/api/v1/materials/me";
const bearer = { security: [{ bearerAuth: [] }] };

const GATE_DESCRIPTION =
  "Every endpoint in this module requires protect -> checkAccountCompletion " +
  "-> checkKyc -> restrictTo(permission). A tutor whose profile is incomplete " +
  "gets 403 accountIncomplete; a tutor whose KYC isn't ACTIVE gets 403 " +
  "kycNotApproved.";

// ── Collections ────────────────────────────────────────────
registry.registerPath({
  method: "post",
  path: `${basePath}/collections`,
  tags,
  summary: "Create a collection",
  description: GATE_DESCRIPTION,
  ...bearer,
  request: { body: { content: { "application/json": { schema: CollectionCreateSchema } } } },
  responses: {
    201: { description: "Collection created" },
    403: { description: "Account incomplete or KYC not approved" },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/collections`,
  tags,
  summary: "List my collections (paginated, filterable by subjectId/search)",
  ...bearer,
  responses: { 200: { description: "Paginated collection list" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/collections/reorder`,
  tags,
  summary: "Reorder collections (drag-and-drop)",
  ...bearer,
  request: { body: { content: { "application/json": { schema: ReorderSchema } } } },
  responses: { 200: { description: "Reordered" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/collections/{collectionId}`,
  tags,
  summary: "Get a collection with its sections, materials, and lesson plan",
  ...bearer,
  request: { params: z.object({ collectionId: z.string().uuid() }) },
  responses: { 200: { description: "Collection detail" }, 404: { description: "Not found" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/collections/{collectionId}`,
  tags,
  summary: "Update a collection (name, description, isPublished)",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid() }),
    body: { content: { "application/json": { schema: CollectionUpdateSchema } } },
  },
  responses: { 200: { description: "Updated" } },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/collections/{collectionId}`,
  tags,
  summary: "Soft-delete a collection and its sections/materials",
  description:
    "Blocked with 409 if any material's underlying file is evidence on an " +
    "unresolved dispute.",
  ...bearer,
  request: { params: z.object({ collectionId: z.string().uuid() }) },
  responses: { 200: { description: "Deleted" }, 409: { description: "Dispute-locked" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/collections/{collectionId}/stats`,
  tags,
  summary: "Aggregated, anonymized access stats for a collection",
  description:
    "Unique-viewer count and per-material view count, sourced from AuditLog " +
    "READ entries. Returns zeros until a student-facing access module logs reads.",
  ...bearer,
  request: { params: z.object({ collectionId: z.string().uuid() }) },
  responses: { 200: { description: "Stats" } },
});

// ── Sections ───────────────────────────────────────────────
registry.registerPath({
  method: "post",
  path: `${basePath}/collections/{collectionId}/sections`,
  tags,
  summary: "Add a section to a collection",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid() }),
    body: { content: { "application/json": { schema: SectionCreateSchema } } },
  },
  responses: { 201: { description: "Section created" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/collections/{collectionId}/sections/reorder`,
  tags,
  summary: "Reorder sections within a collection",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid() }),
    body: { content: { "application/json": { schema: ReorderSchema } } },
  },
  responses: { 200: { description: "Reordered" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/collections/{collectionId}/sections/{sectionId}`,
  tags,
  summary: "Update a section",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid(), sectionId: z.string().uuid() }),
    body: { content: { "application/json": { schema: SectionUpdateSchema } } },
  },
  responses: { 200: { description: "Updated" } },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/collections/{collectionId}/sections/{sectionId}`,
  tags,
  summary: "Delete a section (its materials become direct collection children)",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid(), sectionId: z.string().uuid() }),
  },
  responses: { 200: { description: "Deleted" } },
});

// ── Materials ──────────────────────────────────────────────
registry.registerPath({
  method: "post",
  path: `${basePath}/collections/{collectionId}/materials`,
  tags,
  summary: "Upload a file-backed material (video/audio/document/image)",
  description:
    "Multipart: file + name, materialType (VIDEO|AUDIO|DOCUMENT|IMAGE), " +
    "optional sectionId, isFreePreview. Routed exclusively through " +
    "MediaService (virus scan, MIME sniffing, quota, storage).",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid() }),
    body: {
      content: {
        "multipart/form-data": {
          schema: MaterialCreateSchema.extend({
            file: z.string().openapi({ type: "string", format: "binary" }),
          }),
        },
      },
    },
  },
  responses: { 201: { description: "Material created" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/collections/{collectionId}/materials/written-note`,
  tags,
  summary: "Create a written note (TipTap JSON, no file upload)",
  description:
    "contentJson is structurally validated against an allowlisted TipTap " +
    "node schema and sanitized before storage — never rendered as raw HTML.",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid() }),
    body: { content: { "application/json": { schema: WrittenNoteCreateSchema } } },
  },
  responses: { 201: { description: "Written note created" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/collections/{collectionId}/materials/reorder`,
  tags,
  summary: "Reorder materials within a collection or section",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid() }),
    body: { content: { "application/json": { schema: ReorderSchema } } },
  },
  responses: { 200: { description: "Reordered" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/collections/{collectionId}/materials/{materialId}`,
  tags,
  summary: "Update material metadata (name, sectionId, isFreePreview)",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid(), materialId: z.string().uuid() }),
    body: { content: { "application/json": { schema: MaterialUpdateSchema } } },
  },
  responses: { 200: { description: "Updated" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/collections/{collectionId}/materials/{materialId}/content`,
  tags,
  summary: "Edit a written note's content",
  description:
    "Every edit is captured as an AuditLog previousState/newState pair, " +
    "giving Admin full version history to recover from on a dispute.",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid(), materialId: z.string().uuid() }),
    body: { content: { "application/json": { schema: WrittenNoteContentUpdateSchema } } },
  },
  responses: { 200: { description: "Updated" }, 400: { description: "Not a written note" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/collections/{collectionId}/materials/{materialId}/replace-file`,
  tags,
  summary: "Replace the underlying file of a video/audio/document/image material",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid(), materialId: z.string().uuid() }),
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({ file: z.string().openapi({ type: "string", format: "binary" }) }),
        },
      },
    },
  },
  responses: { 200: { description: "File replaced" } },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/collections/{collectionId}/materials/{materialId}`,
  tags,
  summary: "Soft-delete a material",
  description:
    "Retained 30 days for dispute evidence. Blocked with 409 if the " +
    "material's file is evidence on an unresolved dispute.",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid(), materialId: z.string().uuid() }),
  },
  responses: { 200: { description: "Deleted" }, 409: { description: "Dispute-locked" } },
});

// ── Lesson Plans ───────────────────────────────────────────
registry.registerPath({
  method: "post",
  path: `${basePath}/collections/{collectionId}/lesson-plan`,
  tags,
  summary: "Create the lesson plan for a collection (one per collection)",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid() }),
    body: { content: { "application/json": { schema: LessonPlanCreateSchema } } },
  },
  responses: { 201: { description: "Created" }, 409: { description: "Already exists" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/collections/{collectionId}/lesson-plan`,
  tags,
  summary: "Get the lesson plan and its topics",
  description:
    "Each topic includes a derived status: 'coming_soon' if unlinked or its " +
    "section has no materials yet, otherwise 'available'.",
  ...bearer,
  request: { params: z.object({ collectionId: z.string().uuid() }) },
  responses: { 200: { description: "Lesson plan" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/collections/{collectionId}/lesson-plan`,
  tags,
  summary: "Update the lesson plan",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid() }),
    body: { content: { "application/json": { schema: LessonPlanUpdateSchema } } },
  },
  responses: { 200: { description: "Updated" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/collections/{collectionId}/lesson-plan/topics`,
  tags,
  summary: "Add a lesson plan topic",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid() }),
    body: { content: { "application/json": { schema: LessonPlanTopicCreateSchema } } },
  },
  responses: { 201: { description: "Topic created" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/collections/{collectionId}/lesson-plan/topics/reorder`,
  tags,
  summary: "Reorder lesson plan topics",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid() }),
    body: { content: { "application/json": { schema: ReorderSchema } } },
  },
  responses: { 200: { description: "Reordered" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/collections/{collectionId}/lesson-plan/topics/{topicId}`,
  tags,
  summary: "Update a lesson plan topic (including linking it to a section)",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid(), topicId: z.string().uuid() }),
    body: { content: { "application/json": { schema: LessonPlanTopicUpdateSchema } } },
  },
  responses: { 200: { description: "Updated" } },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/collections/{collectionId}/lesson-plan/topics/{topicId}`,
  tags,
  summary: "Delete a lesson plan topic",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid(), topicId: z.string().uuid() }),
  },
  responses: { 200: { description: "Deleted" } },
});

// ── Storage ────────────────────────────────────────────────
registry.registerPath({
  method: "get",
  path: `${basePath}/storage`,
  tags,
  summary: "My storage usage and quota (across all Learning Materials files)",
  ...bearer,
  responses: { 200: { description: "Usage snapshot" } },
});
