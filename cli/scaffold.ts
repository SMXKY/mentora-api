import { getDMMF } from "@prisma/internals";
import fs from "fs";
import path from "path";

// ============================================================
// MENTORA MODULE SCAFFOLD CLI
// Reads a Prisma model and generates a complete module structure
//
// Usage:
//   npm run scaffold <moduleName> [options]
//
// Options:
//   --type=standard    Full CRUD, extends all base classes (default)
//   --type=tableless   No Prisma model, plain service and controller
//   --type=readonly    Read only, no create/update/delete
//   --type=custom      Repository + service extend base, plain controller
//   --type=external    No repository, wraps external SDK
//   --no-soft-delete   Hard delete only
//   --extra-repos=a,b  Inject additional repositories into service
//
// Examples:
//   npm run scaffold booking
//   npm run scaffold dashboard --type=tableless
//   npm run scaffold payments --extra-repos=wallet,escrow
//   npm run scaffold sessions --type=external
// ============================================================

type ModuleType = "standard" | "tableless" | "readonly" | "custom" | "external";

interface ScaffoldOptions {
  type: ModuleType;
  softDelete: boolean;
  extraRepos: string[];
}

interface PrismaField {
  name: string;
  type: string;
  isRequired: boolean;
  isId: boolean;
  hasDefault: boolean;
  relationName?: string;
}

const args = process.argv.slice(2);
const moduleName = args[0];

if (!moduleName) {
  console.error("Usage: npm run scaffold <moduleName> [options]");
  console.error("Example: npm run scaffold booking");
  process.exit(1);
}

const options: ScaffoldOptions = {
  type: "standard",
  softDelete: true,
  extraRepos: [],
};

for (const arg of args.slice(1)) {
  if (arg.startsWith("--type=")) {
    options.type = arg.replace("--type=", "") as ModuleType;
  }
  if (arg === "--no-soft-delete") {
    options.softDelete = false;
  }
  if (arg.startsWith("--extra-repos=")) {
    options.extraRepos = arg
      .replace("--extra-repos=", "")
      .split(",")
      .map((r) => r.trim());
  }
}

const ModelName = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
const MODULE_DIR = path.join(__dirname, `../src/modules/${moduleName}`);
const SCHEMA_PATH = path.join(__dirname, "../prisma/schema.prisma");

const ZOD_TYPE_MAP: Record<string, string> = {
  String: "z.string()",
  Int: "z.number().int()",
  Float: "z.number()",
  Boolean: "z.boolean()",
  DateTime: "z.string().datetime()",
  Json: "z.record(z.unknown())",
  BigInt: "z.bigint()",
  Decimal: "z.number()",
  Bytes: "z.string()",
};

// ============================================================
// TEMPLATE GENERATORS
// Each function returns the file content for one module file
// ============================================================

function generateTypes(fields: PrismaField[]): string {
  return `import { z } from "zod";
import {
  Create${ModelName}Schema,
  Update${ModelName}Schema,
  ${ModelName}ResponseSchema,
} from "./${moduleName}.schema";

export type Create${ModelName}Input = z.infer<typeof Create${ModelName}Schema>;
export type Update${ModelName}Input = z.infer<typeof Update${ModelName}Schema>;
export type ${ModelName}Response = z.infer<typeof ${ModelName}ResponseSchema>;
`;
}

function generateSchema(fields: PrismaField[]): string {
  // Filter out system fields for create/update schemas
  const systemFields = ["id", "createdAt", "updatedAt", "deletedAt"];
  const userFields = fields.filter(
    (f) => !systemFields.includes(f.name) && !f.relationName
  );

  const schemaFields = userFields
    .map((f) => {
      const zodType = ZOD_TYPE_MAP[f.type] || "z.string()";
      const optional = !f.isRequired || f.hasDefault ? ".optional()" : "";
      return `  ${f.name}: ${zodType}${optional},`;
    })
    .join("\n");

  const responseFields = [
    `  id: z.string().uuid(),`,
    ...userFields.map((f) => {
      const zodType = ZOD_TYPE_MAP[f.type] || "z.string()";
      const optional = !f.isRequired ? ".optional()" : "";
      return `  ${f.name}: ${zodType}${optional},`;
    }),
    `  createdAt: z.string().datetime(),`,
    `  updatedAt: z.string().datetime(),`,
  ].join("\n");

  return `import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Fields used when creating a new ${ModelName}
// System fields (id, createdAt, updatedAt, deletedAt) are excluded
export const Create${ModelName}Schema = z
  .object({
${schemaFields}
  })
  .openapi("Create${ModelName}");

// All fields optional for partial updates
export const Update${ModelName}Schema = Create${ModelName}Schema.partial().openapi(
  "Update${ModelName}"
);

// Full response shape returned to the client
export const ${ModelName}ResponseSchema = z
  .object({
${responseFields}
  })
  .openapi("${ModelName}");
`;
}

