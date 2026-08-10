import { registry } from "../../docs/openapi.registry";
import { z } from "zod";
import {
  SubmitReviewSchema,
  ListTutorReviewsQuerySchema,
  ReportReviewSchema,
  ReviewReviewReportSchema,
  ListReviewReportsQuerySchema,
  SubmitIncidentReportSchema,
  ReviewIncidentReportSchema,
  ListIncidentReportsQuerySchema,
} from "./review.types";

const tags = ["Reviews"];
const basePath = "/api/v1/reviews";
const adminTags = ["Reviews — Admin"];
const adminBasePath = "/api/v1/admin/reviews";
const bearer = { security: [{ bearerAuth: [] }] };

registry.registerPath({
  method: "post",
  path: `${basePath}/bookings/{bookingId}/review`,
  tags,
  summary: "Submit a double-blind review for a finished booking",
  description:
    "The review window opens once a booking is confirmed, auto-confirmed, or a dispute resolves. Both sides' reviews stay hidden until both have submitted, or the window closes.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: SubmitReviewSchema } } } },
  responses: { 201: { description: "{ review: Review }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/response`,
  tags,
  summary: "Tutor responds to a review about them",
  ...bearer,
  request: { body: { content: { "application/json": { schema: z.object({ response: z.string().min(1).max(1000) }) } } } },
  responses: { 200: { description: "{ review: Review }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/tutors/{tutorProfileId}`,
  tags,
  summary: "List a tutor's revealed reviews",
  description: "Public, cursor-paginated, sortable and filterable. Soft-removed reviews stay in the list with a replacement notice.",
  request: { query: ListTutorReviewsQuerySchema },
  responses: { 200: { description: "Cursor-paginated reviews" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/report`,
  tags,
  summary: "Report a review for a policy violation (REQ-017-008)",
  ...bearer,
  request: { body: { content: { "application/json": { schema: ReportReviewSchema } } } },
  responses: { 201: { description: "{ id: string }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/bookings/{bookingId}/incident-report`,
  tags,
  summary: "File an incident report for a finished booking (REQ-017-009)",
  description: "Does not freeze escrow or affect payment. Captures a full booking/session/conversation evidence snapshot for Moderator review.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: SubmitIncidentReportSchema } } } },
  responses: { 201: { description: "{ incidentReport: IncidentReport }" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/reports`,
  tags: adminTags,
  summary: "List the review-report moderation queue",
  ...bearer,
  request: { query: ListReviewReportsQuerySchema },
  responses: { 200: { description: "Cursor-paginated review reports" } },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/reports/{id}/review`,
  tags: adminTags,
  summary: "Moderator resolves a review report: dismiss, remove (soft-delete with notice), or escalate",
  ...bearer,
  request: { body: { content: { "application/json": { schema: ReviewReviewReportSchema } } } },
  responses: { 200: { description: "{ report: ReviewReport }" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/incidents`,
  tags: adminTags,
  summary: "List incident reports",
  ...bearer,
  request: { query: ListIncidentReportsQuerySchema },
  responses: { 200: { description: "Cursor-paginated incident reports" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/incidents/{id}`,
  tags: adminTags,
  summary: "Get an incident report with its full evidence snapshot",
  ...bearer,
  responses: { 200: { description: "{ incidentReport: IncidentReport & { evidenceSnapshot } }" } },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/incidents/{id}/review`,
  tags: adminTags,
  summary: "Moderator marks an incident report reviewed",
  ...bearer,
  request: { body: { content: { "application/json": { schema: ReviewIncidentReportSchema } } } },
  responses: { 200: { description: "{ incidentReport: IncidentReport }" } },
});
