import { registry } from "../../docs/openapi.registry";
import {
  CreateAvailabilitySlotSchema,
  UpdateAvailabilitySlotSchema,
  AvailableWindowsQuerySchema,
} from "./availability.types";

const tags = ["Availability"];
const basePath = "/api/v1/tutors";
const bearer = { security: [{ bearerAuth: [] }] };

registry.registerPath({
  method: "get",
  path: `${basePath}/me/availability`,
  tags,
  summary: "List my availability slots",
  ...bearer,
  responses: { 200: { description: "{ slots: AvailabilitySlot[] }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/availability`,
  tags,
  summary: "Create a recurring or specific-date availability slot",
  ...bearer,
  request: { body: { content: { "application/json": { schema: CreateAvailabilitySlotSchema } } } },
  responses: { 201: { description: "{ slot: AvailabilitySlot }" } },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/me/availability/{id}`,
  tags,
  summary: "Update an availability slot",
  ...bearer,
  request: { body: { content: { "application/json": { schema: UpdateAvailabilitySlotSchema } } } },
  responses: { 200: { description: "{ slot: AvailabilitySlot }" } },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/me/availability/{id}`,
  tags,
  summary: "Delete an availability slot",
  ...bearer,
  responses: { 204: { description: "Deleted" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{tutorProfileId}/availability/windows`,
  tags,
  summary: "Get a tutor's open booking windows for a date",
  description:
    "Public. Computes the tutor's declared availability minus existing bookings (+ buffer time) for the requested date.",
  request: { query: AvailableWindowsQuerySchema },
  responses: { 200: { description: "{ windows: { startTime, endTime }[] }" } },
});
