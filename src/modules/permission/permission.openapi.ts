import { registry } from "../../docs/openapi.registry";
import {
  CreatePermissionSchema,
  UpdatePermissionSchema,
  PermissionResponseSchema,
} from "./permission.schema";
import { z } from "zod";

// ============================================================
// PERMISSION — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Permission"];
const basePath = "/api/v1/permissions";

registry.registerPath({
  method: "post",
  path: basePath,
  tags,
  summary: "Create a new permission",
  request: {
    body: {
      content: { "application/json": { schema: CreatePermissionSchema } },
    },
  },
  responses: {
    201: {
      description: "Permission created successfully",
      content: { "application/json": { schema: PermissionResponseSchema } },
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
  summary: "Get all permissions (offset paginated)",
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
      description: "List of permissions",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(PermissionResponseSchema),
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
  summary: "Search permissions (cursor paginated)",
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
            data: z.array(PermissionResponseSchema),
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
  summary: "Get permission by ID",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "Permission found",
      content: { "application/json": { schema: PermissionResponseSchema } },
    },
    404: { description: "Permission not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/{id}`,
  tags,
  summary: "Update permission",
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: UpdatePermissionSchema } },
    },
  },
  responses: {
    200: {
      description: "Permission updated",
      content: { "application/json": { schema: PermissionResponseSchema } },
    },
    404: { description: "Permission not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/{id}`,
  tags,
  summary: "Delete permission",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "Permission deleted" },
    404: { description: "Permission not found" },
  },
});
