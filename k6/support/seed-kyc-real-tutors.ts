/**
 * Seeds 5 Tutor accounts with 100%-complete profiles (Module 7 rules) that
 * pair with the real-file fixtures in k6/fixtures/real-tutors/tutor-N/
 * (real downloaded photos + realistic multi-page generated PDFs, not the
 * 68-byte synthetic stubs the other seed scripts use).
 *
 * Names match k6/support/generate-real-tutor-pdfs.ts's TUTOR_NAMES so the
 * generated degree/non-conviction PDFs read as belonging to the right person.
 *
 * Run: ts-node k6/support/seed-kyc-real-tutors.ts
 * (npm run test:k6:kyc:real does fixture generation + this + the k6 run)
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import argon2 from "argon2";
import prisma from "../../src/config/database.config";

export const KYC_REAL_PASSWORD = "K6KycRealTutor#12345";
const EMAIL_PREFIX = "k6.kyc.real";

const TUTORS = [
  { firstName: "Marie", lastName: "Nkeng", city: "Yaoundé" },
  { firstName: "Jean", lastName: "Fotso", city: "Douala" },
  { firstName: "Fatima", lastName: "Bello", city: "Bafia" },
  { firstName: "Paul", lastName: "Njoya", city: "Yaoundé" },
  { firstName: "Grace", lastName: "Tchoumi", city: "Douala" },
];

async function main(): Promise<void> {
  const fixturesRoot = path.join(__dirname, "..", "fixtures", "real-tutors");
  for (let i = 0; i < TUTORS.length; i++) {
    const dir = path.join(fixturesRoot, `tutor-${i + 1}`);
    for (const f of ["cni-front.jpg", "cni-back.jpg", "selfie.jpg", "non-conviction.pdf", "degree.pdf"]) {
      if (!fs.existsSync(path.join(dir, f))) {
        throw new Error(
          `Missing fixture ${dir}/${f} — run the photo download step and ` +
            `'ts-node k6/support/generate-real-tutor-pdfs.ts' first.`
        );
      }
    }
  }

  const password = await argon2.hash(KYC_REAL_PASSWORD);

  const tutorRole = await prisma.role.findFirst({ where: { name: "Tutor" } });
  if (!tutorRole) throw new Error("Tutor role not seeded — run the app once to seed roles first.");

  let centre = await prisma.region.findFirst({ where: { name: "Centre" } });
  if (!centre) centre = await prisma.region.create({ data: { name: "Centre" } });
  let littoral = await prisma.region.findFirst({ where: { name: "Littoral" } });
  if (!littoral) littoral = await prisma.region.create({ data: { name: "Littoral" } });

  async function ensureCity(name: string, regionId: string) {
    let city = await prisma.city.findFirst({ where: { name, regionId } });
    if (!city) city = await prisma.city.create({ data: { name, regionId, isInAllowlist: true } });
    return city;
  }
  const yaounde = await ensureCity("Yaoundé", centre.id);
  const bafia = await ensureCity("Bafia", centre.id);
  const douala = await ensureCity("Douala", littoral.id);
  const citiesByName: Record<string, typeof yaounde> = { "Yaoundé": yaounde, Bafia: bafia, Douala: douala };

  let subjectDomain = await prisma.subjectDomain.findFirst();
  if (!subjectDomain) subjectDomain = await prisma.subjectDomain.create({ data: { name: "Sciences" } });
  let subject = await prisma.subject.findFirst({ where: { domainId: subjectDomain.id } });
  if (!subject) subject = await prisma.subject.create({ data: { name: "Mathematics", domainId: subjectDomain.id } });

  const seeded: Array<{
    email: string;
    firstName: string;
    lastName: string;
    tutorProfileId: string;
    userId: string;
    cniNumber: string;
    cityId: string;
    cityName: string;
    regionId: string;
    subjectId: string;
    fixtureDir: string;
  }> = [];

  for (let i = 0; i < TUTORS.length; i++) {
    const { firstName, lastName, city: cityName } = TUTORS[i];
    const city = citiesByName[cityName];
    const email = `${EMAIL_PREFIX}.${i + 1}@mentora.test`;
    const cniNumber = `8${String(200000 + i).padStart(8, "0")}`.slice(0, 9);

    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password,
          isEmailVerified: true,
          firstName,
          lastName,
          phoneNumber: `+2377${String(20000000 + i).padStart(8, "0")}`,
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
            bio: `Seeded real-file tutor #${i + 1} for k6 KYC storage-adapter testing.`,
            teachingMode: "BOTH",
            cityId: city.id,
            minRateXaf: 3000,
            maxRateXaf: 6000,
            profilePictureUrl: "profile-photos/seed-placeholder.jpg",
          },
        });

    // Reset KYC state so every run starts clean and idempotent.
    await prisma.kycRejectionFlag.deleteMany({ where: { kycApplication: { tutorProfileId: tutorProfile.id } } });
    await prisma.kycChecklistSubmission.deleteMany({ where: { kycApplication: { tutorProfileId: tutorProfile.id } } });
    await prisma.kycStatusHistory.deleteMany({ where: { tutorProfileId: tutorProfile.id } });
    await prisma.kycApplication.deleteMany({ where: { tutorProfileId: tutorProfile.id } });
    await prisma.credentialSubjectLink.deleteMany({ where: { credential: { tutorProfileId: tutorProfile.id } } });
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
      firstName,
      lastName,
      tutorProfileId: tutorProfile.id,
      userId: user.id,
      cniNumber,
      cityId: city.id,
      cityName: city.name,
      regionId: city.regionId,
      subjectId: subject.id,
      fixtureDir: `tutor-${i + 1}`,
    });
  }

  fs.writeFileSync(
    path.join(fixturesRoot, "..", "kyc-real-tutors-seed.json"),
    JSON.stringify({ password: KYC_REAL_PASSWORD, tutors: seeded }, null, 2)
  );

  console.log(JSON.stringify({ event: "kyc_real_tutors_seeded", count: seeded.length }));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Real-tutor KYC seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
