/**
 * Seeds a Tutor test account whose profile is already 100% complete
 * (Module 7 rules) so k6/kyc-flow.test.js can reach the KYC wizard.
 *
 * There is no HTTP endpoint yet to create a TutorProfile (that module
 * hasn't been built) — this script writes one directly via Prisma, the
 * same way the media test-user seed does for its fixtures.
 *
 * Run automatically by `npm run test:k6:kyc`. Idempotent.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import argon2 from "argon2";
import prisma from "../../src/config/database.config";

// A minimal, structurally valid one-page PDF — passes MediaService's
// content-sniffed MIME check the same way a real PDF would.
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

export const KYC_TUTOR_EMAIL = "k6.kyc.tutor@mentora.test";
export const KYC_TUTOR_PASSWORD = "K6KycTutorTest#12345";

async function main(): Promise<void> {
  const password = await argon2.hash(KYC_TUTOR_PASSWORD);

  const tutorRole = await prisma.role.findFirst({ where: { name: "Tutor" } });
  if (!tutorRole) throw new Error("Tutor role not seeded — run the app once to seed roles first.");

  let user = await prisma.user.findFirst({ where: { email: KYC_TUTOR_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: KYC_TUTOR_EMAIL,
        password,
        isEmailVerified: true,
        firstName: "Kyc",
        lastName: "Tester",
        phoneNumber: "+237601020304",
        status: "ACTIVE",
        deletedAt: null,
      },
    });
    await prisma.wallet.create({ data: { userId: user.id, walletType: "TUTOR", balanceXaf: 0 } });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { password, deletedAt: null, status: "ACTIVE", isAccountComplete: undefined },
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

  // Completion requires: bio/location/mode (guaranteed by the row
  // existing), at least one subject, both rates, and a photo.
  const existingProfile = await prisma.tutorProfile.findFirst({ where: { userId: user.id } });
  const tutorProfile = existingProfile
    ? await prisma.tutorProfile.update({
        where: { id: existingProfile.id },
        data: {
          minRateXaf: 3000,
          maxRateXaf: 6000,
          profilePictureUrl: "profile-photos/seed-placeholder.jpg",
          deletedAt: null,
        },
      })
    : await prisma.tutorProfile.create({
        data: {
          userId: user.id,
          bio: "Seeded tutor for k6 KYC flow testing.",
          teachingMode: "BOTH",
          cityId: city.id,
          minRateXaf: 3000,
          maxRateXaf: 6000,
          profilePictureUrl: "profile-photos/seed-placeholder.jpg",
        },
      });

  // Reset any prior KYC state so the flow starts clean each run.
  await prisma.kycRejectionFlag.deleteMany({
    where: { kycApplication: { tutorProfileId: tutorProfile.id } },
  });
  await prisma.kycChecklistSubmission.deleteMany({
    where: { kycApplication: { tutorProfileId: tutorProfile.id } },
  });
  await prisma.kycStatusHistory.deleteMany({ where: { tutorProfileId: tutorProfile.id } });
  await prisma.kycApplication.deleteMany({ where: { tutorProfileId: tutorProfile.id } });
  await prisma.credentialSubjectLink.deleteMany({
    where: { credential: { tutorProfileId: tutorProfile.id } },
  });
  await prisma.tutorSubject.deleteMany({ where: { tutorProfileId: tutorProfile.id } });
  await prisma.tutorCredential.deleteMany({ where: { tutorProfileId: tutorProfile.id } });
  await prisma.kycBan.deleteMany({ where: { tutorProfileId: tutorProfile.id } });
  await prisma.tutorProfile.update({
    where: { id: tutorProfile.id },
    data: {
      kycStatus: "INCOMPLETE",
      kycSubmittedAt: null,
      kycApprovedAt: null,
      kycRejectedAt: null,
      kycRejectionReason: null,
    },
  });

  const fixturesDir = path.join(__dirname, "..", "fixtures");
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.writeFileSync(path.join(fixturesDir, "kyc-photo.png"), TINY_PNG);
  fs.writeFileSync(path.join(fixturesDir, "kyc-document.pdf"), TINY_PDF);
  fs.writeFileSync(
    path.join(fixturesDir, "kyc-seed.json"),
    JSON.stringify({
      email: KYC_TUTOR_EMAIL,
      tutorProfileId: tutorProfile.id,
      subjectId: subject.id,
      cityId: city.id,
      regionId: region.id,
    })
  );

  console.log(
    JSON.stringify({
      event: "kyc_test_tutor_seeded",
      email: KYC_TUTOR_EMAIL,
      tutorProfileId: tutorProfile.id,
      subjectId: subject.id,
      cityId: city.id,
      regionId: region.id,
    })
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
