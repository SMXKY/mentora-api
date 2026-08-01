/**
 * Seeds a handful of fully-searchable tutors (ACTIVE KYC, verified intro
 * video, APPROVED subject+levels, varying compositeScore) plus one
 * "orphan" subject with zero approved tutors — so
 * k6/tutor-search-flow.test.js can exercise filtering, ranking order, and
 * the "no tutors for this subject yet" zero-result fallback without
 * waiting on the nightly score-recompute job.
 *
 * Run automatically by `npm run test:k6:tutor-search`. Idempotent.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import argon2 from "argon2";
import prisma from "../../src/config/database.config";

export const TUTOR_SEARCH_PASSWORD = "K6TutorSearchTest#12345";
const TUTOR_COUNT = 5;

async function main(): Promise<void> {
  const password = await argon2.hash(TUTOR_SEARCH_PASSWORD);

  const tutorRole = await prisma.role.findFirst({ where: { name: "Tutor" } });
  if (!tutorRole) throw new Error("Tutor role not seeded — run the app once to seed roles first.");

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
  let subject = await prisma.subject.findFirst({
    where: { domainId: subjectDomain.id, name: "Mathematics" },
  });
  if (!subject) {
    subject = await prisma.subject.create({
      data: { name: "Mathematics", domainId: subjectDomain.id },
    });
  }

  // An orphan subject nobody has ever claimed — backs the
  // no_tutors_for_subject zero-result fallback assertion.
  const orphanSubject = await prisma.subject.upsert({
    where: { name_domainId: { name: "K6 Orphan Subject", domainId: subjectDomain.id } },
    create: { name: "K6 Orphan Subject", domainId: subjectDomain.id },
    update: {},
  });

  let level = await prisma.level.findFirst({ where: { name: "Form 5" } });
  if (!level) {
    level = await prisma.level.create({
      data: { name: "Form 5", schoolType: "SECONDARY", orderIndex: 5 },
    });
  }

  const tutors: { email: string; tutorProfileId: string; compositeScore: number }[] = [];

  for (let i = 0; i < TUTOR_COUNT; i++) {
    const email = `k6.search.tutor${i}@mentora.test`;
    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password,
          isEmailVerified: true,
          firstName: `SearchTutor${i}`,
          lastName: "Tester",
          phoneNumber: `+23760102040${i}`,
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

    const compositeScore = 90 - i * 10; // descending, so ranking order is verifiable
    const existing = await prisma.tutorProfile.findFirst({ where: { userId: user.id } });
    const tutorProfile = existing
      ? await prisma.tutorProfile.update({
          where: { id: existing.id },
          data: {
            bio: `Experienced mathematics tutor #${i} for k6 search testing.`,
            teachingMode: "BOTH",
            cityId: city.id,
            minRateXaf: 3000 + i * 500,
            maxRateXaf: 6000 + i * 500,
            kycStatus: "ACTIVE",
            kycApprovedAt: new Date(),
            introVideoVerified: true,
            compositeScore,
            deletedAt: null,
          },
        })
      : await prisma.tutorProfile.create({
          data: {
            userId: user.id,
            bio: `Experienced mathematics tutor #${i} for k6 search testing.`,
            teachingMode: "BOTH",
            cityId: city.id,
            minRateXaf: 3000 + i * 500,
            maxRateXaf: 6000 + i * 500,
            kycStatus: "ACTIVE",
            kycApprovedAt: new Date(),
            introVideoVerified: true,
            compositeScore,
          },
        });

    const tutorSubject = await prisma.tutorSubject.upsert({
      where: { tutorProfileId_subjectId: { tutorProfileId: tutorProfile.id, subjectId: subject.id } },
      create: {
        tutorProfileId: tutorProfile.id,
        subjectId: subject.id,
        status: "APPROVED",
        approvedAt: new Date(),
        isOpenForBooking: true,
      },
      update: { status: "APPROVED", approvedAt: new Date(), isOpenForBooking: true },
    });

    await prisma.tutorSubjectLevel.upsert({
      where: {
        tutorSubjectId_levelId: { tutorSubjectId: tutorSubject.id, levelId: level.id },
      },
      create: { tutorSubjectId: tutorSubject.id, levelId: level.id },
      update: {},
    });

    tutors.push({ email, tutorProfileId: tutorProfile.id, compositeScore });
  }

  const fixturesDir = path.join(__dirname, "..", "fixtures");
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.writeFileSync(
    path.join(fixturesDir, "tutor-search-seed.json"),
    JSON.stringify({
      cityId: city.id,
      subjectId: subject.id,
      levelId: level.id,
      orphanSubjectId: orphanSubject.id,
      tutors,
    })
  );

  console.log(
    JSON.stringify({ event: "tutor_search_fixtures_seeded", count: tutors.length })
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
