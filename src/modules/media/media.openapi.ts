import { registry } from "../../docs/openapi.registry";
import {
  MediaUploadResultSchema,
  MediaUrlResponseSchema,
} from "./media.schema";
import { z } from "zod";
import { FileCategory } from "../../generated/prisma";

// ============================================================
// MEDIA — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Media"];
const basePath = "/api/v1/media";

const multipartUploadBody = {
  content: {
    "multipart/form-data": {
      schema: z.object({
        files: z.array(z.string()).openapi({
          type: "array",
          items: { type: "string", format: "binary" },
          description: "One or more files (max 10 per request)",
        }),
        fileCategory: z.enum(FileCategory),
        refTable: z.string().optional(),
        refRecordId: z.string().uuid().optional(),
      }),
    },
  },
};

registry.registerPath({
  method: "post",
  path: basePath,
  tags,
  summary: "Upload one or more files",
  description:
    "Uploads files for the authenticated user. Extension, true MIME type " +
    "(sniffed from content), virus scan, per-category size limit, and the " +
    "user's storage quota are all enforced server-side. Files are stored " +
    "under a server-decided category folder and queued for background " +
    "processing (resize/transcode/validation).",
  request: { body: multipartUploadBody },
  responses: {
    201: {
      description: "Files accepted and queued for processing",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(MediaUploadResultSchema),
          }),
        },
      },
    },
    400: {
      description:
        "Invalid extension, MIME mismatch, file too large for its category, " +
        "virus detected, storage quota exceeded, or no file provided",
    },
    401: { description: "Missing or invalid access token" },
    413: {
      description: "Request payload exceeds the absolute multipart limit",
    },
  },
});

registry.registerPath({
  method: "put",
  path: `${basePath}/{id}`,
  tags,
  summary: "Replace an existing file's contents",
  description:
    "Uploads a new file and soft-deletes the old one it replaces. The file " +
    "must belong to the authenticated user, must not be dispute-locked, and " +
    "the replacement is validated with the same per-category rules as upload.",
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            file: z.string().openapi({
              type: "string",
              format: "binary",
              description: "The replacement file",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "File replaced; new file queued for processing",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: MediaUploadResultSchema,
          }),
        },
      },
    },
    400: {
      description:
        "Invalid extension, MIME mismatch, file too large, virus detected, " +
        "quota exceeded, or no file provided",
    },
    401: { description: "Missing or invalid access token" },
    404: { description: "File not found or not owned by the caller" },
    409: { description: "File is dispute-locked and cannot be replaced" },
    413: {
      description: "Request payload exceeds the absolute multipart limit",
    },
  },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/{id}`,
  tags,
  summary: "Soft-delete a file",
  description:
    "Soft-deletes a file owned by the authenticated user. Bytes are retained " +
    "for 30 days per policy and removed by a scheduled hard-delete job. " +
    "Dispute-locked files cannot be deleted.",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "File soft-deleted",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ deleted: z.boolean() }),
          }),
        },
      },
    },
    401: { description: "Missing or invalid access token" },
    404: { description: "File not found or not owned by the caller" },
    409: { description: "File is dispute-locked and cannot be deleted" },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}/url`,
  tags,
  summary: "Resolve a file id to a fully qualified URL",
  description:
    "Returns the current public URL for a file owned by the authenticated " +
    "user. The base URL is applied at request time from the active storage " +
    "adapter, so stored records never contain a hardcoded host.",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "Resolved URL",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: MediaUrlResponseSchema,
          }),
        },
      },
    },
    401: { description: "Missing or invalid access token" },
    404: { description: "File not found, deleted, or not owned by the caller" },
  },
});
