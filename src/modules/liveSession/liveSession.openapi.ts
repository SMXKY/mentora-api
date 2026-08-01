import { registry } from "../../docs/openapi.registry";
import {
  GenerateTokenSchema,
  MuteParticipantSchema,
  RemoveParticipantSchema,
  GrantScreenShareSchema,
  SendChatMessageSchema,
  ListChatQuerySchema,
  RecordConnectionQualitySchema,
} from "./liveSession.types";

const tags = ["Live Sessions"];
const adminTags = ["Live Sessions — Admin"];
const basePath = "/api/v1/live-sessions";
const adminBasePath = "/api/v1/admin/live-sessions";
const bearer = { security: [{ bearerAuth: [] }] };

registry.registerPath({
  method: "post",
  path: `${basePath}/{bookingId}/token`,
  tags,
  summary: "Generate a LiveKit access token for a session room",
  description:
    "403 with no room details if the caller has no confirmed paid booking (or, for group sessions, no PAID GroupSessionParticipant row) for this session. 404 if the room hasn't been created yet by the 15-minutes-before background job.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: GenerateTokenSchema } } } },
  responses: { 200: { description: "{ token, url, roomName, identity, role, expiresInSeconds }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{bookingId}/mute`,
  tags,
  summary: "Tutor mutes a participant's audio",
  ...bearer,
  request: { body: { content: { "application/json": { schema: MuteParticipantSchema } } } },
  responses: { 200: { description: "{ muted: true }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{bookingId}/remove`,
  tags,
  summary: "Tutor removes a participant from the room",
  ...bearer,
  request: { body: { content: { "application/json": { schema: RemoveParticipantSchema } } } },
  responses: { 200: { description: "{ removed: true }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{bookingId}/lock`,
  tags,
  summary: "Tutor locks the room to prevent new joiners",
  ...bearer,
  responses: { 200: { description: "{ locked: true }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{bookingId}/end`,
  tags,
  summary: "Tutor ends the session for everyone",
  description: "Deletes the LiveKit room, which triggers LiveKit's room_finished webhook to finalize session tracking.",
  ...bearer,
  responses: { 200: { description: "{ ended: true }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{bookingId}/mute-all`,
  tags,
  summary: "Tutor mutes every student in a group session",
  ...bearer,
  responses: { 200: { description: "{ muted: true }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{bookingId}/grant-screen-share`,
  tags,
  summary: "Tutor grants screen-share to a specific student in a group session",
  ...bearer,
  request: { body: { content: { "application/json": { schema: GrantScreenShareSchema } } } },
  responses: { 200: { description: "{ granted: true }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{bookingId}/connection-quality`,
  tags,
  summary: "Report the caller's own connection quality during a session",
  ...bearer,
  request: { body: { content: { "application/json": { schema: RecordConnectionQualitySchema } } } },
  responses: { 200: { description: "{ recorded: true }" } },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{bookingId}/chat`,
  tags,
  summary: "Get session chat history",
  ...bearer,
  request: { query: ListChatQuerySchema },
  responses: { 200: { description: "{ messages: SessionChatMessage[] }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{bookingId}/chat`,
  tags,
  summary: "Persist a session chat message",
  description: "Real-time delivery happens client-side via LiveKit's data channel — this endpoint is the durable record.",
  ...bearer,
  request: { body: { content: { "application/json": { schema: SendChatMessageSchema } } } },
  responses: { 201: { description: "{ message: SessionChatMessage }" } },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/{bookingId}/whiteboard`,
  tags,
  summary: "Upload the whiteboard PNG export at session end",
  ...bearer,
  request: { body: { content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" } } } } } } },
  responses: { 200: { description: "{ fileId: string }" } },
});

registry.registerPath({
  method: "get",
  path: `${adminBasePath}/{bookingId}`,
  tags: adminTags,
  summary: "Full session audit (participants, events, connection quality, chat) for dispute investigation",
  ...bearer,
  responses: { 200: { description: "{ liveRoom: LiveRoom & audit relations }" } },
});

registry.registerPath({
  method: "post",
  path: `${adminBasePath}/{bookingId}/observer-token`,
  tags: adminTags,
  summary: "Generate an invisible observer token (flag-gated: live_sessions.admin_observe)",
  ...bearer,
  responses: { 200: { description: "{ token, url, roomName }" } },
});
