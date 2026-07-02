import { registry } from "../../docs/openapi.registry";
import { PermissionResponseSchema } from "./permission.schema";
import { z } from "zod";

// ============================================================
// PERMISSION — OPENAPI ROUTE REGISTRATIONS
// This module is READ-ONLY (see permission.service.ts) — there is
// no create/update/delete route. Run npm run docs:build after
// updating this file to regenerate docs/api/openapi.json
// ============================================================

const tags = ["Permission"];
const basePath = "/api/v1/permissions";

const envelope = <T extends z.ZodTypeAny>(data: T) =>
  z.object({ success: z.boolean(), data, meta: z.any().optional() });

registry.registerPath({
  method: "get",
  path: basePath,
  tags,
  summary: "Get all permissions (offset paginated)",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
      search: z.string().optional(),
      include: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "List of permissions",
      content: {
        "application/json": {
          schema: envelope(z.array(PermissionResponseSchema)),
        },
      },
    },
    400: { description: "Invalid query parameters" },
    401: { description: "Not authenticated" },
    403: { description: "Caller lacks rbac.permissions.read" },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/search`,
  tags,
  summary: "Search permissions (cursor paginated)",
  request: {
    query: z.object({
      cursor: z.string().uuid().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
      include: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Search results",
      content: {
        "application/json": {
          schema: envelope(z.array(PermissionResponseSchema)),
        },
      },
    },
    400: { description: "Invalid query parameters" },
    401: { description: "Not authenticated" },
    403: { description: "Caller lacks rbac.permissions.read" },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}`,
  tags,
  summary: "Get permission by ID",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "Permission found",
      content: {
        "application/json": { schema: envelope(PermissionResponseSchema) },
      },
    },
    400: { description: "Invalid id format" },
    401: { description: "Not authenticated" },
    403: { description: "Caller lacks rbac.permissions.read" },
    404: { description: "Permission not found" },
  },
});
