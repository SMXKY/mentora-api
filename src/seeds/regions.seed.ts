import prisma from "../config/database.config";

// Cameroon's ten official regions.
export const defaultRegions = [
  "Adamawa",
  "Centre",
  "East",
  "Far North",
  "Littoral",
  "North",
  "Northwest",
  "South",
  "Southwest",
  "West",
].map((name) => ({ name, countryCode: "CM" }));

const seedRegions = async () => {
  console.log("🌱 Seeding regions...");

  let created = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const region of defaultRegions) {
      const exists = await tx.region.findUnique({ where: { name: region.name } });
      if (exists) {
        skipped++;
        continue;
      }
      await tx.region.create({ data: region });
      created++;
    }
  });

  console.log(`✅ Regions seeded: ${created} created, ${skipped} skipped`);
};

export default seedRegions;
