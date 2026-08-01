import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

const TimeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Expected HH:mm 24-hour time");

export const CreateGroupSessionSchema = z
  .object({
    subjectId: z.string().uuid(),
    levelId: z.string().uuid(),
    sessionType: z.enum(["ONLINE", "HOME"]),
    sessionDate: z.string().date(),
    sessionStartTime: TimeStringSchema,
    durationMinutes: z.number().int().min(30).max(240),
    topic: z.string().trim().min(3).max(255),
    minStudents: z.number().int().min(2),
    maxStudents: z.number().int().min(2),
    pricePerStudentXaf: z.number().int().min(100),
    registrationCutoffAt: z.string().datetime(),
  })
  .refine((v) => v.maxStudents >= v.minStudents, {
    message: "maxStudents must be >= minStudents",
    path: ["maxStudents"],
  })
  .openapi("CreateGroupSession");
export type CreateGroupSessionInput = z.infer<typeof CreateGroupSessionSchema>;

export const JoinGroupSessionSchema = z
  .object({
    studentProfileId: z.string().uuid().optional(),
  })
  .openapi("JoinGroupSession");
export type JoinGroupSessionInput = z.infer<typeof JoinGroupSessionSchema>;
