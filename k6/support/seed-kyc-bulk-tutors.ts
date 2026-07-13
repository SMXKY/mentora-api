/**
 * Seeds a batch of Tutor accounts with 100%-complete profiles (Module 7
 * rules), spread across several cities/regions with distinct names, so
 * k6/kyc-bulk-queue.test.js has enough varied data to exercise the admin
 * KYC queue's search, sort, filter, and pagination meaningfully — a
 * single seeded tutor (see seed-kyc-test-tutor.ts) can't prove search or
 * city-filtering actually work.
 *
 * Does NOT submit KYC itself — the k6 script drives the real wizard
 * endpoints (step-1/step-2/credentials/submit) against these accounts so
 * the run also doubles as tutor-facing wizard coverage under volume.
 *
 * Run automatically by `npm run test:k6:kyc:bulk`. Idempotent — safe to
 * re-run; resets each seeded tutor's KYC state back to INCOMPLETE.
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

export const KYC_BULK_PASSWORD = "K6KycBulkTutor#12345";
const EMAIL_PREFIX = "k6.kyc.bulk";
const TUTOR_COUNT = Number(process.env.KYC_BULK_TUTOR_COUNT || 24);

// Deliberately varied first/last names — several share a first name so
// ?search=Marie is a meaningful multi-result test, not a 1-hit lookup.
const FIRST_NAMES = [
  "Marie", "Marie", "Jean", "Jean", "Fatima", "Paul", "Grace", "Samuel",
  "Aisha", "Emmanuel", "Chantal", "Pierre", "Ngozi", "Christian", "Aminata",
  "Bertrand", "Sandrine", "Olivier", "Rachel", "Innocent", "Beatrice",
  "Franck", "Josiane", "Alain",
];
const LAST_NAMES = [
  "Nkeng", "Fotso", "Mballa", "Kamdem", "Bello", "Njoya", "Tchoumi",
  "Abanda", "Etoundi", "Ngassa", "Djoumessi", "Wafo", "Simo", "Ateba",
  "Kwedi", "Manga", "Ndzana", "Zeh", "Ebode", "Tabi", "Ondoa", "Biya",
  "Kenfack", "Mvondo",
];

async function main(): Promise<void> {
  const password = await argon2.hash(KYC_BULK_PASSWORD);

  const tutorRole = await prisma.role.findFirst({ where: { name: "Tutor" } });
  if (!tutorRole) throw new Error("Tutor role not seeded — run the app once to seed roles first.");

  // Two regions / three cities so cityId/regionId filters have something
  // real to discriminate on.
  let centre = await prisma.region.findFirst({ where: { name: "Centre" } });
  if (!centre) centre = await prisma.region.create({ data: { name: "Centre" } });
  let littoral = await prisma.region.findFirst({ where: { name: "Littoral" } });
  if (!littoral) littoral = await prisma.region.create({ data: { name: "Littoral" } });

  async function ensureCity(name: string, regionId: string) {
    let city = await prisma.city.findFirst({ where: { name, regionId } });
    if (!city) {
      city = await prisma.city.create({ data: { name, regionId, isInAllowlist: true } });
    }
    return city;
  }
  const yaounde = await ensureCity("Yaoundé", centre.id);
  const bafia = await ensureCity("Bafia", centre.id);
  const douala = await ensureCity("Douala", littoral.id);
  const cities = [yaounde, bafia, douala];

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

  const seeded: Array<{
    email: string;
    tutorProfileId: string;
    userId: string;
    firstName: string;
    lastName: string;
    cniNumber: string;
    cityId: string;
    cityName: string;
    regionId: string;
    subjectId: string;
  }> = [];

  for (let i = 0; i < TUTOR_COUNT; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const city = cities[i % cities.length];
    const email = `${EMAIL_PREFIX}.${i}@mentora.test`;
    // 9-digit, deterministic-but-unique per index.
    const cniNumber = `9${String(100000 + i).padStart(8, "0")}`.slice(0, 9);

    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password,
          isEmailVerified: true,
          firstName,
          lastName,
          phoneNumber: `+2376${String(10000000 + i).padStart(8, "0")}`,
          status: "ACTIVE",
          deletedAt: null,
        },
      });
      await prisma.wallet.create({ data: { userId: user.id, walletType: "TUTOR", balanceXaf: 0 } });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { password, deletedAt: null, status: "ACTIVE", firstName, lastName },
      });
    }

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: tutorRole.id } },
      create: { userId: user.id, roleId: tutorRole.id, createdById: user.id, isActive: true },
      update: { isActive: true },
    });

    const existingProfile = await prisma.tutorProfile.findFirst({ where: { userId: user.id } });
    const tutorProfile = existingProfile
      ? await prisma.tutorProfile.update({
          where: { id: existingProfile.id },
          data: {
            cityId: city.id,
            minRateXaf: 3000,
            maxRateXaf: 6000,
            profilePictureUrl: "profile-photos/seed-placeholder.jpg",
            deletedAt: null,
          },
        })
      : await prisma.tutorProfile.create({
          data: {
            userId: user.id,
            bio: `Seeded bulk tutor #${i} for k6 KYC queue load testing.`,
            teachingMode: "BOTH",
            cityId: city.id,
            minRateXaf: 3000,
            maxRateXaf: 6000,
            profilePictureUrl: "profile-photos/seed-placeholder.jpg",
          },
        });

    // Reset KYC state so every run starts clean and idempotent.
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

    seeded.push({
      email,
      tutorProfileId: tutorProfile.id,
      userId: user.id,
      firstName,
      lastName,
      cniNumber,
      cityId: city.id,
      cityName: city.name,
      regionId: city.regionId,
      subjectId: subject.id,
    });
  }

  const fixturesDir = path.join(__dirname, "..", "fixtures");
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.writeFileSync(path.join(fixturesDir, "kyc-photo.png"), TINY_PNG);
  fs.writeFileSync(path.join(fixturesDir, "kyc-document.pdf"), TINY_PDF);
  fs.writeFileSync(
    path.join(fixturesDir, "kyc-bulk-seed.json"),
    JSON.stringify({ password: KYC_BULK_PASSWORD, tutors: seeded }, null, 2)
  );

  console.log(
    JSON.stringify({ event: "kyc_bulk_tutors_seeded", count: seeded.length })
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Bulk KYC seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
