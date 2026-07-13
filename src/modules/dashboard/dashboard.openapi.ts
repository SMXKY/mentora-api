import { registry } from "../../docs/openapi.registry";
import { DashboardResponseSchema } from "./dashboard.schema";
import { z } from "zod";

// ============================================================
// DASHBOARD — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Dashboard"];
const basePath = "/api/v1/dashboards";

registry.registerPath({
  method: "get",
  path: `${basePath}/me`,
  tags,
  summary: "Get the caller's role-appropriate dashboard summary",
  description:
    "Single aggregated endpoint — the response shape is discriminated by " +
    "the `role` field (PARENT/STUDENT/TUTOR/ADMIN/SUPER_ADMIN), resolved " +
    "server-side from the caller's active role. Cached per-user for 30s; " +
    "pass ?fresh=true to bypass the cache and recompute immediately.",
  request: {
    query: z.object({
      fresh: z.enum(["true", "false"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "The caller's dashboard, shaped for their role",
      content: { "application/json": { schema: DashboardResponseSchema } },
    },
    401: { description: "Missing or invalid access token" },
  },
});
