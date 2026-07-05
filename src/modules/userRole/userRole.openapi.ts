// import { registry } from "../../docs/openapi.registry";
// import {
//   CreateUserRoleSchema,
//   UpdateUserRoleSchema,
//   UserRoleResponseSchema,
// } from "./userRole.schema";
// import { z } from "zod";

// // ============================================================
// // USERROLE — OPENAPI ROUTE REGISTRATIONS
// // Not currently mounted in src/app.ts (see docs/permissionModuleAudit.md).
// // Documented so the spec is accurate the moment it is mounted.
// // Run npm run docs:build after updating this file to regenerate
// // docs/api/openapi.json
// // ============================================================

// const tags = ["UserRole"];
// const basePath = "/api/v1/user-roles";

// const envelope = <T extends z.ZodTypeAny>(data: T) =>
//   z.object({ success: z.boolean(), data, meta: z.any().optional() });

// registry.registerPath({
//   method: "post",
//   path: basePath,
//   tags,
//   summary: "Create a new user-role assignment",
//   request: {
//     body: {
//       content: { "application/json": { schema: CreateUserRoleSchema } },
//     },
//   },
//   responses: {
//     201: {
//       description: "UserRole created successfully",
//       content: { "application/json": { schema: envelope(UserRoleResponseSchema) } },
//     },
//     400: { description: "Validation error" },
//     401: { description: "Not authenticated" },
//     403: { description: "Caller lacks rbac.roles.update" },
//   },
// });

// registry.registerPath({
//   method: "get",
//   path: basePath,
//   tags,
//   summary: "Get all user-role assignments (offset paginated)",
//   request: {
//     query: z.object({
//       page: z.string().optional(),
//       limit: z.string().optional(),
//       sortBy: z.string().optional(),
//       sortOrder: z.enum(["asc", "desc"]).optional(),
//       search: z.string().optional(),
//       include: z.string().optional(),
//     }),
//   },
//   responses: {
//     200: {
//       description: "List of user-role assignments",
//       content: {
//         "application/json": { schema: envelope(z.array(UserRoleResponseSchema)) },
//       },
//     },
//     401: { description: "Not authenticated" },
//     403: { description: "Caller lacks rbac.roles.read" },
//   },
// });

// registry.registerPath({
//   method: "get",
//   path: `${basePath}/search`,
//   tags,
//   summary: "Search user-role assignments (cursor paginated)",
//   request: {
//     query: z.object({
//       cursor: z.string().uuid().optional(),
//       limit: z.string().optional(),
//       search: z.string().optional(),
//       include: z.string().optional(),
//     }),
//   },
//   responses: {
//     200: {
//       description: "Search results",
//       content: {
//         "application/json": { schema: envelope(z.array(UserRoleResponseSchema)) },
//       },
//     },
//     401: { description: "Not authenticated" },
//     403: { description: "Caller lacks rbac.roles.read" },
//   },
// });

// registry.registerPath({
//   method: "get",
//   path: `${basePath}/deleted`,
//   tags,
//   summary: "List soft-deleted user-role assignments",
//   responses: {
//     200: { description: "List of soft-deleted user-role assignments" },
//     401: { description: "Not authenticated" },
//     403: { description: "Caller lacks rbac.roles.read" },
//     405: { description: "Soft delete is not enabled for this resource" },
//   },
// });

// registry.registerPath({
//   method: "get",
//   path: `${basePath}/deleted/{id}`,
//   tags,
//   summary: "Get a soft-deleted user-role assignment by ID",
//   request: { params: z.object({ id: z.string().uuid() }) },
//   responses: {
//     200: { description: "Soft-deleted user-role assignment found" },
//     401: { description: "Not authenticated" },
//     403: { description: "Caller lacks rbac.roles.read" },
//     404: { description: "Not found" },
//     405: { description: "Soft delete is not enabled for this resource" },
//   },
// });

// registry.registerPath({
//   method: "get",
//   path: `${basePath}/{id}`,
//   tags,
//   summary: "Get user-role assignment by ID",
//   request: { params: z.object({ id: z.string().uuid() }) },
//   responses: {
//     200: {
//       description: "UserRole found",
//       content: { "application/json": { schema: envelope(UserRoleResponseSchema) } },
//     },
//     401: { description: "Not authenticated" },
//     403: { description: "Caller lacks rbac.roles.read" },
//     404: { description: "UserRole not found" },
//   },
// });

// registry.registerPath({
//   method: "patch",
//   path: `${basePath}/{id}`,
//   tags,
//   summary: "Update a user-role assignment",
//   request: {
//     params: z.object({ id: z.string().uuid() }),
//     body: {
//       content: { "application/json": { schema: UpdateUserRoleSchema } },
//     },
//   },
//   responses: {
//     200: {
//       description: "UserRole updated",
//       content: { "application/json": { schema: envelope(UserRoleResponseSchema) } },
//     },
//     400: { description: "Validation error" },
//     401: { description: "Not authenticated" },
//     403: { description: "Caller lacks rbac.roles.update" },
//     404: { description: "UserRole not found" },
//   },
// });

// registry.registerPath({
//   method: "patch",
//   path: `${basePath}/{id}/restore`,
//   tags,
//   summary: "Restore a soft-deleted user-role assignment",
//   request: { params: z.object({ id: z.string().uuid() }) },
//   responses: {
//     200: { description: "UserRole restored" },
//     401: { description: "Not authenticated" },
//     403: { description: "Caller lacks rbac.roles.update" },
//     404: { description: "Not found" },
//     405: { description: "Soft delete is not enabled for this resource" },
//   },
// });

// registry.registerPath({
//   method: "delete",
//   path: `${basePath}/{id}`,
//   tags,
//   summary: "Delete a user-role assignment",
//   request: { params: z.object({ id: z.string().uuid() }) },
//   responses: {
//     200: { description: "UserRole deleted" },
//     401: { description: "Not authenticated" },
//     403: { description: "Caller lacks rbac.roles.delete" },
//     404: { description: "UserRole not found" },
//   },
// });
