import { registry } from "../../docs/openapi.registry";
import {
  CreatePermissionOverrideSchema,
  UpdatePermissionOverrideSchema,
  PermissionOverrideResponseSchema,
} from "./permissionOverride.schema";
import { z } from "zod";

// ============================================================
// PERMISSIONOVERRIDE — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["PermissionOverride"];
const basePath = "/api/v1/permissionOverrides";

registry.registerPath({
  method: "post",
  path: basePath,
  tags,
  summary: "Create a new permissionOverride",
  request: {
    body: {
      content: { "application/json": { schema: CreatePermissionOverrideSchema } },
    },
  },
  responses: {
    201: {
      description: "PermissionOverride created successfully",
      content: { "application/json": { schema: PermissionOverrideResponseSchema } },
    },
    400: { description: "Validation error" },
    401: { description: "Unauthorised" },
    403: { description: "Forbidden" },
  },
});

registry.registerPath({
  method: "get",
  path: basePath,
  tags,
  summary: "Get all permissionOverrides (offset paginated)",
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
      description: "List of permissionOverrides",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(PermissionOverrideResponseSchema),
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
  summary: "Search permissionOverrides (cursor paginated)",
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
            data: z.array(PermissionOverrideResponseSchema),
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
  summary: "Get permissionOverride by ID",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "PermissionOverride found",
      content: { "application/json": { schema: PermissionOverrideResponseSchema } },
    },
    404: { description: "PermissionOverride not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/{id}`,
  tags,
  summary: "Update permissionOverride",
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: UpdatePermissionOverrideSchema } },
    },
  },
  responses: {
    200: {
      description: "PermissionOverride updated",
      content: { "application/json": { schema: PermissionOverrideResponseSchema } },
    },
    404: { description: "PermissionOverride not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/{id}`,
  tags,
  summary: "Delete permissionOverride",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "PermissionOverride deleted" },
    404: { description: "PermissionOverride not found" },
  },
});
