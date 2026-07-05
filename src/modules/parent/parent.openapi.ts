import { registry } from "../../docs/openapi.registry";
import { z } from "zod";
import { CreateManagedStudentSchema, UpdateManagedStudentSchema } from "./parent.schema";

// ============================================================
// PARENT — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Parent"];
const basePath = "/api/v1/parents";
const bearer = { security: [{ bearerAuth: [] }] };

registry.registerPath({
  method: "get",
  path: `${basePath}/me/students`,
  tags,
  summary: "List the children this Parent manages",
  description: "Scoped strictly to StudentProfile rows where guardianId is the caller.",
  ...bearer,
  responses: {
    200: { description: "Managed student profiles" },
    401: { description: "No valid session token" },
  },
});

registry.registerPath({
  method: "post",
  path: `${basePath}/me/students`,
  tags,
  summary: "Add a managed student (child with no login of their own)",
  description:
    "Creates a StudentProfile with guardianId set to the caller and userId left " +
    "null — a Parent-managed child has no account of their own to point at.",
  ...bearer,
  request: {
    body: { content: { "application/json": { schema: CreateManagedStudentSchema } } },
  },
  responses: {
    201: { description: "Managed student created" },
    400: { description: "Validation error" },
    401: { description: "No valid session token" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/me/students/{id}`,
  tags,
  summary: "Update a managed student",
  ...bearer,
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: { content: { "application/json": { schema: UpdateManagedStudentSchema } } },
  },
  responses: {
    200: { description: "Updated" },
    404: { description: "No such managed student for this Parent" },
  },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/me/students/{id}`,
  tags,
  summary: "Remove a managed student",
  description: "Soft delete — scoped to guardianId, so a Parent can never touch another family's profile.",
  ...bearer,
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "Removed" },
    404: { description: "No such managed student for this Parent" },
  },
});
