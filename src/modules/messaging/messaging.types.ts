import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ============================================================
// Module 15 — Messaging — zod schemas & types
// ============================================================

export const StartConversationSchema = z
  .object({
    tutorProfileId: z.string().uuid(),
  })
  .openapi("StartConversation");
export type StartConversationInput = z.infer<typeof StartConversationSchema>;

export const SendMessageSchema = z
  .object({
    // Optional now that a message can be an attachment with no caption —
    // the refine below still requires at least one of content/attachment.
    content: z.string().trim().max(2000).optional(),
    replyToId: z.string().uuid().optional(),
    attachmentFileId: z.string().uuid().optional(),
  })
  .refine((data) => !!data.content?.trim() || !!data.attachmentFileId, {
    message: "messaging/errors:messageEmpty",
    path: ["content"],
  })
  .openapi("SendMessage");
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const ListConversationsQuerySchema = z
  .object({
    tab: z.enum(["active", "archived"]).optional().default("active"),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .openapi("ListConversationsQuery");
export type ListConversationsQueryInput = z.infer<typeof ListConversationsQuerySchema>;

export const ListMessagesQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  })
  .openapi("ListMessagesQuery");
export type ListMessagesQueryInput = z.infer<typeof ListMessagesQuerySchema>;

export const MarkAsReadSchema = z
  .object({
    messageIds: z.array(z.string().uuid()).min(1).max(200),
  })
  .openapi("MarkAsRead");
export type MarkAsReadInput = z.infer<typeof MarkAsReadSchema>;

export const FreezeConversationSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .openapi("FreezeConversation");
export type FreezeConversationInput = z.infer<typeof FreezeConversationSchema>;

export const WarnParticipantSchema = z
  .object({
    note: z.string().trim().min(1).max(500),
  })
  .openapi("WarnParticipant");
export type WarnParticipantInput = z.infer<typeof WarnParticipantSchema>;

export const ReviewModerationSchema = z
  .object({
    status: z.enum(["REVIEWED", "ESCALATED", "RESOLVED"]),
    reviewNote: z.string().trim().min(1).max(1000).optional(),
  })
  .openapi("ReviewModeration");
export type ReviewModerationInput = z.infer<typeof ReviewModerationSchema>;

export const ListModerationQueueQuerySchema = z
  .object({
    status: z.string().optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .openapi("ListModerationQueueQuery");
export type ListModerationQueueQueryInput = z.infer<typeof ListModerationQueueQuerySchema>;

export const UpsertFilterKeywordSchema = z
  .object({
    keyword: z.string().trim().min(1).max(255),
    language: z.enum(["EN", "FR", "ANY"]).optional().default("ANY"),
  })
  .openapi("UpsertFilterKeyword");
export type UpsertFilterKeywordInput = z.infer<typeof UpsertFilterKeywordSchema>;
