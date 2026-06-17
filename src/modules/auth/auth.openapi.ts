import { registry } from "../../docs/openapi.registry";
import {
  CompleteRegistrationSchema,
  SessionStatusResponseSchema,
} from "./auth.types";
import { z } from "zod";

const tags = ["Auth"];
const basePath = "/api/v1/auth";

registry.registerPath({
  method: "post",
  path: `${basePath}/complete-registration`,
  tags,
  summary: "Complete registration after Clerk sign-up",
  description:
    "Called once, immediately after a Clerk session is established and the user " +
    "has picked a role on the role-picker screen. Creates the local User row, " +
    "Wallet, and UserRole assignment. Only Parent, Student, and Tutor roles can " +
    "be self-assigned via this endpoint. " +
    "The Bearer token must be a valid Clerk session token issued for the application " +
    "domain mentora.tallamichael.online.",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": { schema: CompleteRegistrationSchema },
      },
    },
  },
  responses: {
    201: {
      description:
        "Registration completed — User, Wallet, and UserRole created",
    },
    400: { description: "No verified email on Clerk account" },
    401: { description: "No valid Clerk session" },
    403: {
      description:
        "Role is not self-assignable (must be Parent, Student, or Tutor)",
    },
    409: { description: "A local User already exists for this Clerk account" },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/me`,
  tags,
  summary: "Get current session status",
  description:
    "Called on every app cold start after Clerk confirms a session. Returns " +
    "whether the user needs to complete registration (pick a role) or is ready " +
    "to use the app. " +
    "The Bearer token must be a valid Clerk session token issued for the application " +
    "domain mentora.tallamichael.online.",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Session status",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: SessionStatusResponseSchema,
          }),
        },
      },
    },
    401: { description: "No valid Clerk session" },
  },
});
