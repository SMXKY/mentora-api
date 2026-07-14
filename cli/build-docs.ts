import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "../src/docs/openapi.registry";
import fs from "fs";
import path from "path";

//module docs
import "../src/modules/auth/auth.openapi";
import "../src/modules/permission/permission.openapi";
import "../src/modules/permissionOverride/permissionOverride.openapi";
import "../src/modules/role/role.openapi";
import "../src/modules/user/user.openapi";
import "../src/modules/userRole/userRole.openapi";
import "../src/modules/notification/notification.openapi";
import "../src/modules/media/media.openapi";
import "../src/modules/adminUser/adminUser.openapi";
import "../src/modules/kyc/kyc.openapi";
import "../src/modules/catalog/catalog.openapi";
import "../src/modules/student/student.openapi";
import "../src/modules/parent/parent.openapi";
import "../src/modules/tutor/tutor.openapi";
import "../src/modules/dashboard/dashboard.openapi";
import "../src/modules/materials/materials.openapi";
import "../src/modules/materials/materialsAdmin.openapi";
// testResource is a scaffold template, not a mounted module — excluded on purpose

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
      {
        url: "https://mentora.api.tallamichael.online",
        description: "Production",
      },
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
