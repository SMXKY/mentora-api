import { registry } from "../../docs/openapi.registry";
import {
  GrantPermissionOverrideSchema,
  RevokePermissionOverrideSchema,
  PermissionOverrideResponseSchema,
} from "./permissionOverride.schema";
import { z } from "zod";

// ============================================================
// PERMISSIONOVERRIDE — OPENAPI ROUTE REGISTRATIONS
// This module exposes grant/revoke/list/clear, not generic CRUD —
// see permissionOverride.route.ts. Run npm run docs:build after
// updating this file to regenerate docs/api/openapi.json
// ============================================================

const tags = ["PermissionOverride"];
const basePath = "/api/v1/permission-overrides";

registry.registerPath({
  method: "post",
  path: `${basePath}/grant`,
  tags,
  summary: "Grant a user a permission directly, independent of their role",
  request: {
    body: {
      content: { "application/json": { schema: GrantPermissionOverrideSchema } },
    },
  },
  responses: {
    201: {
      description: "Override granted successfully",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            result: PermissionOverrideResponseSchema,
          }),
        },
      },
    },
    400: { description: "Validation error (e.g. expiresAt not in the future)" },
    401: { description: "Not authenticated" },
    403: { description: "Caller lacks rbac.overrides.grant" },
    404: { description: "User or permission not found" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/revoke`,
  tags,
  summary: "Revoke a permission from a user directly, overriding their role",
  request: {
    body: {
      content: {
        "application/json": { schema: RevokePermissionOverrideSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Override revoked successfully",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            result: PermissionOverrideResponseSchema,
          }),
        },
      },
    },
    400: { description: "Validation error (e.g. expiresAt not in the future)" },
    401: { description: "Not authenticated" },
    403: { description: "Caller lacks rbac.overrides.revoke" },
    404: { description: "User or permission not found" },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/user/{userId}`,
  tags,
  summary: "List active permission overrides for a user",
  request: { params: z.object({ userId: z.string().uuid() }) },
  responses: {
    200: {
      description: "Active overrides for the user",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            result: z.array(PermissionOverrideResponseSchema),
          }),
        },
      },
    },
    400: { description: "Invalid userId format" },
    401: { description: "Not authenticated" },
    403: { description: "Caller lacks rbac.overrides.read" },
  },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/{id}`,
  tags,
  summary: "Clear (permanently remove) a permission override",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "Override cleared successfully",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            result: z.object({ cleared: z.literal(true) }),
          }),
        },
      },
    },
    400: { description: "Invalid id format" },
    401: { description: "Not authenticated" },
    403: { description: "Caller lacks rbac.overrides.revoke" },
    404: { description: "Override not found" },
  },
});
