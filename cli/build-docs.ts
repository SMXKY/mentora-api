import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "../src/docs/openapi.registry";
import fs from "fs";
import path from "path";

//module docs
import "../src/modules/testResource/testResource.openapi";

async function main() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  const spec = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "MENTORA API",
      version: "1.0.0",
      description: "MENTORA tutoring marketplace REST API",
    },
    servers: [
      { url: "http://localhost:3000", description: "Development" },
      { url: "https://api.mentora.cm", description: "Production" },
    ],
  });

  const outputPath = path.join(__dirname, "../docs/api/openapi.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));

  console.log("OpenAPI spec generated: docs/api/openapi.json");
}

main().catch((err) => {
  console.error("Failed to generate docs:", err.message);
  process.exit(1);
});
