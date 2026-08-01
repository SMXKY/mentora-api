import { registry } from "../../docs/openapi.registry";
import { z } from "zod";
import { SubmitReviewSchema, ListTutorReviewsQuerySchema } from "./review.types";

const tags = ["Reviews"];
const basePath = "/api/v1/reviews";
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
  description: "Public, cursor-paginated.",
  request: { query: ListTutorReviewsQuerySchema },
  responses: { 200: { description: "Cursor-paginated reviews" } },
});
