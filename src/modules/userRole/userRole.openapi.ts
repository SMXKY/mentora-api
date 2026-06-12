// import { registry } from "../../docs/openapi.registry";
// import {
//   CreateUserRoleSchema,
//   UpdateUserRoleSchema,
//   UserRoleResponseSchema,
// } from "./userRole.schema";
// import { z } from "zod";

// // ============================================================
// // USERROLE — OPENAPI ROUTE REGISTRATIONS
// // Run npm run docs:build after updating this file to
// // regenerate the OpenAPI spec at docs/api/openapi.json
// // ============================================================

// const tags = ["UserRole"];
// const basePath = "/api/v1/userRoles";

// registry.registerPath({
//   method: "post",
//   path: basePath,
//   tags,
//   summary: "Create a new userRole",
//   request: {
//     body: {
//       content: { "application/json": { schema: CreateUserRoleSchema } },
//     },
//   },
//   responses: {
//     201: {
//       description: "UserRole created successfully",
//       content: { "application/json": { schema: UserRoleResponseSchema } },
//     },
//     400: { description: "Validation error" },
//     401: { description: "Unauthorised" },
//     403: { description: "Forbidden" },
//   },
// });

// registry.registerPath({
//   method: "get",
//   path: basePath,
//   tags,
//   summary: "Get all userRoles (offset paginated)",
//   request: {
//     query: z.object({
//       page: z.string().optional(),
//       limit: z.string().optional(),
//       sortBy: z.string().optional(),
//       sortOrder: z.enum(["asc", "desc"]).optional(),
//       search: z.string().optional(),
//     }),
//   },
//   responses: {
//     200: {
//       description: "List of userRoles",
//       content: {
//         "application/json": {
//           schema: z.object({
//             success: z.boolean(),
//             data: z.array(UserRoleResponseSchema),
//             meta: z.object({
//               total: z.number(),
//               page: z.number(),
//               limit: z.number(),
//               totalPages: z.number(),
//               hasNextPage: z.boolean(),
//               hasPrevPage: z.boolean(),
//             }),
//           }),
//         },
//       },
//     },
//   },
// });

// registry.registerPath({
//   method: "get",
//   path: `${basePath}/search`,
//   tags,
//   summary: "Search userRoles (cursor paginated)",
//   request: {
//     query: z.object({
//       cursor: z.string().optional(),
//       limit: z.string().optional(),
//       search: z.string().optional(),
//     }),
//   },
//   responses: {
//     200: {
//       description: "Search results",
//       content: {
//         "application/json": {
//           schema: z.object({
//             success: z.boolean(),
//             data: z.array(UserRoleResponseSchema),
//             meta: z.object({
//               nextCursor: z.string().nullable(),
//               hasNextPage: z.boolean(),
//               limit: z.number(),
//             }),
//           }),
//         },
//       },
//     },
//   },
// });

// registry.registerPath({
//   method: "get",
//   path: `${basePath}/{id}`,
//   tags,
//   summary: "Get userRole by ID",
//   request: { params: z.object({ id: z.string().uuid() }) },
//   responses: {
//     200: {
//       description: "UserRole found",
//       content: { "application/json": { schema: UserRoleResponseSchema } },
//     },
//     404: { description: "UserRole not found" },
//   },
// });

// registry.registerPath({
//   method: "patch",
//   path: `${basePath}/{id}`,
//   tags,
//   summary: "Update userRole",
//   request: {
//     params: z.object({ id: z.string().uuid() }),
//     body: {
//       content: { "application/json": { schema: UpdateUserRoleSchema } },
//     },
//   },
//   responses: {
//     200: {
//       description: "UserRole updated",
//       content: { "application/json": { schema: UserRoleResponseSchema } },
//     },
//     404: { description: "UserRole not found" },
//   },
// });

// registry.registerPath({
//   method: "delete",
//   path: `${basePath}/{id}`,
//   tags,
//   summary: "Delete userRole",
//   request: { params: z.object({ id: z.string().uuid() }) },
//   responses: {
//     200: { description: "UserRole deleted" },
//     404: { description: "UserRole not found" },
//   },
// });
