import { registry } from "../../docs/openapi.registry";
import {
  CreateAuditLogSchema,
  UpdateAuditLogSchema,
  AuditLogResponseSchema,
} from "./auditLog.schema";
import { z } from "zod";

// ============================================================
// AUDITLOG — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["AuditLog"];
const basePath = "/api/v1/auditLogs";

registry.registerPath({
  method: "get",
  path: basePath,
  tags,
  summary: "Get all auditLogs (offset paginated)",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "List of auditLogs",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(AuditLogResponseSchema),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              totalPages: z.number(),
              hasNextPage: z.boolean(),
              hasPrevPage: z.boolean(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/search`,
  tags,
  summary: "Search auditLogs (cursor paginated)",
  request: {
    query: z.object({
      cursor: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Search results",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(AuditLogResponseSchema),
            meta: z.object({
              nextCursor: z.string().nullable(),
              hasNextPage: z.boolean(),
              limit: z.number(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}`,
  tags,
  summary: "Get auditLog by ID",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "AuditLog found",
      content: { "application/json": { schema: AuditLogResponseSchema } },
    },
    404: { description: "AuditLog not found" },
  },
});
