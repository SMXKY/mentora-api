import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ============================================================
// Module 14 — Live Sessions (LiveKit) — zod schemas & types
// ============================================================

export const ParamsBookingId = z.object({ bookingId: z.string().uuid() });

export const GenerateTokenSchema = z
  .object({
    deviceType: z.enum(["web", "ios", "android"]).optional(),
  })
  .openapi("GenerateSessionToken");
export type GenerateTokenInput = z.infer<typeof GenerateTokenSchema>;

export const MuteParticipantSchema = z
  .object({ targetUserId: z.string().uuid() })
  .openapi("MuteParticipant");
export type MuteParticipantInput = z.infer<typeof MuteParticipantSchema>;

export const RemoveParticipantSchema = z
  .object({ targetUserId: z.string().uuid() })
  .openapi("RemoveParticipant");
export type RemoveParticipantInput = z.infer<typeof RemoveParticipantSchema>;

export const GrantScreenShareSchema = z
  .object({ targetUserId: z.string().uuid() })
  .openapi("GrantScreenShare");
export type GrantScreenShareInput = z.infer<typeof GrantScreenShareSchema>;

export const SendChatMessageSchema = z
  .object({
    content: z.string().trim().min(1).max(2000),
    replyToId: z.string().uuid().optional(),
  })
  .openapi("SendSessionChatMessage");
export type SendChatMessageInput = z.infer<typeof SendChatMessageSchema>;

export const RecordConnectionQualitySchema = z
  .object({
    quality: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR", "LOST"]),
    durationSeconds: z.number().int().min(0).max(3600).optional(),
  })
  .openapi("RecordConnectionQuality");
export type RecordConnectionQualityInput = z.infer<typeof RecordConnectionQualitySchema>;

export const ListChatQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  })
  .openapi("ListSessionChatQuery");
export type ListChatQueryInput = z.infer<typeof ListChatQuerySchema>;
