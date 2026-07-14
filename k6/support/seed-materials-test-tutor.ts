/**
 * Seeds a Tutor test account that is already fully complete AND has an
 * ACTIVE (approved) KYC application, so k6/materials-flow.test.js can hit
 * every Module 8.5 Learning Materials endpoint straight away — both
 * checkAccountCompletion and checkKyc pass on the first request.
 *
 * There is no HTTP flow that reaches ACTIVE KYC quickly enough for a fast
 * k6 run (see kyc-flow.test.js for the real multi-step wizard) — this
 * script writes the end state directly via Prisma, the same way the KYC
 * and media test-user seeds do for their fixtures.
 *
 * Run automatically by `npm run test:k6:materials`. Idempotent.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import argon2 from "argon2";
import prisma from "../../src/config/database.config";

const TINY_PDF = Buffer.from(
  "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF",
  "utf8"
);
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);
const TINY_MP3 = Buffer.from(
  "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjQ1LjEwMAAAAAAAAAAAAAAA//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAADAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMA=",
  "base64"
);

export const MATERIALS_TUTOR_EMAIL = "k6.materials.tutor@mentora.test";
export const MATERIALS_TUTOR_PASSWORD = "K6MaterialsTutorTest#12345";

async function main(): Promise<void> {
  const password = await argon2.hash(MATERIALS_TUTOR_PASSWORD);

  const tutorRole = await prisma.role.findFirst({ where: { name: "Tutor" } });
  if (!tutorRole) throw new Error("Tutor role not seeded — run the app once to seed roles first.");

  let user = await prisma.user.findFirst({ where: { email: MATERIALS_TUTOR_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: MATERIALS_TUTOR_EMAIL,
        password,
        isEmailVerified: true,
        firstName: "Materials",
        lastName: "Tester",
        phoneNumber: "+237601020399",
        status: "ACTIVE",
        isAccountComplete: true,
        deletedAt: null,
      },
    });
    await prisma.wallet.create({ data: { userId: user.id, walletType: "TUTOR", balanceXaf: 0 } });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { password, deletedAt: null, status: "ACTIVE", isAccountComplete: true },
    });
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: tutorRole.id } },
    create: { userId: user.id, roleId: tutorRole.id, createdById: user.id, isActive: true },
    update: { isActive: true },
  });

  let region = await prisma.region.findFirst();
  if (!region) region = await prisma.region.create({ data: { name: "Centre" } });
  let city = await prisma.city.findFirst({ where: { regionId: region.id } });
  if (!city) {
    city = await prisma.city.create({
      data: { name: "Yaoundé", regionId: region.id, isInAllowlist: true },
    });
  }

  let subjectDomain = await prisma.subjectDomain.findFirst();
  if (!subjectDomain) {
    subjectDomain = await prisma.subjectDomain.create({ data: { name: "Sciences" } });
  }
  let subject = await prisma.subject.findFirst({ where: { domainId: subjectDomain.id } });
  if (!subject) {
    subject = await prisma.subject.create({
      data: { name: "Mathematics", domainId: subjectDomain.id },
    });
  }

  let level = await prisma.level.findFirst({ where: { name: "Form 5" } });
  if (!level) {
    level = await prisma.level.create({
      data: { name: "Form 5", schoolType: "SECONDARY", orderIndex: 5 },
    });
  }

  const existingProfile = await prisma.tutorProfile.findFirst({ where: { userId: user.id } });
  const tutorProfile = existingProfile
    ? await prisma.tutorProfile.update({
        where: { id: existingProfile.id },
        data: {
          minRateXaf: 3000,
          maxRateXaf: 6000,
          profilePictureUrl: "profile-photos/seed-placeholder.jpg",
          kycStatus: "ACTIVE",
          kycApprovedAt: new Date(),
          deletedAt: null,
        },
      })
    : await prisma.tutorProfile.create({
        data: {
          userId: user.id,
          bio: "Seeded tutor for k6 Learning Materials flow testing.",
          teachingMode: "BOTH",
          cityId: city.id,
          minRateXaf: 3000,
          maxRateXaf: 6000,
          profilePictureUrl: "profile-photos/seed-placeholder.jpg",
          kycStatus: "ACTIVE",
          kycApprovedAt: new Date(),
        },
      });

  // Reset any prior materials from a previous run so the flow starts clean.
  await prisma.materialReview.deleteMany({ where: { tutorId: user.id } });
  await prisma.lessonPlanTopic.deleteMany({
    where: { lessonPlan: { tutorProfileId: tutorProfile.id } },
  });
  await prisma.lessonPlan.deleteMany({ where: { tutorProfileId: tutorProfile.id } });
  await prisma.material.deleteMany({
    where: { collection: { tutorProfileId: tutorProfile.id } },
  });
  await prisma.section.deleteMany({
    where: { collection: { tutorProfileId: tutorProfile.id } },
  });
  await prisma.collection.deleteMany({ where: { tutorProfileId: tutorProfile.id } });

  const fixturesDir = path.join(__dirname, "..", "fixtures");
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.writeFileSync(path.join(fixturesDir, "materials-image.png"), TINY_PNG);
  fs.writeFileSync(path.join(fixturesDir, "materials-document.pdf"), TINY_PDF);
  fs.writeFileSync(path.join(fixturesDir, "materials-audio.mp3"), TINY_MP3);
  fs.writeFileSync(
    path.join(fixturesDir, "materials-seed.json"),
    JSON.stringify({
      email: MATERIALS_TUTOR_EMAIL,
      tutorProfileId: tutorProfile.id,
      subjectId: subject.id,
      levelId: level.id,
    })
  );

  console.log(
    JSON.stringify({
      event: "materials_test_tutor_seeded",
      email: MATERIALS_TUTOR_EMAIL,
      tutorProfileId: tutorProfile.id,
      subjectId: subject.id,
      levelId: level.id,
    })
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
