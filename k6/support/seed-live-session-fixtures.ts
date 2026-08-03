/**
 * Seeds a real, ONLINE, PAID 1-on-1 booking for the live-session test
 * harness (tools/live-session-harness/run.ts) — tutor + parent/student
 * fixtures follow the exact same pattern as seed-booking-fixtures.ts.
 *
 * The booking is written directly to PAID via Prisma rather than driven
 * through the real payment gateway sandbox — this harness proves the LIVE
 * SESSION pipeline (room creation, token issuance/access-control, webhook
 * state updates, media flow), which reads booking.status as its source of
 * truth regardless of how that status was reached; it does not re-exercise
 * the payment integration, which is out of this audit's scope. No
 * booking/payment *code* is touched — only fixture data, same as the
 * existing k6 seeds.
 *
 * Idempotent — safe to run repeatedly. Writes k6/fixtures/live-session-seed.json.
 */
import "dotenv/config";
import argon2 from "argon2";
import fs from "fs";
import path from "path";
import prisma from "../../src/config/database.config";
import { sessionStartAt, sessionEndAt, minutesToDbTime } from "../../src/modules/availability/availability.logic";

export const TUTOR_EMAIL = "harness.livesession.tutor@mentora.test";
export const STUDENT_EMAIL = "harness.livesession.student@mentora.test";
export const TEST_PASSWORD = "HarnessLiveSession#12345";

const WAT_OFFSET_HOURS = 1;
const START_IN_MINUTES = 5; // must fall inside ROOM_CREATE_WINDOW_MINUTES (15) in roomLifecycle.processor.ts
const DURATION_MINUTES = 30;

async function main(): Promise<void> {
  const password = await argon2.hash(TEST_PASSWORD);

  const tutorRole = await prisma.role.findFirst({ where: { name: "Tutor" } });
  const studentRole = await prisma.role.findFirst({ where: { name: "Student" } });
  if (!tutorRole || !studentRole) throw new Error("Tutor/Student roles not seeded — run the app once first.");

  async function upsertUser(email: string, firstName: string) {
    let user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          password,
          isEmailVerified: true,
          firstName,
          lastName: "HarnessTest",
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

  const tutorUser = await upsertUser(TUTOR_EMAIL, "HarnessTutor");
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: tutorUser.id, roleId: tutorRole.id } },
    create: { userId: tutorUser.id, roleId: tutorRole.id, createdById: tutorUser.id, isActive: true },
    update: { isActive: true },
  });

  // minRateXaf/maxRateXaf + profilePictureUrl are required for
  // account-completion (accountCompletion.service.ts's "pricing"/"photo"
  // items) — the LiveSession screen is wrapped in withCompletionGuard on
  // the frontend, so an incomplete profile silently renders a lock screen
  // instead of the session.
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
          minRateXaf: 5000,
          maxRateXaf: 5000,
          profilePictureUrl: "harness/seeded-tutor-photo.jpg",
        },
      })
    : await prisma.tutorProfile.create({
        data: {
          userId: tutorUser.id,
          bio: "Seeded tutor for the live-session test harness.",
          teachingMode: "BOTH",
          cityId: city.id,
          kycStatus: "ACTIVE",
          kycApprovedAt: new Date(),
          introVideoVerified: true,
          minRateXaf: 5000,
          maxRateXaf: 5000,
          profilePictureUrl: "harness/seeded-tutor-photo.jpg",
        },
      });

  const tutorSubject = await prisma.tutorSubject.upsert({
    where: { tutorProfileId_subjectId: { tutorProfileId: tutorProfile.id, subjectId: subject.id } },
    create: {
      tutorProfileId: tutorProfile.id,
      subjectId: subject.id,
      status: "APPROVED",
      isOpenForBooking: true,
      ratePerOnlineSessionXaf: 5000,
    },
    update: { status: "APPROVED", isOpenForBooking: true, ratePerOnlineSessionXaf: 5000 },
  });
  await prisma.tutorSubjectLevel.upsert({
    where: { tutorSubjectId_levelId: { tutorSubjectId: tutorSubject.id, levelId: level.id } },
    create: { tutorSubjectId: tutorSubject.id, levelId: level.id },
    update: {},
  });

  const studentUser = await upsertUser(STUDENT_EMAIL, "HarnessStudent");
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: studentUser.id, roleId: studentRole.id } },
    create: { userId: studentUser.id, roleId: studentRole.id, createdById: studentUser.id, isActive: true },
    update: { isActive: true },
  });
  const existingStudentProfile = await prisma.studentProfile.findFirst({ where: { userId: studentUser.id } });
  const studentProfile =
    existingStudentProfile ??
    (await prisma.studentProfile.create({
      data: { userId: studentUser.id, firstName: "HarnessStudent", levelId: level.id },
    }));
  // Required for account-completion's "subject_of_interest" item (Student role).
  await prisma.studentProfileSubject.upsert({
    where: { studentProfileId_subjectId: { studentProfileId: studentProfile.id, subjectId: subject.id } },
    create: { studentProfileId: studentProfile.id, subjectId: subject.id },
    update: {},
  });

  // Wall-clock (WAT) start/end for the booking — see availability.logic.ts's
  // watWallClockToInstant for why this isn't a plain setUTCHours().
  const targetStartInstant = new Date(Date.now() + START_IN_MINUTES * 60 * 1000);
  const watInstant = new Date(targetStartInstant.getTime() + WAT_OFFSET_HOURS * 3600 * 1000);
  const sessionDate = new Date(Date.UTC(watInstant.getUTCFullYear(), watInstant.getUTCMonth(), watInstant.getUTCDate()));
  const startMinutes = watInstant.getUTCHours() * 60 + watInstant.getUTCMinutes();
  const sessionStartTime = minutesToDbTime(startMinutes);
  const sessionEndTime = minutesToDbTime(startMinutes + DURATION_MINUTES);

  // Fresh booking every run — previous harness runs are soft-deleted, never
  // hard-deleted (would violate RESTRICT FKs from LiveRoom/escrow/etc).
  await prisma.booking.updateMany({
    where: { tutorProfileId: tutorProfile.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  const booking = await prisma.booking.create({
    data: {
      bookerId: studentUser.id,
      studentProfileId: studentProfile.id,
      tutorProfileId: tutorProfile.id,
      subjectId: subject.id,
      levelId: level.id,
      sessionType: "ONLINE",
      durationMinutes: DURATION_MINUTES,
      sessionDate,
      sessionStartTime,
      sessionEndTime,
      status: "PAID",
      agreedRateXaf: 5000,
    },
  });

  const fixturesDir = path.join(__dirname, "..", "fixtures");
  fs.mkdirSync(fixturesDir, { recursive: true });
  const out = {
    tutorEmail: TUTOR_EMAIL,
    studentEmail: STUDENT_EMAIL,
    password: TEST_PASSWORD,
    bookingId: booking.id,
    scheduledStartAt: sessionStartAt(booking).toISOString(),
    scheduledEndAt: sessionEndAt(booking).toISOString(),
  };
  fs.writeFileSync(path.join(fixturesDir, "live-session-seed.json"), JSON.stringify(out, null, 2));

  console.log(JSON.stringify({ event: "live_session_harness_fixtures_seeded", ...out }));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
