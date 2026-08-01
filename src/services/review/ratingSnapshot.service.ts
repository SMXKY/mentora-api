import prisma from "../../config/database.config";
import { ReviewSubjectRole, ReviewStatus } from "../../generated/prisma";
import { getBayesianConfig } from "../search/searchConfig";
import { queueScoreRecompute } from "../search/searchScore.processor";

const DEFAULT_PLATFORM_AVERAGE = 4.0;

/** Bayesian rating: (C*m + sum(r)) / (C+n) — m is the platform-wide average, C the configured minimum-review-count threshold. */
export async function recomputeTutorRatingSnapshot(tutorUserId: string): Promise<void> {
  const reviews = await prisma.review.findMany({
    where: { subjectId: tutorUserId, subjectRole: ReviewSubjectRole.TUTOR, status: ReviewStatus.REVEALED, deletedAt: null },
    select: {
      overallRating: true,
      wouldRebook: true,
      ratingSubjectKnowledge: true,
      ratingCommunication: true,
      ratingPunctuality: true,
    },
  });

  const n = reviews.length;
  const sum = reviews.reduce((acc, r) => acc + r.overallRating, 0);
  const rawAverage = n > 0 ? sum / n : 0;

  const platformAvg = await prisma.review.aggregate({
    where: { subjectRole: ReviewSubjectRole.TUTOR, status: ReviewStatus.REVEALED, deletedAt: null },
    _avg: { overallRating: true },
  });
  const m = platformAvg._avg.overallRating ?? DEFAULT_PLATFORM_AVERAGE;

  const { minReviewCount: C } = await getBayesianConfig();
  const bayesianRating = n > 0 ? (C * m + sum) / (C + n) : 0;

  const wouldRebookCount = reviews.filter((r) => r.wouldRebook).length;
  const wouldRebookPercentage = n > 0 ? Math.round((wouldRebookCount / n) * 100) : null;

  const avg = (field: "ratingSubjectKnowledge" | "ratingCommunication" | "ratingPunctuality") => {
    const values = reviews.map((r) => r[field]).filter((v): v is number => v != null);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };

  const starCounts = [1, 2, 3, 4, 5].map((star) => reviews.filter((r) => r.overallRating === star).length);

  await prisma.tutorRatingSnapshot.upsert({
    where: { tutorId: tutorUserId },
    create: {
      tutorId: tutorUserId,
      bayesianRating,
      rawAverage,
      totalReviewCount: n,
      wouldRebookCount,
      wouldRebookPercentage,
      avgSubjectKnowledge: avg("ratingSubjectKnowledge"),
      avgCommunication: avg("ratingCommunication"),
      avgPunctuality: avg("ratingPunctuality"),
      count1Star: starCounts[0],
      count2Star: starCounts[1],
      count3Star: starCounts[2],
      count4Star: starCounts[3],
      count5Star: starCounts[4],
      platformAvgAtCalculation: m,
    },
    update: {
      bayesianRating,
      rawAverage,
      totalReviewCount: n,
      wouldRebookCount,
      wouldRebookPercentage,
      avgSubjectKnowledge: avg("ratingSubjectKnowledge"),
      avgCommunication: avg("ratingCommunication"),
      avgPunctuality: avg("ratingPunctuality"),
      count1Star: starCounts[0],
      count2Star: starCounts[1],
      count3Star: starCounts[2],
      count4Star: starCounts[3],
      count5Star: starCounts[4],
      lastRecalculatedAt: new Date(),
      platformAvgAtCalculation: m,
    },
  });

  const tutorProfile = await prisma.tutorProfile.findFirst({ where: { userId: tutorUserId }, select: { id: true } });
  if (tutorProfile) await queueScoreRecompute(tutorProfile.id);
}

export const RatingSnapshotService = { recomputeTutorRatingSnapshot };
export default RatingSnapshotService;
