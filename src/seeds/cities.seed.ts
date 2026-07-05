import prisma from "../config/database.config";

// A representative set of well-known cities per region — not exhaustive,
// enough to make the catalog and address-selection flows usable.
export const defaultCitiesByRegion: Record<string, string[]> = {
  Adamawa: ["Ngaoundéré", "Meiganga", "Tibati"],
  Centre: ["Yaoundé", "Mbalmayo", "Obala", "Monatélé"],
  East: ["Bertoua", "Abong-Mbang", "Batouri"],
  "Far North": ["Maroua", "Kousséri", "Mokolo"],
  Littoral: ["Douala", "Nkongsamba", "Edéa"],
  North: ["Garoua", "Guider", "Poli"],
  Northwest: ["Bamenda", "Kumbo", "Wum", "Ndop"],
  South: ["Ebolowa", "Kribi", "Sangmélima"],
  Southwest: ["Buea", "Limbe", "Kumba", "Mamfe"],
  West: ["Bafoussam", "Dschang", "Mbouda", "Foumban"],
};

const seedCities = async () => {
  console.log("🌱 Seeding cities...");

  let created = 0;
  let skipped = 0;
  let regionsMissing = 0;

  for (const [regionName, cityNames] of Object.entries(defaultCitiesByRegion)) {
    const region = await prisma.region.findUnique({ where: { name: regionName } });
    if (!region) {
      // Regions must be seeded first — skip rather than crash the whole
      // boot sequence if seedRegions hasn't run yet for some reason.
      regionsMissing++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      for (const cityName of cityNames) {
        const exists = await tx.city.findFirst({
          where: { name: cityName, regionId: region.id },
        });
        if (exists) {
          skipped++;
          continue;
        }
        await tx.city.create({
          data: { name: cityName, regionId: region.id, isInAllowlist: true },
        });
        created++;
      }
    });
  }

  console.log(
    `✅ Cities seeded: ${created} created, ${skipped} skipped` +
      (regionsMissing > 0 ? `, ${regionsMissing} region(s) not found` : "")
  );
};

export default seedCities;
