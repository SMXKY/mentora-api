import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// bio, teachingMode, and cityId are NOT NULL on TutorProfile — required
// here too so the same schema works for both first-time creation and
// later edits without ever leaving the row in an invalid state.
export const UpdateMyTutorProfileSchema = z
  .object({
    bio: z.string().min(1, "tutor/errors:bioRequired"),
    teachingMode: z.enum(["ONLINE_ONLY", "HOME_ONLY", "BOTH"]),
    cityId: z.string().uuid(),
    neighbourhood: z.string().optional(),
    exactAddress: z.string().optional(),
    yearsOfExperience: z.number().int().min(0).optional(),
    languages: z.array(z.enum(["EN", "FR"])).optional(),
    introVideoUrl: z.string().url().optional(),
    minRateXaf: z.number().int().min(0).optional(),
    maxRateXaf: z.number().int().min(0).optional(),
  })
  .refine((d) => !d.minRateXaf || !d.maxRateXaf || d.minRateXaf <= d.maxRateXaf, {
    message: "tutor/errors:invalidRateRange",
    path: ["maxRateXaf"],
  })
  .openapi("UpdateMyTutorProfile");
export type UpdateMyTutorProfileInput = z.infer<typeof UpdateMyTutorProfileSchema>;

export const UpdateSubjectPricingSchema = z
  .object({
    ratePerOnlineSessionXaf: z.number().int().min(0).optional(),
    ratePerHomeSessionXaf: z.number().int().min(0).optional(),
  })
  .refine((d) => d.ratePerOnlineSessionXaf !== undefined || d.ratePerHomeSessionXaf !== undefined, {
    message: "tutor/errors:atLeastOneRateRequired",
  })
  .openapi("UpdateSubjectPricing");
export type UpdateSubjectPricingInput = z.infer<typeof UpdateSubjectPricingSchema>;
