import { registry } from "../../docs/openapi.registry";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserResponseSchema,
} from "./user.schema";
import { z } from "zod";

// ============================================================
// USER — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["User"];
const basePath = "/api/v1/users";

registry.registerPath({
  method: "post",
  path: basePath,
  tags,
  summary: "Create a new user",
  request: {
    body: {
      content: { "application/json": { schema: CreateUserSchema } },
    },
  },
  responses: {
    201: {
      description: "User created successfully",
      content: { "application/json": { schema: UserResponseSchema } },
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
  summary: "Get all users (offset paginated)",
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
      description: "List of users",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(UserResponseSchema),
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
  summary: "Search users (cursor paginated)",
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
            data: z.array(UserResponseSchema),
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
  summary: "Get user by ID",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "User found",
      content: { "application/json": { schema: UserResponseSchema } },
    },
    404: { description: "User not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/{id}`,
  tags,
  summary: "Update user",
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: UpdateUserSchema } },
    },
  },
  responses: {
    200: {
      description: "User updated",
      content: { "application/json": { schema: UserResponseSchema } },
    },
    404: { description: "User not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/{id}`,
  tags,
  summary: "Delete user",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "User deleted" },
    404: { description: "User not found" },
  },
});
