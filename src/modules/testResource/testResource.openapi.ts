import { registry } from "../../docs/openapi.registry";
import {
  CreateTestResourceSchema,
  UpdateTestResourceSchema,
  TestResourceResponseSchema,
} from "./testResource.schema";
import { z } from "zod";

// ============================================================
// TESTRESOURCE — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["TestResource"];
const basePath = "/api/v1/testResources";

registry.registerPath({
  method: "post",
  path: basePath,
  tags,
  summary: "Create a new testResource",
  request: {
    body: {
      content: { "application/json": { schema: CreateTestResourceSchema } },
    },
  },
  responses: {
    201: {
      description: "TestResource created successfully",
      content: { "application/json": { schema: TestResourceResponseSchema } },
    },
    400: { description: "Validation error" },
    401: { description: "Unauthorised" },
    403: { description: "Forbidden" },
  },
});

registry.registerPath({
  method: "get",
  path: basePath,
  tags,
  summary: "Get all testResources (offset paginated)",
  request: {
    query: z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "List of testResources",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(TestResourceResponseSchema),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              limit: z.number(),
              totalPages: z.number(),
              hasNextPage: z.boolean(),
              hasPrevPage: z.boolean(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/search`,
  tags,
  summary: "Search testResources (cursor paginated)",
  request: {
    query: z.object({
      cursor: z.string().optional(),
      limit: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: "Search results",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(TestResourceResponseSchema),
            meta: z.object({
              nextCursor: z.string().nullable(),
              hasNextPage: z.boolean(),
              limit: z.number(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: `${basePath}/{id}`,
  tags,
  summary: "Get testResource by ID",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "TestResource found",
      content: { "application/json": { schema: TestResourceResponseSchema } },
    },
    404: { description: "TestResource not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: `${basePath}/{id}`,
  tags,
  summary: "Update testResource",
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: UpdateTestResourceSchema } },
    },
  },
  responses: {
    200: {
      description: "TestResource updated",
      content: { "application/json": { schema: TestResourceResponseSchema } },
    },
    404: { description: "TestResource not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: `${basePath}/{id}`,
  tags,
  summary: "Delete testResource",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "TestResource deleted" },
    404: { description: "TestResource not found" },
  },
});
