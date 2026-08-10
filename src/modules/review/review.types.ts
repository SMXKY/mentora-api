import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { ReportReason, ReviewReportStatus, IncidentReason } from "../../generated/prisma";

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

export const REVIEW_SORT_OPTIONS = ["newest", "oldest", "highest", "lowest"] as const;
export type ReviewSortOption = (typeof REVIEW_SORT_OPTIONS)[number];

export const ListTutorReviewsQuerySchema = z
  .object({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
    sort: z.enum(REVIEW_SORT_OPTIONS).optional().default("newest"),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    wouldRebook: z.coerce.boolean().optional(),
  })
  .openapi("ListTutorReviewsQuery");
export type ListTutorReviewsQueryInput = z.infer<typeof ListTutorReviewsQuerySchema>;

export const ReportReviewSchema = z
  .object({
    reason: z.nativeEnum(ReportReason),
    description: z.string().trim().max(500).optional(),
  })
  .openapi("ReportReview");
export type ReportReviewInput = z.infer<typeof ReportReviewSchema>;

export const ReviewReviewReportSchema = z
  .object({
    status: z.enum(["DISMISSED", "REMOVED", "ESCALATED"]),
    reviewNote: z.string().trim().min(1).max(1000).optional(),
  })
  .openapi("ReviewReviewReport");
export type ReviewReviewReportInput = z.infer<typeof ReviewReviewReportSchema>;

export const ListReviewReportsQuerySchema = z
  .object({
    status: z.nativeEnum(ReviewReportStatus).optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .openapi("ListReviewReportsQuery");
export type ListReviewReportsQueryInput = z.infer<typeof ListReviewReportsQuerySchema>;

export const SubmitIncidentReportSchema = z
  .object({
    reason: z.nativeEnum(IncidentReason),
    description: z.string().trim().min(20).max(2000),
  })
  .openapi("SubmitIncidentReport");
export type SubmitIncidentReportInput = z.infer<typeof SubmitIncidentReportSchema>;

export const ReviewIncidentReportSchema = z
  .object({
    reviewNote: z.string().trim().max(1000).optional(),
    actionTaken: z.string().trim().max(255).optional(),
  })
  .openapi("ReviewIncidentReport");
export type ReviewIncidentReportInput = z.infer<typeof ReviewIncidentReportSchema>;

export const ListIncidentReportsQuerySchema = z
  .object({
    bookingId: z.string().uuid().optional(),
    reviewed: z.coerce.boolean().optional(),
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  })
  .openapi("ListIncidentReportsQuery");
export type ListIncidentReportsQueryInput = z.infer<typeof ListIncidentReportsQuerySchema>;
