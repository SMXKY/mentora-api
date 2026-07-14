/**
 * Deletes the bytes the 5 real-tutor k6 KYC test accounts uploaded to
 * whichever storage backend is currently active (STORAGE_PROVIDER env var
 * — must match the provider that was active during the k6 run being
 * cleaned up), then hard-deletes the underlying File rows.
 *
 * MediaService.delete() only soft-deletes (bytes are swept by the 30-day
 * purge job), which is too slow for repeated test runs against real
 * production R2/FTP storage — this script removes bytes immediately.
 *
 * Run: STORAGE_PROVIDER=r2 ts-node k6/support/cleanup-kyc-real-tutors-storage.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import prisma from "../../src/config/database.config";
import { getStorageAdapter } from "../../src/services/media";

async function main(): Promise<void> {
  const seedPath = path.join(__dirname, "..", "fixtures", "kyc-real-tutors-seed.json");
  if (!fs.existsSync(seedPath)) {
    console.log(JSON.stringify({ event: "cleanup_skipped", reason: "no seed file found" }));
    return;
  }
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const userIds: string[] = seed.tutors.map((t: { userId: string }) => t.userId);

  const files = await prisma.file.findMany({
    where: { uploadedById: { in: userIds } },
    select: { id: true, storagePath: true, variants: { select: { storagePath: true } } },
  });

  const storage = getStorageAdapter();
  console.log(
    JSON.stringify({
      event: "cleanup_starting",
      provider: process.env.STORAGE_PROVIDER,
      fileCount: files.length,
    })
  );

  let removed = 0;
  let failed = 0;
  for (const file of files) {
    try {
      await storage.remove(file.storagePath);
      for (const variant of file.variants) {
        await storage.remove(variant.storagePath);
      }
      removed++;
    } catch (err) {
      failed++;
      console.error({
        event: "cleanup_remove_failed",
        storagePath: file.storagePath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const fileIds = files.map((f) => f.id);
  await prisma.fileVariant.deleteMany({ where: { fileId: { in: fileIds } } });
  await prisma.file.deleteMany({ where: { id: { in: fileIds } } });

  console.log(JSON.stringify({ event: "cleanup_completed", removed, failed }));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Cleanup failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
