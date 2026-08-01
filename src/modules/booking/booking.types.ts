import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ============================================================
// Module 11 — Booking & Scheduling — zod schemas & types
// ============================================================

export const SessionTypeEnum = z.enum(["ONLINE", "HOME"]);

const TimeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Expected HH:mm 24-hour time");

export const CreateBookingRequestSchema = z
  .object({
    tutorProfileId: z.string().uuid(),
    studentProfileId: z.string().uuid().optional(),
    subjectId: z.string().uuid(),
    levelId: z.string().uuid(),
    sessionType: SessionTypeEnum,
    sessionDate: z.string().date(),
    sessionStartTime: TimeStringSchema,
    durationMinutes: z.number().int().min(30).max(240),
    messageToTutor: z.string().trim().max(1000).optional(),
  })
  .openapi("CreateBookingRequest");
export type CreateBookingRequestInput = z.infer<typeof CreateBookingRequestSchema>;

export const RejectBookingSchema = z
  .object({
    reason: z.string().trim().min(5).max(500),
  })
  .openapi("RejectBooking");
export type RejectBookingInput = z.infer<typeof RejectBookingSchema>;

export const CancelBookingSchema = z
  .object({
    reason: z.string().trim().min(5).max(500),
  })
  .openapi("CancelBooking");
export type CancelBookingInput = z.infer<typeof CancelBookingSchema>;

export const RecurrenceTypeEnum = z.enum(["WEEKLY", "BIWEEKLY", "CUSTOM"]);

export const CreateRecurringBookingSchema = z
  .object({
    tutorProfileId: z.string().uuid(),
    studentProfileId: z.string().uuid().optional(),
    subjectId: z.string().uuid(),
    levelId: z.string().uuid(),
    sessionType: SessionTypeEnum,
    sessionStartTime: TimeStringSchema,
    durationMinutes: z.number().int().min(30).max(240),
    recurrenceType: RecurrenceTypeEnum,
    startDate: z.string().date(),
    endDate: z.string().date().optional(),
    occurrenceCount: z.number().int().min(1).max(52).optional(),
    recurrenceDays: z.array(z.string().date()).optional(),
    messageToTutor: z.string().trim().max(1000).optional(),
  })
  .openapi("CreateRecurringBooking");
export type CreateRecurringBookingInput = z.infer<typeof CreateRecurringBookingSchema>;

export const RequestRescheduleSchema = z
  .object({
    proposedDate: z.string().date(),
    proposedStartTime: TimeStringSchema,
    proposedEndTime: TimeStringSchema,
    reason: z.string().trim().max(500).optional(),
  })
  .openapi("RequestReschedule");
export type RequestRescheduleInput = z.infer<typeof RequestRescheduleSchema>;

export const RespondToRescheduleSchema = z
  .object({
    accept: z.boolean(),
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .openapi("RespondToReschedule");
export type RespondToRescheduleInput = z.infer<typeof RespondToRescheduleSchema>;

export const ListBookingsQuerySchema = z
  .object({
    status: z.string().optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    // Inclusive sessionDate bounds — lets a caller ask for "everything in
    // this week/month" (e.g. the tutor availability calendar) instead of
    // paging through the full cursor-ordered history.
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
  })
  .openapi("ListBookingsQuery");
export type ListBookingsQueryInput = z.infer<typeof ListBookingsQuerySchema>;
