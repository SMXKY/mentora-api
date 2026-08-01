/**
 * Seeds everything k6/booking-payment-flow.test.js needs to walk the full
 * Module 11/13/16 happy path + a dispute path without going through the
 * multi-step KYC wizard: two ACTIVE, intro-video-verified tutors (one per
 * flow, so each flow's HOME check-in — which only opens within 15 minutes
 * of the real scheduled time — never collides with the other flow's booked
 * slot on the same tutor's calendar) each with an approved subject/level +
 * rates and wide-open recurring availability, plus a parent with a student
 * profile. Writes the end state directly via Prisma, the same way the
 * KYC/materials/tutor-search k6 seeds do.
 *
 * Run automatically by `npm run test:k6:booking`. Idempotent.
 */
import "dotenv/config";
import argon2 from "argon2";
import fs from "fs";
import path from "path";
import prisma from "../../src/config/database.config";

export const TUTOR_EMAIL = "k6.booking.tutor@mentora.test";
export const TUTOR2_EMAIL = "k6.booking.tutor2@mentora.test";
export const PARENT_EMAIL = "k6.booking.parent@mentora.test";
export const TEST_PASSWORD = "K6BookingFlowTest#12345";

// Fapshi's documented sandbox test numbers — deterministic mock outcomes.
export const MOMO_SUCCESS_PHONE = "670000000";
export const MOMO_FAILURE_PHONE = "670000001";