function generateRepository(fields: PrismaField[]): string {
  const relationFields = fields
    .filter((f) => f.relationName)
    .map((f) => `"${f.name}"`)
    .join(", ");

  const softDeleteConfig = options.softDelete
    ? `  protected softDeleteConfig = {
    enabled: true,
    // TODO: add unique fields that need _deleted_timestamp suffix
    // uniqueFields: ['name', 'email'],
    uniqueFields: [] as string[],
  };`
    : `  protected softDeleteConfig = {
    enabled: false,
    uniqueFields: [] as string[],
  };`;

  return `import { BaseRepository } from "../../base/BaseRepository";
import { Prisma } from "../../generated/prisma";

export class ${ModelName}Repository extends BaseRepository<any> {
  protected modelName = "${moduleName}";

  // Fields the ?search= query param searches across
  // Empty means search is silently ignored
  // TODO: update with the fields that make sense to search
  protected searchableFields: string[] = [];

  // Allowlist for ?include= query param
  // Any relation not listed here is stripped before the Prisma call
  protected allowedIncludes: string[] = [${relationFields}];

  ${softDeleteConfig}

  // Set to true if this model has an isSystem boolean field
  protected hasSystemField = false;

  // TODO: override buildWhereClause if you need custom filtering
  // e.g. enum fields should use exact match not LIKE
  // protected buildWhereClause(filters: any, search?: string) {
  //   const where = super.buildWhereClause(filters, search)
  //   if (filters.status) where.status = filters.status  // exact match
  //   return where
  // }
}
`;
}

function generateService(): string {
  const extraRepoImports = options.extraRepos
    .map(
      (r) =>
        `import { ${
          r.charAt(0).toUpperCase() + r.slice(1)
        }Repository } from "../${r}/${r}.repository";`
    )
    .join("\n");

  const extraRepoProps = options.extraRepos
    .map(
      (r) =>
        `  private ${r}Repo = new ${
          r.charAt(0).toUpperCase() + r.slice(1)
        }Repository();`
    )
    .join("\n");

  return `import { BaseService } from "../../base/BaseService";
import { ${ModelName}Repository } from "./${moduleName}.repository";
import { ServiceContext } from "../../base/base.types";
import { Create${ModelName}Input, Update${ModelName}Input } from "./${moduleName}.types";
${extraRepoImports}

export class ${ModelName}Service extends BaseService
  any,
  Create${ModelName}Input,
  Update${ModelName}Input
> {
  protected repository = new ${ModelName}Repository();
  protected tableName = "${moduleName}";
${extraRepoProps ? "\n" + extraRepoProps : ""}

  // ============================================================
  // LIFECYCLE HOOKS
  // Uncomment and implement as needed
  // ============================================================

  // protected async beforeCreate(data: Create${ModelName}Input, ctx: ServiceContext) {
  //   // Enrich or validate data before insert
  //   // e.g. hash a password, generate a reference number
  //   return data
  // }

  // protected async afterCreate(record: any, ctx: ServiceContext) {
  //   // Side effects after successful insert
  //   // e.g. send notification, update a counter
  // }

  // protected async beforeUpdate(id: string, data: Update${ModelName}Input, ctx: ServiceContext) {
  //   // Modify data before update
  //   // e.g. strip fields the user should not change
  //   return data
  // }

  // protected async afterUpdate(record: any, ctx: ServiceContext) {
  //   // Side effects after successful update
  // }

  // protected async beforeDelete(id: string, ctx: ServiceContext) {
  //   // Run checks before deletion
  //   // e.g. check no active bookings exist before deleting a tutor
  // }

  // protected async afterDelete(record: any, ctx: ServiceContext) {
  //   // Side effects after deletion
  //   // e.g. release associated escrow, cancel scheduled jobs
  // }

  // ============================================================
  // CUSTOM METHODS
  // Add business logic methods here beyond standard CRUD
  // ============================================================
}
`;
}

