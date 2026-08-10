import "dotenv/config";
import prisma from "../src/config/database.config";
import { configureTutorIndex, indexTutor } from "../src/services/search/meilisearchTutorIndex";

// One-time full reindex, safe to re-run any time (e.g. after a ranking
// rules change, or to recover from a Meilisearch data loss). Configures
// the index settings first, then pushes every tutor profile through the
// same indexTutor() path the ongoing sync hook uses, so backfilled data
// and live-synced data are always built the exact same way.

async function main() {
  console.log("Configuring tutor index settings...");
  await configureTutorIndex();

  const tutors = await prisma.tutorProfile.findMany({
    select: { id: true },
  });

  console.log(`Indexing ${tutors.length} tutor profiles...`);

  let indexed = 0;
  let failed = 0;

  for (const tutor of tutors) {
    try {
      await indexTutor(tutor.id);
      indexed++;
    } catch (err) {
      failed++;
      console.error(`Failed to index tutor ${tutor.id}:`, err);
    }
  }

  console.log(`Done. Indexed ${indexed}, failed ${failed}, total ${tutors.length}`);
}

main()
  .catch((err) => {
    console.error("Meilisearch tutor backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
