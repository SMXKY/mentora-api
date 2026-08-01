import { registry } from "../../docs/openapi.registry";
import {
  CreateBookingRequestSchema,
  RejectBookingSchema,
  CancelBookingSchema,
  CreateRecurringBookingSchema,
  RequestRescheduleSchema,
  RespondToRescheduleSchema,
  ListBookingsQuerySchema,
} from "./booking.types";
import { CreateGroupSessionSchema, JoinGroupSessionSchema } from "./groupSession.types";
import { DirectMomoCheckoutSchema } from "../payment/payment.types";

const tags = ["Bookings"];
const groupTags = ["Group Sessions"];
const adminTags = ["Admin Bookings"];
const basePath = "/api/v1/bookings";
const groupBasePath = "/api/v1/group-sessions";
const adminBasePath = "/api/v1/admin/bookings";
const bearer = { security: [{ bearerAuth: [] }] };

registry.registerPath({
  method: "post",
  path: basePath,
  tags,
  summary: "Request a booking with a tutor",
  description:
    "Validates tutor bookability (ACTIVE + intro video + not payment-overdue), subject/level approval, teaching-mode match, and slot availability before creating a REQUESTED booking.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: CreateBookingRequestSchema } } } },
  responses: { 201: { description: "{ booking: Booking }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/mine`,
  tags,
  summary: "List my bookings as a booker (parent/student)",
  ...bearer,
  request: { query: ListBookingsQuerySchema },
  responses: { 200: { description: "Cursor-paginated bookings" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/tutor-mine`,
  tags,
  summary: "List my bookings as a tutor",
  ...bearer,
  request: { query: ListBookingsQuerySchema },
  responses: { 200: { description: "Cursor-paginated bookings" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}`,
  tags,
  summary: "Get a booking (booker or tutor only)",
  ...bearer,
  responses: { 200: { description: "{ booking: Booking }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/accept`,
  tags,
  summary: "Tutor accepts a REQUESTED booking",
  description: "Opens the 24h (configurable) payment window and schedules the reminder/expiry jobs.",
  ...bearer,
  responses: { 200: { description: "{ booking: Booking }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/reject`,
  tags,
  summary: "Tutor rejects a REQUESTED booking",
  ...bearer,
  request: { body: { content: { "application/json": { schema: RejectBookingSchema } } } },
  responses: { 200: { description: "{ booking: Booking }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/withdraw`,
  tags,
  summary: "Booker withdraws a still-unpaid booking",
  ...bearer,
  responses: { 200: { description: "{ booking: Booking }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/cancel-by-tutor`,
  tags,
  summary: "Tutor cancels a confirmed PAID booking",
  description: "Full refund to the parent; tracks a cancellation signal (3-in-30-days -> admin review flag).",
  ...bearer,
  request: { body: { content: { "application/json": { schema: CancelBookingSchema } } } },
  responses: { 200: { description: "{ booking: Booking }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/cancel-by-parent`,
  tags,
  summary: "Parent cancels a PAID booking",
  description: "12h-threshold policy: full refund if ≥ threshold hours before the session, else funds release to the tutor.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: CancelBookingSchema } } } },
  responses: { 200: { description: "{ booking: Booking, refundOutcome: 'FULL_REFUND' | 'RELEASE_TO_TUTOR' }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/recurring`,
  tags,
  summary: "Create a recurring booking series",
  description: "One action creates N independent bookings (weekly/biweekly/custom), each with its own escrow at checkout time.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: CreateRecurringBookingSchema } } } },
  responses: { 201: { description: "{ seriesId, created: Booking[], skipped: string[] }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/series/{seriesId}`,
  tags,
  summary: "List the bookings in a recurring series",
  ...bearer,
  responses: { 200: { description: "{ series: BookingSeries, bookings: Booking[] }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/check-in`,
  tags,
  summary: "Check in for a HOME session",
  description: "Opens 15 minutes before the scheduled start; both parties checking in moves the booking to IN_PROGRESS.",
  ...bearer,
  responses: { 200: { description: "{ booking: Booking }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/check-out`,
  tags,
  summary: "Check out of a HOME session",
  description: "Tutor checkout is the authoritative session-end signal — opens the 48h lesson-confirmation window.",
  ...bearer,
  responses: { 200: { description: "{ booking: Booking }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/confirm`,
  tags,
  summary: "Booker confirms a completed lesson",
  description: "Releases escrow to the tutor immediately instead of waiting for the 48h auto-release, and opens the review window.",
  ...bearer,
  responses: { 200: { description: "{ booking: Booking }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/reschedule`,
  tags,
  summary: "Request a reschedule",
  description: "For a PAID booking, a parent may only reschedule freely outside the cancellation threshold — inside it, cancel-by-parent applies instead.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: RequestRescheduleSchema } } } },
  responses: { 201: { description: "{ request: RescheduleRequest }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}/reschedule`,
  tags,
  summary: "Get the pending reschedule request for a booking, if any",
  ...bearer,
  responses: { 200: { description: "{ request: RescheduleRequest | null }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/reschedule/{requestId}/respond`,
  tags,
  summary: "Accept or reject a reschedule request",
  ...bearer,
  request: { body: { content: { "application/json": { schema: RespondToRescheduleSchema } } } },
  responses: { 200: { description: "{ request: RescheduleRequest }" } },
});

// ── Group sessions ───────────────────────────────────────────
registry.registerPath({
  method: "post",
  path: groupBasePath,
  tags: groupTags,
  summary: "Tutor creates a group session",
  ...bearer,
  request: { body: { content: { "application/json": { schema: CreateGroupSessionSchema } } } },
  responses: { 201: { description: "{ booking: Booking, groupSession: GroupSession }" } },
});

registry.registerPath({
  method: "get",
  path: `${groupBasePath}/{bookingId}`,
  tags: groupTags,
  summary: "Get a group session and its participants",
  ...bearer,
  responses: { 200: { description: "{ groupSession, participants }" } },
});

registry.registerPath({
  method: "post",
  path: `${groupBasePath}/{bookingId}/publish`,
  tags: groupTags,
  summary: "Publish a DRAFT group session for registration",
  description: "Schedules the registration-cutoff job that confirms (if min students met) or cancels + refunds everyone.",
  ...bearer,
  responses: { 200: { description: "{ groupSession: GroupSession }" } },
});

registry.registerPath({
  method: "post",
  path: `${groupBasePath}/{bookingId}/join`,
  tags: groupTags,
  summary: "Join a published group session",
  ...bearer,
  request: { body: { content: { "application/json": { schema: JoinGroupSessionSchema } } } },
  responses: { 201: { description: "{ participant: GroupSessionParticipant }" } },
});

registry.registerPath({
  method: "post",
  path: `${groupBasePath}/{bookingId}/checkout/wallet`,
  tags: groupTags,
  summary: "Pay for a group session seat from wallet balance",
  ...bearer,
  responses: { 200: { description: "{ participant, escrowHold }" } },
});

registry.registerPath({
  method: "post",
  path: `${groupBasePath}/{bookingId}/checkout/direct-momo`,
  tags: groupTags,
  summary: "Pay for a group session seat via direct MoMo/Orange Money",
  ...bearer,
  request: { body: { content: { "application/json": { schema: DirectMomoCheckoutSchema } } } },
  responses: { 200: { description: "{ participant, escrowHold }" } },
});

// ── Admin ───────────────────────────────────────────────────
registry.registerPath({
  method: "get",
  path: adminBasePath,
  tags: adminTags,
  summary: "List all bookings across all users",
  description: "Requires the bookings:read-all permission.",
  ...bearer,
  request: { query: ListBookingsQuerySchema },
  responses: { 200: { description: "Cursor-paginated bookings" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/{id}`,
  tags: adminTags,
  summary: "Get any booking by ID",
  description: "Requires the bookings:read-all permission.",
  ...bearer,
  responses: { 200: { description: "{ booking: Booking }" } },
});
