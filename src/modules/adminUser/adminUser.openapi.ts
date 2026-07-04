import { registry } from "../../docs/openapi.registry";
import { SuspendUserSchema, SuspensionResponseSchema } from "./adminUser.schema";
import { z } from "zod";

// ============================================================
// ADMIN USER — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Admin — Users"];
const basePath = "/api/v1/admin/users";

registry.registerPath({
  method: "post",
  path: `${basePath}/{user_id}/suspend`,
  tags,
  summary: "Suspend a user account",
  description:
    "Reason is mandatory. Immediately invalidates every active session for " +
    "the account (JTI blocklist in Redis — already-issued tokens stop working " +
    "on their very next request, not just after they naturally expire). If the " +
    "account has active bookings, admins with users.manage are notified. If it " +
    "holds pending escrow funds, the account is flagged for manual review — no " +
    "funds move automatically.",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ user_id: z.string().uuid() }),
    body: { content: { "application/json": { schema: SuspendUserSchema } } },
  },
  responses: {
    200: {
      description: "Account suspended",
      content: { "application/json": { schema: SuspensionResponseSchema } },
    },
    400: { description: "Reason missing or empty" },
    401: { description: "No valid session token" },
    403: { description: "Missing users.suspend permission" },
    404: { description: "User not found" },
    409: { description: "Account is already suspended or is permanently banned" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{user_id}/unsuspend`,
  tags,
  summary: "Lift a user account's suspension",
  description:
    "Returns the account to ACTIVE status and marks the most recent open " +
    "AccountSuspension record as lifted by the acting admin.",
  security: [{ bearerAuth: [] }],
  request: { params: z.object({ user_id: z.string().uuid() }) },
  responses: {
    200: {
      description: "Suspension lifted",
      content: { "application/json": { schema: SuspensionResponseSchema } },
    },
    401: { description: "No valid session token" },
    403: { description: "Missing users.unsuspend permission" },
    404: { description: "User not found" },
    409: { description: "Account is not currently suspended" },
  },
});
