import { registry } from "../../docs/openapi.registry";
import {
  CreateRoleSchema,
  UpdateRoleSchema,
  RoleResponseSchema,
} from "./role.schema";
import { z } from "zod";

// ============================================================
// ROLE — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Role"];
const basePath = "/api/v1/roles";

registry.registerPath({
  method: "post",
  path: basePath,
  tags,
  summary: "Create a new role",
  request: {
    body: {
      content: { "application/json": { schema: CreateRoleSchema } },
    },
  },
  responses: {
    201: {
      description: "Role created successfully",
      content: { "application/json": { schema: RoleResponseSchema } },
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
  summary: "Get all roles (offset paginated)",
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
      description: "List of roles",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(RoleResponseSchema),
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
  summary: "Search roles (cursor paginated)",
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
            data: z.array(RoleResponseSchema),
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
  summary: "Get role by ID",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "Role found",
      content: { "application/json": { schema: RoleResponseSchema } },
    },
    404: { description: "Role not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/{id}`,
  tags,
  summary: "Update role",
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: UpdateRoleSchema } },
    },
  },
  responses: {
    200: {
      description: "Role updated",
      content: { "application/json": { schema: RoleResponseSchema } },
    },
    404: { description: "Role not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/{id}`,
  tags,
  summary: "Delete role",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "Role deleted" },
    404: { description: "Role not found" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/assign/{userId}`,
  tags,
  summary: "Assign a role to a user",
  request: {
    params: z.object({ userId: z.string().uuid() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            roleId: z.string().uuid(),
            reason: z.string().max(255).optional(),
            expiresAt: z.string().datetime().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Role assigned successfully",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            data: z.object({
              id: z.string().uuid(),
              userId: z.string().uuid(),
              roleId: z.string().uuid(),
              isActive: z.boolean(),
              expiresAt: z.string().datetime().nullable(),
              createdAt: z.string().datetime(),
            }),
          }),
        },
      },
    },
    400: {
      description:
        "Invalid request — duplicate role, regular user already has a role, or target role disallows multiple assignments",
    },
    403: { description: "Caller lacks permission to assign roles" },
    404: { description: "User or role not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/unassign/{userId}/{userRoleId}`,
  tags,
  summary: "Unassign (deactivate) a role from a user",
  request: {
    params: z.object({
      userId: z.string().uuid(),
      userRoleId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Role unassigned successfully",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            data: z.object({
              id: z.string().uuid(),
              userId: z.string().uuid(),
              roleId: z.string().uuid(),
              isActive: z.boolean(),
              updatedAt: z.string().datetime(),
            }),
          }),
        },
      },
    },
    400: { description: "Role assignment is already inactive" },
    403: { description: "Caller lacks permission to unassign roles" },
    404: { description: "User role assignment not found" },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/history/{userId}`,
  tags,
  summary: "Get a user's role assignment history",
  request: {
    params: z.object({ userId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: "Role assignment history retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            data: z.array(
              z.object({
                id: z.string().uuid(),
                userId: z.string().uuid(),
                roleId: z.string().uuid(),
                isActive: z.boolean(),
                reason: z.string().nullable(),
                expiresAt: z.string().datetime().nullable(),
                createdAt: z.string().datetime(),
                updatedAt: z.string().datetime(),
                role: z.object({
                  id: z.string().uuid(),
                  name: z.string(),
                }),
                createdBy: z.object({
                  id: z.string().uuid(),
                  email: z.string().email().optional(),
                }),
              })
            ),
          }),
        },
      },
    },
    403: { description: "Caller lacks permission to view role history" },
    404: { description: "User not found" },
  },
});
