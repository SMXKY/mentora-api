/**
 * Seeds the fixed test user + fixtures for k6/media-http-flow.test.js.
 *
 * Run automatically by `npm run test:k6:media`. Idempotent: re-running
 * resets the user's password, storage usage, quota override, and any
 * files left over from a previous run.
 *
 * The tiny quota override (30KB) is what makes the quota-exceeded case
 * deterministic without needing a 500MB upload.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import argon2 from "argon2";
import prisma from "../../src/config/database.config";

export const K6_MEDIA_EMAIL = "k6.media@mentora.test";
export const K6_MEDIA_PASSWORD = "K6MediaTest#12345";
const QUOTA_LIMIT_BYTES = BigInt(30 * 1024); // 30KB

// 1x1 red-pixel PNG — genuine magic bytes, passes content sniffing.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function main(): Promise<void> {
  const password = await argon2.hash(K6_MEDIA_PASSWORD);

  let user = await prisma.user.findFirst({
    where: { email: K6_MEDIA_EMAIL },
    select: { id: true },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: K6_MEDIA_EMAIL,
        password,
        isEmailVerified: true,
      },
      select: { id: true },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: { password, deletedAt: null, status: "ACTIVE" },
    });
  }

  // Reset all media state from previous runs.
  await prisma.fileVariant.deleteMany({
    where: { file: { uploadedById: user.id } },
  });
  await prisma.file.deleteMany({ where: { uploadedById: user.id } });
  await prisma.storageUsage.upsert({
    where: { userId: user.id },
    create: { userId: user.id, usedBytes: BigInt(0) },
    update: { usedBytes: BigInt(0) },
  });
  await prisma.storageQuotaOverride.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      quotaLimitBytes: QUOTA_LIMIT_BYTES,
      grantedById: user.id,
      reason: "k6 media HTTP flow test",
    },
    update: { quotaLimitBytes: QUOTA_LIMIT_BYTES, expiresAt: null },
  });

  // Binary fixtures the k6 script open()s.
  const fixturesDir = path.join(__dirname, "..", "fixtures");
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.writeFileSync(path.join(fixturesDir, "tiny.png"), TINY_PNG);
  // Over the 30KB quota, under the 5MB PROFILE_PHOTO cap → quotaExceeded.
  fs.writeFileSync(
    path.join(fixturesDir, "quota-buster.png"),
    Buffer.concat([TINY_PNG, Buffer.alloc(40 * 1024)])
  );
  // Over the 5MB PROFILE_PHOTO cap → fileTooLarge.
  fs.writeFileSync(
    path.join(fixturesDir, "oversized.png"),
    Buffer.concat([TINY_PNG, Buffer.alloc(6 * 1024 * 1024)])
  );
  fs.writeFileSync(
    path.join(fixturesDir, "not-allowed.txt"),
    Buffer.from("plain text, not an allowed media type")
  );

  console.log(
    `Seeded k6 media test user ${K6_MEDIA_EMAIL} (quota ${QUOTA_LIMIT_BYTES} bytes) and fixtures in k6/fixtures/`
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
