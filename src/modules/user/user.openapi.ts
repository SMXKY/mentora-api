import { registry } from "../../docs/openapi.registry";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UpdateMeSchema,
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

// ── Self-service ─────────────────────────────────────────────────────────────

registry.registerPath({
  method: "patch",
  path: `${basePath}/me`,
  tags,
  summary: "Update the caller's own profile",
  description:
    "Self-service subset of user fields — excludes anything only an admin may " +
    "change (email, status, isAccountComplete, username, etc). Scoped to the " +
    "caller; there is no id in the path.",
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { "application/json": { schema: UpdateMeSchema } } },
  },
  responses: {
    200: {
      description: "Profile updated",
      content: { "application/json": { schema: UserResponseSchema } },
    },
    400: { description: "Validation error" },
    401: { description: "No valid session token" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/me/profile-picture`,
  tags,
  summary: "Replace the caller's own profile picture",
  description:
    "Uploads through the same pipeline as any other media file — real MIME " +
    "sniffing, virus scan, and quota enforcement all apply. The previous " +
    "profile photo (if any) is soft-deleted once the new one is confirmed.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "multipart/form-data": {
          schema: z.object({
            profilePicture: z.string().openapi({
              type: "string",
              format: "binary",
              description: "JPEG, PNG, or WebP, up to 5MB",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Profile picture updated",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ url: z.string().url() }),
          }),
        },
      },
    },
    400: {
      description:
        "No file provided, invalid extension/MIME, file too large, or virus detected",
    },
    401: { description: "No valid session token" },
  },
});
