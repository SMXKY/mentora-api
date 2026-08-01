import { Queue, Worker, Job } from "bullmq";
import prisma from "../../config/database.config";
import { AvailabilitySlotType, ConfigCategory } from "../../generated/prisma";
import {
  computeCompositeScore,
  applyNewTutorBoost,
  isNewTutorBoostEligible,
  CompositeScoreSignals,
} from "./compositeScore";
import { getRankingWeights, getNewTutorBoostConfig } from "./searchConfig";
import { bumpSearchCacheVersion } from "./searchCache";

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
};

const QUEUE_NAME = "search-score-recompute";
const RECOMPUTE_ONE_JOB = "recompute-tutor";
const SWEEP_ALL_JOB = "sweep-all";
const HEARTBEAT_CONFIG_KEY = "search.score_job_heartbeat";

const scoreQueue = new Queue(QUEUE_NAME, { connection });

// Nightly safety net — recomputes every active tutor's score, which also
// naturally re-evaluates new-tutor-boost expiry (the boost is a function
// of newTutorBoostExpiresAt/completedSessionsCount checked fresh on every
// run) with no separate boost-expiry job needed.
scoreQueue
  .add(
    SWEEP_ALL_JOB,
    {},
    { repeat: { pattern: "0 2 * * *" }, removeOnComplete: true, removeOnFail: { count: 200 } }
  )
  .catch((err) => {
    console.error({
      event: "search_score_sweep_schedule_failed",
      error: err instanceof Error ? err.message : String(err),
    });
  });

/** Fire-and-forget from any mutation point whose signal feeds the
 * composite score (KYC status, profile fields, subject approval, intro
 * video verification, availability/rating once those modules exist). */
export async function queueScoreRecompute(tutorProfileId: string): Promise<void> {
  await scoreQueue.add(
    RECOMPUTE_ONE_JOB,
    { tutorProfileId },
    { removeOnComplete: true, removeOnFail: { count: 500 } }
  );
}

async function gatherSignals(tutorProfileId: string): Promise<CompositeScoreSignals | null> {
  const tutor = await prisma.tutorProfile.findUnique({
    where: { id: tutorProfileId },
    select: {
      bio: true,
      profilePictureUrl: true,
      introVideoVerified: true,
      responseRate: true,
      userId: true,
      user: { select: { lastLoggedInAt: true, ratingSnapshot: { select: { bayesianRating: true } } } },
      tutorSubjects: {
        where: { status: "APPROVED" },
        select: { confidenceScore: true },
      },
      availabilitySlots: {
        where: { isActive: true },
        select: { slotType: true, specificDate: true },
      },
      collections: {
        where: { deletedAt: null, isPublished: true },
        select: { lessonPlan: { select: { isPublished: true } } },
      },
    },
  });
  if (!tutor) return null;

  const confidenceScores = tutor.tutorSubjects
    .map((ts) => ts.confidenceScore)
    .filter((c): c is number => c !== null);
  const subjectMatch =
    confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 50;

  const now = Date.now();
  const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;
  const hasNearTermAvailability = tutor.availabilitySlots.some(
    (s) =>
      s.slotType === AvailabilitySlotType.RECURRING ||
      (s.specificDate && s.specificDate.getTime() >= now && s.specificDate.getTime() <= weekFromNow)
  );
  const hasAnyFutureAvailability = tutor.availabilitySlots.some(
    (s) => s.slotType === AvailabilitySlotType.RECURRING || (s.specificDate && s.specificDate.getTime() >= now)
  );
  const availability = hasNearTermAvailability ? 100 : hasAnyFutureAvailability ? 50 : 0;

  const hasPublishedLessonPlan = tutor.collections.some((c) => c.lessonPlan?.isPublished);
  const completenessCriteria = [
    !!tutor.profilePictureUrl,
    tutor.introVideoVerified,
    tutor.bio.trim().length > 0,
    hasPublishedLessonPlan,
    tutor.tutorSubjects.length > 0,
  ];
  const profileCompleteness =
    (completenessCriteria.filter(Boolean).length / completenessCriteria.length) * 100;

  const activityRecency =
    tutor.user.lastLoggedInAt &&
    tutor.user.lastLoggedInAt.getTime() >= now - 30 * 24 * 60 * 60 * 1000
      ? 100
      : 0;

  return {
    subjectMatch,
    availability,
    bayesianRatingStars: tutor.user.ratingSnapshot ? Number(tutor.user.ratingSnapshot.bayesianRating) : 0,
    responseRate: tutor.responseRate ?? 0,
    profileCompleteness,
    proximity: 100,
    activityRecency,
  };
}

export async function recomputeTutorScore(tutorProfileId: string): Promise<void> {
  const signals = await gatherSignals(tutorProfileId);
  if (!signals) return;

  const [weights, boostConfig, profile] = await Promise.all([
    getRankingWeights(),
    getNewTutorBoostConfig(),
    prisma.tutorProfile.findUnique({
      where: { id: tutorProfileId },
      select: { newTutorBoostExpiresAt: true, completedSessionsCount: true, cityId: true },
    }),
  ]);
  if (!profile) return;

  const baseScore = computeCompositeScore(signals, weights);
  const eligible = isNewTutorBoostEligible(profile.newTutorBoostExpiresAt, profile.completedSessionsCount);
  const finalScore = applyNewTutorBoost(baseScore, eligible, boostConfig);

  await prisma.tutorProfile.update({
    where: { id: tutorProfileId },
    data: { compositeScore: finalScore },
  });

  await bumpSearchCacheVersion(profile.cityId);
}

export async function sweepAllActiveTutors(): Promise<{ recomputed: number }> {
  const activeTutors = await prisma.tutorProfile.findMany({
    where: { deletedAt: null, kycStatus: "ACTIVE" },
    select: { id: true },
  });

  for (const tutor of activeTutors) {
    await recomputeTutorScore(tutor.id).catch((err) => {
      console.error({
        event: "search_score_recompute_failed",
        tutorProfileId: tutor.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // Dead man's switch: an admin dashboard (or an external monitor) can
  // alert if this heartbeat hasn't advanced in >24h — no generic
  // alerting service exists in this codebase to hook into directly today.
  const systemActor = await prisma.user.findFirst({
    where: { email: process.env.SUPER_ADMIN_EMAIL },
    select: { id: true },
  });
  if (systemActor) {
    await prisma.platformConfig.upsert({
      where: { key: HEARTBEAT_CONFIG_KEY },
      create: {
        key: HEARTBEAT_CONFIG_KEY,
        value: new Date().toISOString(),
        category: ConfigCategory.SEARCH,
        description: "Last successful completion of the nightly search-score sweep",
        defaultValue: "",
        updatedById: systemActor.id,
      },
      update: { value: new Date().toISOString() },
    });
  }

  return { recomputed: activeTutors.length };
}

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    if (job.name === RECOMPUTE_ONE_JOB) {
      return recomputeTutorScore(job.data.tutorProfileId);
    }
    if (job.name === SWEEP_ALL_JOB) {
      return sweepAllActiveTutors();
    }
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error({ event: "search_score_job_failed", job: job?.name, error: err.message });
});
