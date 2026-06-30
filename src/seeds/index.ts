import seedPermissionModules from "./permissionModules.seed";
import seedPermissions from "./permissions.seed";
import seedPermissionSubmodules from "./permissionSubModules.seed";
import seedRoles from "./roles.seed";
import seedSuperAdmin from "./superAdmin.seed";

export const runSeeds = async () => {
  console.log("🌱 Starting database seed...");

  await seedRoles();
  await seedPermissionModules();
  await seedPermissionSubmodules();
  await seedSuperAdmin();
  await seedPermissions();

  console.log("✅ All seeds completed");
};