function generateTablelessService(): string {
  return `import { ServiceContext } from "../../base/base.types";

// ============================================================
// ${ModelName.toUpperCase()} SERVICE — TABLELESS
// No single Prisma model. Aggregates from multiple repositories
// or calls external services.
// Import the repositories you need directly.
// ============================================================

export class ${ModelName}Service {
  // TODO: inject repositories as needed
  // private bookingRepo = new BookingRepository()
  // private paymentRepo = new PaymentRepository()

  static async get(ctx: ServiceContext): Promise<any> {
    // TODO: implement
    throw new Error("Not implemented");
  }
}
`;
}

function generateExternalService(): string {
  return `import { ServiceContext } from "../../base/base.types";

// ============================================================
// ${ModelName.toUpperCase()} SERVICE — EXTERNAL
// No repository. Wraps an external SDK or API.
// Import the SDK client from src/config/
// ============================================================

export class ${ModelName}Service {
  // TODO: import external SDK
  // private client = livekitClient  // from src/config/livekit.config.ts

  static async create(data: any, ctx: ServiceContext): Promise<any> {
    // TODO: implement
    throw new Error("Not implemented");
  }
}
`;
}

function generateReadonlyService(): string {
  return `import { BaseService } from "../../base/BaseService";
import { ${ModelName}Repository } from "./${moduleName}.repository";

// ============================================================
// ${ModelName.toUpperCase()} SERVICE — READONLY
// No create, update, or delete operations.
// Extend with custom read methods as needed.
// ============================================================

export class ${ModelName}Service extends BaseService<any, never, never> {
  protected repository = new ${ModelName}Repository();
  protected tableName = "${moduleName}";

  // Override create/update/delete to prevent accidental use
  async create(): Promise<never> {
    throw new Error("${ModelName} is read-only");
  }

  async update(): Promise<never> {
    throw new Error("${ModelName} is read-only");
  }

  async delete(): Promise<never> {
    throw new Error("${ModelName} is read-only");
  }

  // TODO: add custom read methods
}
`;
}

function generateController(): string {
  return `import { BaseController } from "../../base/BaseController";
import { ${ModelName}Service } from "./${moduleName}.service";

// ============================================================
// ${ModelName.toUpperCase()} CONTROLLER
// Inherits: create, findById, findMany, search, update,
//           delete, restore, findDeleted, findDeletedById
//
// Override any method to customise behaviour for this module.
// Add custom handlers below for non-standard operations.
// ============================================================

export class ${ModelName}Controller extends BaseController<any> {
  protected service = new ${ModelName}Service();

  // Example override:
  // create = catchAsync(async (req, res) => {
  //   const ctx = buildContext(req, res)
  //   const result = await this.service.createWithCustomLogic(req.body, ctx)
  //   appResponder(201, result, res)
  // })
}

export const ${moduleName}Controller = new ${ModelName}Controller();
`;
}

function generateTablelessController(): string {
  return `import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { appResponder } from "../../utils/appResponder.util";
import { buildContext } from "../../utils/buildContext.util";
import { ${ModelName}Service } from "./${moduleName}.service";

// ============================================================
// ${ModelName.toUpperCase()} CONTROLLER — TABLELESS
// Plain controller — does not extend BaseController.
// Add handlers for each endpoint this module exposes.
// ============================================================

export class ${ModelName}Controller {
  get = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await ${ModelName}Service.get(ctx);
    appResponder(200, result, res);
  });
}

export const ${moduleName}Controller = new ${ModelName}Controller();
`;
}

