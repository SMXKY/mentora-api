import { registry } from "../../docs/openapi.registry";
import {
  OpenDisputeSchema,
  RespondToDisputeSchema,
  ResolveDisputeSchema,
  ListDisputesQuerySchema,
} from "./dispute.types";

const tags = ["Disputes"];
const adminTags = ["Disputes — Admin"];
const basePath = "/api/v1/disputes";
const adminBasePath = "/api/v1/admin/disputes";
const bearer = { security: [{ bearerAuth: [] }] };

registry.registerPath({
  method: "post",
  path: `${basePath}/bookings/{bookingId}/dispute`,
  tags,
  summary: "Open a dispute on a booking awaiting confirmation",
  description:
    "400 if the booking isn't AWAITING_CONFIRMATION, 409 if a dispute already exists, 400 if the description is outside the configured length bounds. Freezes escrow, cancels the confirmation auto-release, generates the internal auto-resolution recommendation, and assembles the read-only evidence snapshot.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: OpenDisputeSchema } } } },
  responses: { 201: { description: "{ dispute: Dispute }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/bookings/{bookingId}/dispute`,
  tags,
  summary: "Get the dispute for a booking, if one exists (parties only)",
  ...bearer,
  responses: { 200: { description: "{ dispute: Dispute }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}`,
  tags,
  summary: "Get a dispute (parties only)",
  ...bearer,
  responses: { 200: { description: "{ dispute: Dispute }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/respond`,
  tags,
  summary: "Tutor responds to a dispute",
  description: "Must respond within the configured response window (default 24h, reminder at 12h before due).",
  ...bearer,
  request: { body: { content: { "application/json": { schema: RespondToDisputeSchema } } } },
  responses: { 200: { description: "{ dispute: Dispute }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{id}/resolve`,
  tags: adminTags,
  summary: "Admin resolves a dispute",
  description:
    "Mandatory 30+ character reason. Releases or refunds the frozen escrow accordingly, updates the booking's terminal status, and feeds tutor/parent dispute-pattern monitoring.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: ResolveDisputeSchema } } } },
  responses: { 200: { description: "{ dispute: Dispute }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}/evidence`,
  tags: adminTags,
  summary: "Get the assembled, permanent evidence package for a dispute",
  description:
    "Booking snapshot, session data, conversation + session-chat history, the auto-resolution recommendation, and both parties' dispute history — assembled once at dispute-open time.",
  ...bearer,
  responses: { 200: { description: "{ snapshot: DisputeEvidenceSnapshot }" } },
});

registry.registerPath({
  method: "get",
  path: adminBasePath,
  tags: adminTags,
  summary: "List disputes (admin queue)",
  description: "Each row includes isOverdueForHighlight, computed from the configurable escalation-highlight window.",
  ...bearer,
  request: { query: ListDisputesQuerySchema },
  responses: { 200: { description: "Cursor-paginated disputes" } },
});
