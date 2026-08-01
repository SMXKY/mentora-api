import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// ============================================================
// Module 11 — Availability management — zod schemas & types
// ============================================================

export const AvailabilityDayEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

const TimeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Expected HH:mm 24-hour time");

const baseSlotFields = {
  startTime: TimeStringSchema,
  endTime: TimeStringSchema,
  bufferMinutes: z.number().int().min(0).max(180).optional().default(30),
};

export const CreateAvailabilitySlotSchema = z
  .discriminatedUnion("slotType", [
    z.object({
      slotType: z.literal("RECURRING"),
      dayOfWeek: AvailabilityDayEnum,
      ...baseSlotFields,
    }),
    z.object({
      slotType: z.literal("SPECIFIC_DATE"),
      specificDate: z.string().date(),
      ...baseSlotFields,
    }),
  ])
  .refine((v) => v.startTime < v.endTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  })
  .openapi("CreateAvailabilitySlot");
export type CreateAvailabilitySlotInput = z.infer<typeof CreateAvailabilitySlotSchema>;

export const UpdateAvailabilitySlotSchema = z
  .object({
    startTime: TimeStringSchema.optional(),
    endTime: TimeStringSchema.optional(),
    bufferMinutes: z.number().int().min(0).max(180).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => !v.startTime || !v.endTime || v.startTime < v.endTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  })
  .openapi("UpdateAvailabilitySlot");
export type UpdateAvailabilitySlotInput = z.infer<typeof UpdateAvailabilitySlotSchema>;

export const AvailableWindowsQuerySchema = z
  .object({
    date: z.string().date(),
  })
  .openapi("AvailableWindowsQuery");
export type AvailableWindowsQueryInput = z.infer<typeof AvailableWindowsQuerySchema>;