function generateRoute(): string {
  const isTableless =
    options.type === "tableless" || options.type === "external";
  const isReadonly = options.type === "readonly";

  if (isTableless) {
    return `import { Router } from "express";
import { ${moduleName}Controller } from "./${moduleName}.controller";
// import { protect } from "../../middlewares/protect.middleware";
// import { restrictTo } from "../../middlewares/restrictTo.middleware";

const router = Router();

// TODO: add routes for this module
// router.get("/", protect, ${moduleName}Controller.get);

export default router;
`;
  }

  if (isReadonly) {
    return `import { Router } from "express";
import { ${moduleName}Controller } from "./${moduleName}.controller";
import { validate, ParamsId, PaginationQuery } from "../../middlewares/validate.middleware";
// import { protect } from "../../middlewares/protect.middleware";
// import { restrictTo } from "../../middlewares/restrictTo.middleware";

const router = Router();

// Read-only routes
router.get(
  "/",
  // protect,
  validate(PaginationQuery, "query"),
  ${moduleName}Controller.findMany
);

router.get(
  "/search",
  // protect,
  validate(PaginationQuery, "query"),
  ${moduleName}Controller.search
);

router.get(
  "/:id",
  // protect,
  validate(ParamsId, "params"),
  ${moduleName}Controller.findById
);

export default router;
`;
  }

  return `import { Router } from "express";
import { ${moduleName}Controller } from "./${moduleName}.controller";
import {
  validate,
  ParamsId,
  PaginationQuery,
} from "../../middlewares/validate.middleware";
import {
  Create${ModelName}Schema,
  Update${ModelName}Schema,
} from "./${moduleName}.schema";
// import { protect } from "../../middlewares/protect.middleware";
// import { restrictTo } from "../../middlewares/restrictTo.middleware";

const router = Router();

// ============================================================
// STANDARD CRUD ROUTES
// Uncomment protect and restrictTo as you implement auth
// Add the correct permission string to restrictTo
// ============================================================

// CREATE
router.post(
  "/",
  // protect,
  // restrictTo("resource.create"),
  validate(Create${ModelName}Schema),
  ${moduleName}Controller.create
);

// READ — offset paginated list (admin)
router.get(
  "/",
  // protect,
  validate(PaginationQuery, "query"),
  ${moduleName}Controller.findMany
);

// READ — cursor paginated search (public)
router.get(
  "/search",
  // protect,
  validate(PaginationQuery, "query"),
  ${moduleName}Controller.search
);

// READ — soft deleted records (admin only)
router.get(
  "/deleted",
  // protect,
  // restrictTo("resource.read_deleted"),
  validate(PaginationQuery, "query"),
  ${moduleName}Controller.findDeleted
);

// READ — single soft deleted record (admin only)
router.get(
  "/deleted/:id",
  // protect,
  // restrictTo("resource.read_deleted"),
  validate(ParamsId, "params"),
  ${moduleName}Controller.findDeletedById
);

// READ — single record
router.get(
  "/:id",
  // protect,
  validate(ParamsId, "params"),
  ${moduleName}Controller.findById
);

// UPDATE
router.patch(
  "/:id",
  // protect,
  // restrictTo("resource.update"),
  validate(ParamsId, "params"),
  validate(Update${ModelName}Schema),
  ${moduleName}Controller.update
);

// RESTORE
router.patch(
  "/:id/restore",
  // protect,
  // restrictTo("resource.restore"),
  validate(ParamsId, "params"),
  ${moduleName}Controller.restore
);

// DELETE
router.delete(
  "/:id",
  // protect,
  // restrictTo("resource.delete"),
  validate(ParamsId, "params"),
  ${moduleName}Controller.delete
);

export default router;
`;
}

