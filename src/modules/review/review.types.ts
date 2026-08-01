import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const SubmitReviewSchema = z
  .object({
    overallRating: z.number().int().min(1).max(5),
    wouldRebook: z.boolean(),
    ratingSubjectKnowledge: z.number().int().min(1).max(5).optional(),
    ratingCommunication: z.number().int().min(1).max(5).optional(),
    ratingPunctuality: z.number().int().min(1).max(5).optional(),
    writtenReview: z.string().trim().max(2000).optional(),
  })
  .openapi("SubmitReview");
export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;

export const ListTutorReviewsQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .openapi("ListTutorReviewsQuery");
export type ListTutorReviewsQueryInput = z.infer<typeof ListTutorReviewsQuerySchema>;
