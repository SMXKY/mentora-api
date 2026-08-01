import { RankingWeightsInput, NewTutorBoostConfigInput } from "../../modules/tutorSearch/tutorSearch.types";

export interface CompositeScoreSignals {
  /** 0-100 — average confidenceScore across the tutor's APPROVED subjects. */
  subjectMatch: number;
  /** 0-100 — has an active recurring or near-term slot. */
  availability: number;
  /** 0-5 star scale, from TutorRatingSnapshot.bayesianRating. */
  bayesianRatingStars: number;
  /** 0-100, TutorProfile.responseRate (null treated as 0 — unproven yet). */
  responseRate: number;
  /** 0-100 — fraction of profile-completeness criteria met. */
  profileCompleteness: number;
  /**
   * 0-100. Proximity is inherently searcher-relative (distance from THIS
   * search's location), but compositeScore is precomputed once per tutor,
   * independent of any particular search — recalculated on a background
   * job, never at query time, per spec. A single global number can't
   * capture "close to this searcher," so this signal is deliberately
   * neutral (full credit) here; the 5% weight it carries is a scoping
   * trade-off documented at the call site, not a bug.
   */
  proximity: number;
  /** 0-100 — 100 if User.lastLoggedInAt is within 30 days, else 0. */
  activityRecency: number;
}

/** Bayesian formula from the spec: (C*m + sum(r)) / (C+n), expressed via
 * the already-blended bayesianRating stored on TutorRatingSnapshot rather
 * than re-deriving it from raw reviews (that's TutorRatingSnapshot's own
 * recompute concern, triggered on review submission). */
function normalizeBayesianRatingToPercent(stars: number): number {
  return Math.max(0, Math.min(100, (stars / 5) * 100));
}

export function computeCompositeScore(
  signals: CompositeScoreSignals,
  weights: RankingWeightsInput
): number {
  const weighted =
    weights.subjectMatch * (signals.subjectMatch / 100) +
    weights.availability * (signals.availability / 100) +
    weights.bayesianRating * (normalizeBayesianRatingToPercent(signals.bayesianRatingStars) / 100) +
    weights.responseRate * (signals.responseRate / 100) +
    weights.profileCompleteness * (signals.profileCompleteness / 100) +
    weights.proximity * (signals.proximity / 100) +
    weights.activityRecency * (signals.activityRecency / 100);

  return Math.round(weighted * 100) / 100;
}

export function isNewTutorBoostEligible(
  newTutorBoostExpiresAt: Date | null,
  completedSessionsCount: number
): boolean {
  return (
    !!newTutorBoostExpiresAt &&
    newTutorBoostExpiresAt.getTime() > Date.now() &&
    completedSessionsCount < 5
  );
}

export function applyNewTutorBoost(
  baseScore: number,
  eligible: boolean,
  boostConfig: NewTutorBoostConfigInput
): number {
  if (!eligible) return baseScore;
  return Math.round((baseScore + boostConfig.boostPoints) * 100) / 100;
}
