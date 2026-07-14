import { registry } from "../../docs/openapi.registry";
import { z } from "zod";
import {
  DownloadPolicyUpdateSchema,
  DownloadPolicyResponseSchema,
  ModerationRemoveSchema,
  CollectionSuspendSchema,
} from "./materials.types";

// ============================================================
// MATERIALS — ADMIN OPENAPI ROUTE REGISTRATIONS (Module 8.5)
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Materials — Admin"];
const basePath = "/api/v1/admin/materials";
const bearer = { security: [{ bearerAuth: [] }] };

registry.registerPath({
  method: "get",
  path: `${basePath}/download-policy`,
  tags,
  summary: "Get per-content-type downloadability toggles",
  description:
    "Backed by PlatformConfig (key 'materials.download_policy'), same " +
    "mechanism KYC's SLA config uses — no code change or deploy required " +
    "to flip a toggle. Defaults to true for all types if never set. Written " +
    "notes are never downloadable/exportable and are not part of this toggle.",
  ...bearer,
  responses: {
    200: {
      description: "Current policy",
      content: { "application/json": { schema: DownloadPolicyResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: `${basePath}/download-policy`,
  tags,
  summary: "Update downloadability toggles (partial update)",
  description: "Takes effect immediately, platform-wide, on the next request.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: DownloadPolicyUpdateSchema } } } },
  responses: { 200: { description: "Updated policy" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/materials/{materialId}/remove`,
  tags,
  summary: "Remove a material (policy violation)",
  description:
    "Soft-deletes the material, records a MaterialReview(decision=REMOVED), " +
    "and notifies the tutor (MATERIAL_REMOVED) with a translatable reason code.",
  ...bearer,
  request: {
    params: z.object({ materialId: z.string().uuid() }),
    body: { content: { "application/json": { schema: ModerationRemoveSchema } } },
  },
  responses: { 200: { description: "Removed" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/materials/{materialId}/versions`,
  tags,
  summary: "Written-note edit history (for dispute recovery)",
  description: "Reconstructed from AuditLog previousState/newState snapshots.",
  ...bearer,
  request: { params: z.object({ materialId: z.string().uuid() }) },
  responses: { 200: { description: "Version history" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/collections/{collectionId}/suspend`,
  tags,
  summary: "Suspend an entire collection without touching the tutor's account",
  ...bearer,
  request: {
    params: z.object({ collectionId: z.string().uuid() }),
    body: { content: { "application/json": { schema: CollectionSuspendSchema } } },
  },
  responses: { 200: { description: "Suspended" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/tutors/{tutorId}/moderation-history`,
  tags,
  summary: "Moderation history for a tutor (all removals/suspensions, dates, reasons)",
  description: "tutorId is the tutor's User.id, matching MaterialReview.tutorId.",
  ...bearer,
  request: { params: z.object({ tutorId: z.string().uuid() }) },
  responses: { 200: { description: "History" } },
});
