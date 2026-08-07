import prisma from "../config/database.config";

// A representative set of well-known cities per region — not exhaustive,
// enough to make the catalog and address-selection flows usable.
export const defaultCitiesByRegion: Record<string, string[]> = {
  Adamawa: ["Ngaoundéré", "Meiganga", "Tibati", "Banyo", "Tignère"],
  Centre: [
    "Yaoundé",
    "Mbalmayo",
    "Obala",
    "Monatélé",
    "Bafia",
    "Akonolinga",
    "Eséka",
    "Nanga-Eboko",
    "Mfou",
    "Sa'a",
  ],
  East: [
    "Bertoua",
    "Abong-Mbang",
    "Batouri",
    "Yokadouma",
    "Garoua-Boulaï",
    "Bélabo",
    "Doumé",
  ],
  "Far North": ["Maroua", "Kousséri", "Mokolo", "Mora", "Yagoua", "Kaélé"],
  Littoral: [
    "Douala",
    "Nkongsamba",
    "Edéa",
    "Loum",
    "Manjo",
    "Melong",
    "Yabassi",
  ],
  North: ["Garoua", "Guider", "Poli", "Tcholliré", "Pitoa"],
  Northwest: [
    "Bamenda",
    "Kumbo",
    "Wum",
    "Ndop",
    "Mbengwi",
    "Fundong",
    "Nkambe",
    "Bali",
    "Batibo",
    "Bafut",
  ],
  South: ["Ebolowa", "Kribi", "Sangmélima", "Ambam", "Djoum", "Campo"],
  Southwest: [
    "Buea",
    "Limbe",
    "Kumba",
    "Mamfe",
    "Tiko",
    "Mbanga",
    "Muyuka",
    "Mundemba",
    "Bangem",
    "Menji",
    "Fontem",
  ],
  West: [
    "Bafoussam",
    "Dschang",
    "Mbouda",
    "Foumban",
    "Bafang",
    "Bandjoun",
    "Bangangté",
    "Foumbot",
    "Baham",
  ],
};

const seedCities = async () => {
  console.log("🌱 Seeding cities...");

  let created = 0;
  let skipped = 0;
  let regionsMissing = 0;

  for (const [regionName, cityNames] of Object.entries(defaultCitiesByRegion)) {
    const region = await prisma.region.findUnique({
      where: { name: regionName },
    });
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
