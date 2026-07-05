import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const UpdateMyStudentProfileSchema = z
  .object({
    firstName: z.string().min(1, "student/errors:firstNameRequired"),
    dob: z.string().datetime().optional(),
    levelId: z.string().uuid().optional(),
    schoolType: z.enum(["PRIMARY", "SECONDARY", "GCE", "UNIVERSITY", "OTHER"]).optional(),
    examOrGoal: z.string().max(255).optional(),
    preferredMode: z.enum(["ONLINE", "HOME", "BOTH"]).optional(),
    preferredLanguage: z.enum(["EN", "FR"]).optional(),
    specialNotes: z.string().optional(),
  })
  .openapi("UpdateMyStudentProfile");
export type UpdateMyStudentProfileInput = z.infer<typeof UpdateMyStudentProfileSchema>;

export const AddSubjectOfInterestSchema = z
  .object({ subjectId: z.string().uuid() })
  .openapi("AddSubjectOfInterest");
export type AddSubjectOfInterestInput = z.infer<typeof AddSubjectOfInterestSchema>;
