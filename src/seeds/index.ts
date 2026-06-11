import seedRoles from "./roles.seed";

export const runSeeds = async () => {
  console.log("🌱 Starting database seed...");

  await seedRoles();

  console.log("✅ All seeds completed");
};
