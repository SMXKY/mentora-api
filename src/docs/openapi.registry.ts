import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

// ============================================================
// OPENAPI REGISTRY
// Single shared instance used by all module .openapi.ts files
// to register their routes and schemas.
//
// Every module imports this registry and calls registry.registerPath()
// The build-docs CLI reads all registrations and generates
// the full OpenAPI spec at docs/api/openapi.json
// ============================================================

export const registry = new OpenAPIRegistry();