function generateOpenApi(): string {
  return `import { registry } from "../../docs/openapi.registry";
import {
  Create${ModelName}Schema,
  Update${ModelName}Schema,
  ${ModelName}ResponseSchema,
} from "./${moduleName}.schema";
import { z } from "zod";

// ============================================================
// ${ModelName.toUpperCase()} — OPENAPI ROUTE REGISTRATIONS
// Run npm run docs:build after updating this file to
// regenerate the OpenAPI spec at docs/api/openapi.json
// ============================================================

const tags = ["${ModelName}"];
const basePath = "/api/v1/${moduleName}s";

registry.registerPath({
  method: "post",
  path: basePath,
  tags,
  summary: "Create a new ${moduleName}",
  request: {
    body: {
      content: { "application/json": { schema: Create${ModelName}Schema } },
    },
  },
  responses: {
    201: {
      description: "${ModelName} created successfully",
      content: { "application/json": { schema: ${ModelName}ResponseSchema } },
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
  summary: "Get all ${moduleName}s (offset paginated)",
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
      description: "List of ${moduleName}s",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(${ModelName}ResponseSchema),
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
  path: \`\${basePath}/search\`,
  tags,
  summary: "Search ${moduleName}s (cursor paginated)",
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
            data: z.array(${ModelName}ResponseSchema),
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
  path: \`\${basePath}/{id}\`,
  tags,
  summary: "Get ${moduleName} by ID",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: {
      description: "${ModelName} found",
      content: { "application/json": { schema: ${ModelName}ResponseSchema } },
    },
    404: { description: "${ModelName} not found" },
  },
});

registry.registerPath({
  method: "patch",
  path: \`\${basePath}/{id}\`,
  tags,
  summary: "Update ${moduleName}",
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { "application/json": { schema: Update${ModelName}Schema } },
    },
  },
  responses: {
    200: {
      description: "${ModelName} updated",
      content: { "application/json": { schema: ${ModelName}ResponseSchema } },
    },
    404: { description: "${ModelName} not found" },
  },
});

registry.registerPath({
  method: "delete",
  path: \`\${basePath}/{id}\`,
  tags,
  summary: "Delete ${moduleName}",
  request: { params: z.object({ id: z.string().uuid() }) },
  responses: {
    200: { description: "${ModelName} deleted" },
    404: { description: "${ModelName} not found" },
  },
});
`;
}

function generateTest(): string {
  return `import { ${ModelName}Service } from "./${moduleName}.service";
import { ${ModelName}Repository } from "./${moduleName}.repository";
import { AppError } from "../../utils/AppError.util";

jest.mock("./${moduleName}.repository");

const mockRepo = ${ModelName}Repository as jest.Mocked<typeof ${ModelName}Repository>;

const mockCtx = {
  userId: "user-123",
  userEmail: "test@example.com",
  requestId: "req-123",
};

describe("${ModelName}Service", () => {
  let service: ${ModelName}Service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ${ModelName}Service();
  });

  describe("create", () => {
    it("should create a ${moduleName} successfully", async () => {
      // TODO: implement
      // const mockData = { name: "Test" }
      // const mockRecord = { id: "uuid", ...mockData, createdAt: new Date(), updatedAt: new Date() }
      // jest.spyOn(service["repository"], "create").mockResolvedValue(mockRecord)
      // const result = await service.create(mockData, mockCtx)
      // expect(result).toEqual(mockRecord)
    });
  });

  describe("findById", () => {
    it("should return a ${moduleName} by id", async () => {
      // TODO: implement
    });

    it("should throw AppError 404 when ${moduleName} not found", async () => {
      // TODO: implement
      // jest.spyOn(service["repository"], "findByIdOrThrow").mockRejectedValue(new AppError("error.db.not_found", 404))
      // await expect(service.findById("bad-id", mockCtx)).rejects.toThrow(AppError)
    });
  });

  describe("update", () => {
    it("should update a ${moduleName}", async () => {
      // TODO: implement
    });
  });

  describe("delete", () => {
    it("should soft delete a ${moduleName}", async () => {
      // TODO: implement
    });

    it("should hard delete a ${moduleName} when soft=false", async () => {
      // TODO: implement
    });
  });

  describe("restore", () => {
    it("should restore a soft deleted ${moduleName}", async () => {
      // TODO: implement
    });
  });
});
`;
}

function generateIndex(): string {
  return `export { default } from "./${moduleName}.route";
export { ${ModelName}Service } from "./${moduleName}.service";
${
  options.type === "standard" ||
  options.type === "readonly" ||
  options.type === "custom"
    ? `export { ${ModelName}Repository } from "./${moduleName}.repository";`
    : ""
}
export * from "./${moduleName}.types";
`;
}

