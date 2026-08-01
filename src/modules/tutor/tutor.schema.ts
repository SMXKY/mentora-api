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
    // introVideoUrl is deliberately NOT settable here — it can only be set
    // via POST /tutors/me/intro-video, which probes the uploaded file's
    // actual duration server-side before accepting it (see
    // tutor.service.ts's uploadIntroVideo). Accepting an arbitrary
    // client-supplied URL here would bypass that check entirely.
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
    ratePerHourXaf: z.number().int().min(0).optional(),
    isOpenForBooking: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.ratePerOnlineSessionXaf !== undefined ||
      d.ratePerHomeSessionXaf !== undefined ||
      d.ratePerHourXaf !== undefined ||
      d.isOpenForBooking !== undefined,
    { message: "tutor/errors:atLeastOneRateRequired" }
  )
  .openapi("UpdateSubjectPricing");
export type UpdateSubjectPricingInput = z.infer<typeof UpdateSubjectPricingSchema>;
