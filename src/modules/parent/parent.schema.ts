import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const CreateManagedStudentSchema = z
  .object({
    firstName: z.string().min(1, "parent/errors:firstNameRequired"),
    dob: z.string().datetime().optional(),
    levelId: z.string().uuid().optional(),
    schoolType: z.enum(["PRIMARY", "SECONDARY", "GCE", "UNIVERSITY", "OTHER"]).optional(),
    examOrGoal: z.string().max(255).optional(),
    preferredMode: z.enum(["ONLINE", "HOME", "BOTH"]).optional(),
    preferredLanguage: z.enum(["EN", "FR"]).optional(),
    specialNotes: z.string().optional(),
  })
  .openapi("CreateManagedStudent");
export type CreateManagedStudentInput = z.infer<typeof CreateManagedStudentSchema>;

export const UpdateManagedStudentSchema = CreateManagedStudentSchema.partial().openapi(
  "UpdateManagedStudent"
);
export type UpdateManagedStudentInput = z.infer<typeof UpdateManagedStudentSchema>;
