import seedRoles from "./roles.seed";
import seedSuperAdmin from "./superAdmin.seed";

export const runSeeds = async () => {
  console.log("🌱 Starting database seed...");

  await seedRoles();
  //seedRolePermissions
  await seedSuperAdmin();

  console.log("✅ All seeds completed");
};