// ============================================================
// FILE MAP
// Maps filename to generator function based on module type
// ============================================================

async function main() {
  // Verify module does not already exist
  if (fs.existsSync(MODULE_DIR)) {
    console.error(`Module "${moduleName}" already exists at ${MODULE_DIR}`);
    process.exit(1);
  }

  let fields: PrismaField[] = [];

  // Read Prisma schema for model-based modules
  const needsPrismaModel = ["standard", "readonly", "custom"].includes(
    options.type
  );

  if (needsPrismaModel) {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
    const dmmf = await getDMMF({ datamodel: schemaContent });
    const model = dmmf.datamodel.models.find(
      (m) => m.name.toLowerCase() === moduleName.toLowerCase()
    );

    if (!model) {
      console.error(`Model "${ModelName}" not found in prisma/schema.prisma`);
      console.error(
        `Available models: ${dmmf.datamodel.models
          .map((m) => m.name)
          .join(", ")}`
      );
      console.error(
        `If this is a tableless module use: npm run scaffold ${moduleName} --type=tableless`
      );
      process.exit(1);
    }

    fields = model.fields.map((f) => ({
      name: f.name,
      type: f.type,
      isRequired: f.isRequired as boolean,
      isId: f.isId as boolean,
      hasDefault: !!(f.default ?? f.isId ?? f.isUpdatedAt),
      relationName: f.relationName ?? undefined,
    }));
  }

  // Create module directory
  fs.mkdirSync(MODULE_DIR, { recursive: true });

  // Build file map based on module type
  const files: Record<string, string> = {};

  // Schema and types — only for model-based modules
  if (needsPrismaModel) {
    files[`${moduleName}.schema.ts`] = generateSchema(fields);
    files[`${moduleName}.types.ts`] = generateTypes(fields);
    files[`${moduleName}.repository.ts`] = generateRepository(fields);
  }

  // Service — varies by type
  switch (options.type) {
    case "tableless":
      files[`${moduleName}.service.ts`] = generateTablelessService();
      break;
    case "external":
      files[`${moduleName}.service.ts`] = generateExternalService();
      break;
    case "readonly":
      files[`${moduleName}.service.ts`] = generateReadonlyService();
      break;
    default:
      files[`${moduleName}.service.ts`] = generateService();
  }

  // Controller — varies by type
  if (options.type === "tableless" || options.type === "external") {
    files[`${moduleName}.controller.ts`] = generateTablelessController();
  } else {
    files[`${moduleName}.controller.ts`] = generateController();
  }

  // Route, OpenAPI, test, index — all types get these
  files[`${moduleName}.route.ts`] = generateRoute();
  files[`${moduleName}.openapi.ts`] = generateOpenApi();
  files[`${moduleName}.test.ts`] = generateTest();
  files[`index.ts`] = generateIndex();

  // Write all files
  console.log(
    `\nScaffolding module "${ModelName}" (type: ${options.type})...\n`
  );

  for (const [filename, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(MODULE_DIR, filename), content);
    console.log(`  ✅ Created: src/modules/${moduleName}/${filename}`);
  }

  // Print next steps
  console.log(`\n✨ Module "${ModelName}" scaffolded successfully!\n`);
  console.log("Next steps:");
  console.log(`  1. Register route in src/modules/index.ts (or src/app.ts):`);
  console.log(`       import ${moduleName}Router from './${moduleName}'`);
  console.log(`       app.use('/api/v1/${moduleName}s', ${moduleName}Router)`);
  console.log(`\n  2. Add OpenAPI import to cli/build-docs.ts:`);
  console.log(
    `       import '../src/modules/${moduleName}/${moduleName}.openapi'`
  );
  console.log(`\n  3. Rebuild docs:`);
  console.log(`       npm run docs:build`);
  console.log(`\n  4. Set searchableFields in ${moduleName}.repository.ts`);
  console.log(`\n  5. Implement business logic in ${moduleName}.service.ts`);
  console.log(`\n  6. Add translations to src/locales/en/${moduleName}.json`);
  console.log(`       and src/locales/fr/${moduleName}.json\n`);
}

main().catch((err) => {
  console.error("Scaffold failed:", err.message);
  process.exit(1);
});
