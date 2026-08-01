import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ============================================================
// Module 16 — Lesson Confirmation & Disputes — zod schemas & types
// ============================================================

export const DisputeReasonEnum = z.enum([
  "LESSON_DID_NOT_HAPPEN",
  "LESSON_SIGNIFICANTLY_SHORTER",
  "TUTOR_DID_NOT_COVER_SUBJECT",
  "TUTOR_BEHAVIOUR_INAPPROPRIATE",
  "TECHNICAL_ISSUES_PREVENTED_LESSON",
  "OTHER",
]);

export const ConfirmLessonSchema = z.object({}).openapi("ConfirmLesson");

export const OpenDisputeSchema = z
  .object({
    reason: DisputeReasonEnum,
    // Loose zod bound (1-2000) — the real 30/1000 bound is enforced in the
    // service layer against the live admin-configurable dispute config,
    // so an admin can tighten/loosen it without a redeploy.
    description: z.string().trim().min(1).max(2000),
    evidenceFileIds: z.array(z.string().uuid()).max(10).optional(),
  })
  .openapi("OpenDispute");
export type OpenDisputeInput = z.infer<typeof OpenDisputeSchema>;

export const RespondToDisputeSchema = z
  .object({
    statement: z.string().trim().min(10).max(2000),
    evidenceFileIds: z.array(z.string().uuid()).max(10).optional(),
  })
  .openapi("RespondToDispute");
export type RespondToDisputeInput = z.infer<typeof RespondToDisputeSchema>;

export const ResolveDisputeSchema = z
  .object({
    resolution: z.enum(["TUTOR_FAVOR", "PARENT_FAVOR"]),
    reason: z.string().trim().min(30).max(2000),
  })
  .openapi("ResolveDispute");
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>;

export const ListDisputesQuerySchema = z
  .object({
    status: z.string().optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .openapi("ListDisputesQuery");
export type ListDisputesQueryInput = z.infer<typeof ListDisputesQuerySchema>;