async function main(): Promise<void> {
  const password = await argon2.hash(TEST_PASSWORD);

  const tutorRole = await prisma.role.findFirst({ where: { name: "Tutor" } });
  const parentRole = await prisma.role.findFirst({ where: { name: "Parent" } });
  if (!tutorRole || !parentRole) throw new Error("Tutor/Parent roles not seeded — run the app once first.");

  async function upsertUser(email: string, firstName: string) {
    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password,
          isEmailVerified: true,
          firstName,
          lastName: "K6Test",
          phoneNumber: `+2376${Math.floor(10000000 + Math.random() * 8999999)}`,
          status: "ACTIVE",
          isAccountComplete: true,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { password, deletedAt: null, status: "ACTIVE", isAccountComplete: true },
      });
    }
    return user;
  }

  let region = await prisma.region.findFirst();
  if (!region) region = await prisma.region.create({ data: { name: "Centre" } });
  let city = await prisma.city.findFirst({ where: { regionId: region.id } });
  if (!city) city = await prisma.city.create({ data: { name: "Yaoundé", regionId: region.id, isInAllowlist: true } });

  let subjectDomain = await prisma.subjectDomain.findFirst();
  if (!subjectDomain) subjectDomain = await prisma.subjectDomain.create({ data: { name: "Sciences" } });
  let subject = await prisma.subject.findFirst({ where: { domainId: subjectDomain.id } });
  if (!subject) subject = await prisma.subject.create({ data: { name: "Mathematics", domainId: subjectDomain.id } });

  let level = await prisma.level.findFirst({ where: { name: "Form 5" } });
  if (!level) level = await prisma.level.create({ data: { name: "Form 5", schoolType: "SECONDARY", orderIndex: 5 } });

  async function setupTutor(email: string, label: string) {
    const tutorUser = await upsertUser(email, label);
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: tutorUser.id, roleId: tutorRole!.id } },
      create: { userId: tutorUser.id, roleId: tutorRole!.id, createdById: tutorUser.id, isActive: true },
      update: { isActive: true },
    });

    const existingProfile = await prisma.tutorProfile.findFirst({ where: { userId: tutorUser.id } });
    const tutorProfile = existingProfile
      ? await prisma.tutorProfile.update({
          where: { id: existingProfile.id },
          data: {
            teachingMode: "BOTH",
            kycStatus: "ACTIVE",
            kycApprovedAt: new Date(),
            introVideoVerified: true,
            isPaymentOverdue: false,
            deletedAt: null,
          },
        })
      : await prisma.tutorProfile.create({
          data: {
            userId: tutorUser.id,
            bio: `Seeded tutor (${label}) for k6 booking/payment/dispute flow testing.`,
            teachingMode: "BOTH",
            cityId: city!.id,
            kycStatus: "ACTIVE",
            kycApprovedAt: new Date(),
            introVideoVerified: true,
          },
        });

    const tutorSubject = await prisma.tutorSubject.upsert({
      where: { tutorProfileId_subjectId: { tutorProfileId: tutorProfile.id, subjectId: subject!.id } },
      create: {
        tutorProfileId: tutorProfile.id,
        subjectId: subject!.id,
        status: "APPROVED",
        isOpenForBooking: true,
        ratePerOnlineSessionXaf: 5000,
        ratePerHomeSessionXaf: 8000,
      },
      update: {
        status: "APPROVED",
        isOpenForBooking: true,
        ratePerOnlineSessionXaf: 5000,
        ratePerHomeSessionXaf: 8000,
      },
    });

    await prisma.tutorSubjectLevel.upsert({
      where: { tutorSubjectId_levelId: { tutorSubjectId: tutorSubject.id, levelId: level!.id } },
      create: { tutorSubjectId: tutorSubject.id, levelId: level!.id },
      update: {},
    });

    // Wide-open recurring availability every day of the week so the test
    // doesn't have to compute which weekday a future date falls on.
    await prisma.availabilitySlot.deleteMany({ where: { tutorProfileId: tutorProfile.id } });
    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
    for (const dayOfWeek of days) {
      await prisma.availabilitySlot.create({
        data: {
          tutorProfileId: tutorProfile.id,
          slotType: "RECURRING",
          dayOfWeek,
          startTime: new Date(Date.UTC(1970, 0, 1, 0, 0, 0)),
          endTime: new Date(Date.UTC(1970, 0, 1, 23, 59, 0)),
          bufferMinutes: 0,
        },
      });
    }

    await prisma.wallet.upsert({
      where: { userId: tutorUser.id },
      create: { userId: tutorUser.id, walletType: "TUTOR", balanceXaf: 0 },
      update: {},
    });

    // Soft-delete bookings from a previous run so each run starts fresh —
    // hard-deleting would violate RESTRICT foreign keys from escrow holds,
    // ledger entries, disputes, etc. that a completed flow leaves behind.
    await prisma.booking.updateMany({
      where: { tutorProfileId: tutorProfile.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return tutorProfile;
  }

  const tutorProfile = await setupTutor(TUTOR_EMAIL, "K6Tutor");
  const tutorProfile2 = await setupTutor(TUTOR2_EMAIL, "K6Tutor2");

  const parentUser = await upsertUser(PARENT_EMAIL, "K6Parent");
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: parentUser.id, roleId: parentRole.id } },
    create: { userId: parentUser.id, roleId: parentRole.id, createdById: parentUser.id, isActive: true },
    update: { isActive: true },
  });

  const existingStudent = await prisma.studentProfile.findFirst({ where: { guardianId: parentUser.id } });
  const studentProfile =
    existingStudent ??
    (await prisma.studentProfile.create({
      data: { guardianId: parentUser.id, firstName: "K6Student", levelId: level.id },
    }));

  await prisma.wallet.upsert({
    where: { userId: parentUser.id },
    create: { userId: parentUser.id, walletType: "PARENT", balanceXaf: 0 },
    update: { balanceXaf: 0 },
  });

  const fixturesDir = path.join(__dirname, "..", "fixtures");
  fs.mkdirSync(fixturesDir, { recursive: true });
  fs.writeFileSync(
    path.join(fixturesDir, "booking-seed.json"),
    JSON.stringify({
      tutorEmail: TUTOR_EMAIL,
      tutor2Email: TUTOR2_EMAIL,
      parentEmail: PARENT_EMAIL,
      tutorProfileId: tutorProfile.id,
      tutorProfileId2: tutorProfile2.id,
      studentProfileId: studentProfile.id,
      subjectId: subject.id,
      levelId: level.id,
      momoSuccessPhone: MOMO_SUCCESS_PHONE,
      momoFailurePhone: MOMO_FAILURE_PHONE,
    })
  );

  console.log(
    JSON.stringify({
      event: "booking_test_fixtures_seeded",
      tutorProfileId: tutorProfile.id,
      tutorProfileId2: tutorProfile2.id,
      studentProfileId: studentProfile.id,
    })
  );
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
