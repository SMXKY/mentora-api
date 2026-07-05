import seedPermissionModules from "./permissionModules.seed";
import seedPermissions from "./permissions.seed";
import seedPermissionSubmodules from "./permissionSubModules.seed";
import seedRoles from "./roles.seed";
import seedSuperAdmin from "./superAdmin.seed";
import seedRegions from "./regions.seed";
import seedCities from "./cities.seed";
import { seedSubjectDomains, seedSubjects } from "./subjects.seed";
import seedLevels from "./levels.seed";

export const runSeeds = async () => {
  console.log("🌱 Starting database seed...");

  await seedRoles();
  await seedPermissionModules();
  await seedPermissionSubmodules();
  await seedSuperAdmin();
  await seedPermissions();

  // Catalog/taxonomy data — cities and subjects each depend on their
  // parent (regions, subject domains) already existing.
  await seedRegions();
  await seedCities();
  await seedSubjectDomains();
  await seedSubjects();
  await seedLevels();

  console.log("✅ All seeds completed");
};
