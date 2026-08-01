import { registry } from "../../docs/openapi.registry";
import {
  StartConversationSchema,
  SendMessageSchema,
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
  MarkAsReadSchema,
  FreezeConversationSchema,
  WarnParticipantSchema,
  ReviewModerationSchema,
  ListModerationQueueQuerySchema,
} from "./messaging.types";

const tags = ["Messaging"];
const adminTags = ["Messaging — Admin"];
const basePath = "/api/v1/messaging";
const adminBasePath = "/api/v1/admin/messaging";
const bearer = { security: [{ bearerAuth: [] }] };

registry.registerPath({
  method: "post",
  path: `${basePath}/start`,
  tags,
  summary: "Start (or resume) the one conversation a Parent/Student has with a tutor",
  description:
    "Only Parent/Student may initiate — 403 if the caller is a tutor. Returns the existing conversation if one already exists for this pair (never creates a duplicate); otherwise creates a new Inquiry conversation.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: StartConversationSchema } } } },
  responses: { 201: { description: "{ conversation: Conversation }" } },
});

registry.registerPath({
  method: "get",
  path: basePath,
  tags,
  summary: "List my conversations",
  description: "Cursor-paginated, ordered by most recent activity. tab=active|archived.",
  ...bearer,
  request: { query: ListConversationsQuerySchema },
  responses: { 200: { description: "Cursor-paginated conversations" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/unread-count`,
  tags,
  summary: "Get my total unread message count across all non-archived conversations",
  ...bearer,
  responses: { 200: { description: "{ unreadCount: number }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}/summary`,
  tags,
  summary: "Get conversation metadata (participant-facing)",
  description: "Other participant's display info, type/status, and — for an Inquiry — messages remaining before a booking is required.",
  ...bearer,
  responses: { 200: { description: "{ conversationId, type, status, otherParticipant, messagesRemaining }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}/messages`,
  tags,
  summary: "List messages in a conversation (reverse-chronological, cursor-paginated)",
  ...bearer,
  request: { query: ListMessagesQuerySchema },
  responses: { 200: { description: "Cursor-paginated messages" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/messages`,
  tags,
  summary: "Send a message",
  description:
    "Plain text, 2000 char max. Passed through the three-layer content filter before persistence — a blocked attempt is never partially delivered and returns 400 without creating a Message row. Inquiry conversations are capped at the configured combined-message limit (403 once reached).",
  ...bearer,
  request: { body: { content: { "application/json": { schema: SendMessageSchema } } } },
  responses: { 201: { description: "{ message: Message }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/read`,
  tags,
  summary: "Mark messages as read",
  description: "Batched — pass every message ID that entered the viewport in the client's read-batching window.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: MarkAsReadSchema } } } },
  responses: { 200: { description: "{ unreadCount: number }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/freeze`,
  tags: adminTags,
  summary: "Moderator freezes a conversation (read-only pending investigation)",
  ...bearer,
  request: { body: { content: { "application/json": { schema: FreezeConversationSchema } } } },
  responses: { 200: { description: "{ conversation: Conversation }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/unfreeze`,
  tags: adminTags,
  summary: "Moderator unfreezes a conversation",
  ...bearer,
  responses: { 200: { description: "{ conversation: Conversation }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/warn`,
  tags: adminTags,
  summary: "Moderator issues a system-message warning into a conversation",
  ...bearer,
  request: { body: { content: { "application/json": { schema: WarnParticipantSchema } } } },
  responses: { 200: { description: "{ conversationId: string, note: string }" } },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/messages/{messageId}`,
  tags: adminTags,
  summary: "Admin soft-deletes a message",
  description: "Content is replaced by a fixed removal notice visible to both parties. Moderators cannot delete — Admin only.",
  ...bearer,
  responses: { 200: { description: "{ message: Message }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}`,
  tags: adminTags,
  summary: "Admin/Moderator: get any conversation with full message history and filter-block log",
  ...bearer,
  responses: { 200: { description: "{ conversation: Conversation }" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/moderation-queue`,
  tags: adminTags,
  summary: "List the moderation queue (flagged conversations)",
  ...bearer,
  request: { query: ListModerationQueueQuerySchema },
  responses: { 200: { description: "Cursor-paginated moderation reviews" } },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/moderation-queue/{id}/review`,
  tags: adminTags,
  summary: "Moderator/Admin resolves a moderation queue item",
  ...bearer,
  request: { body: { content: { "application/json": { schema: ReviewModerationSchema } } } },
  responses: { 200: { description: "{ review: ModerationReview }" } },
});
