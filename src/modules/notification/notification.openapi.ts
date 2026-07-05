import { registry } from "../../docs/openapi.registry";
import { NotificationResponseSchema } from "./notification.schema";
import { z } from "zod";

// ============================================================
// NOTIFICATION — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Notification"];
const basePath = "/api/v1/notifications";

const unauthorized = {
  401: { description: "Missing or invalid access token" },
};

registry.registerPath({
  method: "get",
  path: basePath,
  tags,
  summary: "List the authenticated user's notifications (offset paginated)",
  description:
    "Returns only notifications addressed to the caller. Supports " +
    "status filtering (read/unread/all) on top of standard pagination.",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
      status: z.enum(["read", "unread", "all"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "List of the caller's notifications",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(NotificationResponseSchema),
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
    400: { description: "Invalid pagination parameters" },
    ...unauthorized,
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/unread-count`,
  tags,
  summary: "Get the caller's unread notification count",
  description:
    "Lightweight endpoint for badge counters — counts unread, " +
    "non-dismissed notifications belonging to the caller.",
  responses: {
    200: {
      description: "Unread count",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ unread: z.number() }),
          }),
        },
      },
    },
    ...unauthorized,
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}`,
  tags,
  summary: "Get one of the caller's notifications by id",
  description:
    "Returns a single notification. Ids belonging to other users return " +
    "404 — existence is never revealed across accounts.",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "Notification found",
      content: { "application/json": { schema: NotificationResponseSchema } },
    },
    400: { description: "Id is not a valid UUID" },
    ...unauthorized,
    404: { description: "Notification not found or not owned by the caller" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/{id}/read`,
  tags,
  summary: "Mark one notification as read",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "Notification marked read",
      content: { "application/json": { schema: NotificationResponseSchema } },
    },
    400: { description: "Id is not a valid UUID" },
    ...unauthorized,
    404: { description: "Notification not found or not owned by the caller" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/read-all`,
  tags,
  summary: "Mark all of the caller's notifications as read",
  responses: {
    200: {
      description: "Count of notifications transitioned to read",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ markedRead: z.number() }),
          }),
        },
      },
    },
    ...unauthorized,
  },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/{id}`,
  tags,
  summary: "Dismiss one notification",
  description:
    "Per-recipient soft delete — the notification disappears from the " +
    "caller's list only.",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "Notification dismissed",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ dismissed: z.boolean() }),
          }),
        },
      },
    },
    400: { description: "Id is not a valid UUID" },
    ...unauthorized,
    404: { description: "Notification not found or not owned by the caller" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/dismiss-many`,
  tags,
  summary: "Dismiss several notifications at once",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({ ids: z.array(z.string().uuid()).min(1) }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Count of notifications dismissed",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ dismissed: z.number() }),
          }),
        },
      },
    },
    400: { description: "ids missing, empty, or not valid UUIDs" },
    ...unauthorized,
  },
});

// ── WhatsApp webhook (Meta Cloud API) ───────────────────────

registry.registerPath({
  method: "get",
  path: "/api/v1/webhooks/whatsapp",
  tags,
  summary: "Meta webhook verification handshake",
  description:
    "Called once by Meta when the webhook URL is registered. Echoes " +
    "hub.challenge when hub.verify_token matches the configured token.",
  request: {
    query: z.object({
      "hub.mode": z.string(),
      "hub.verify_token": z.string(),
      "hub.challenge": z.string(),
    }),
  },
  responses: {
    200: { description: "Challenge echoed back — webhook verified" },
    403: { description: "Verify token mismatch" },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/webhooks/whatsapp",
  tags,
  summary: "Inbound WhatsApp events from Meta",
  description:
    "Receives delivery status updates and user replies. A STOP reply " +
    "opts the sender's number out of WhatsApp notifications. The request " +
    "is authenticated by verifying the X-Hub-Signature-256 HMAC over the " +
    "raw request bytes.",
  responses: {
    200: { description: "Event accepted" },
    400: { description: "Malformed payload" },
    401: { description: "Signature missing or invalid" },
  },
});
