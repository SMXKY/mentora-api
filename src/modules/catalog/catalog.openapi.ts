import { registry } from "../../docs/openapi.registry";
import { z } from "zod";

// ============================================================
// CATALOG — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["Catalog"];

const RegionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  countryCode: z.string(),
  isActive: z.boolean(),
});

const CitySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  regionId: z.string().uuid(),
  isActive: z.boolean(),
  isInAllowlist: z.boolean(),
});

const SubjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  domainId: z.string().uuid(),
  isActive: z.boolean(),
  domain: z.object({ id: z.string().uuid(), name: z.string() }),
});

const LevelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  schoolType: z.enum(["PRIMARY", "SECONDARY", "GCE", "UNIVERSITY", "OTHER"]),
  orderIndex: z.number(),
  isActive: z.boolean(),
});

registry.registerPath({
  method: "get",
  path: "/api/v1/regions",
  tags,
  summary: "List active regions",
  description: "Public reference data — no auth required. Cameroon's ten regions, used to scope city and KYC address selection.",
  responses: {
    200: {
      description: "Regions",
      content: { "application/json": { schema: z.object({ success: z.boolean(), data: z.array(RegionSchema) }) } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/cities",
  tags,
  summary: "List active cities, optionally scoped to a region",
  description: "Public reference data — no auth required.",
  request: { query: z.object({ regionId: z.string().uuid().optional() }) },
  responses: {
    200: {
      description: "Cities",
      content: { "application/json": { schema: z.object({ success: z.boolean(), data: z.array(CitySchema) }) } },
    },
    400: { description: "regionId is not a valid UUID" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/subjects",
  tags,
  summary: "List active subjects, optionally filtered by domain or name",
  description:
    "Public reference data — no auth required. Used by the KYC credential form, " +
    "student subjects-of-interest, and tutor subject claims — the same taxonomy " +
    "everywhere a subject is selected.",
  request: {
    query: z.object({
      domainId: z.string().uuid().optional(),
      search: z.string().min(1).max(100).optional(),
    }),
  },
  responses: {
    200: {
      description: "Subjects",
      content: { "application/json": { schema: z.object({ success: z.boolean(), data: z.array(SubjectSchema) }) } },
    },
    400: { description: "domainId is not a valid UUID, or search exceeds 100 characters" },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/levels",
  tags,
  summary: "List active class/education levels, optionally filtered by school type",
  description: "Public reference data — no auth required. This is the Student profile's \"class/level\" field.",
  request: {
    query: z.object({
      schoolType: z.enum(["PRIMARY", "SECONDARY", "GCE", "UNIVERSITY", "OTHER"]).optional(),
    }),
  },
  responses: {
    200: {
      description: "Levels, ordered by orderIndex",
      content: { "application/json": { schema: z.object({ success: z.boolean(), data: z.array(LevelSchema) }) } },
    },
    400: { description: "schoolType is not one of the valid enum values" },
  },
});
