import {
  computeCompositeScore,
  isNewTutorBoostEligible,
  applyNewTutorBoost,
  CompositeScoreSignals,
} from "./compositeScore";
import { RankingWeightsInput, NewTutorBoostConfigInput } from "../../modules/tutorSearch/tutorSearch.types";

const weights: RankingWeightsInput = {
  subjectMatch: 25,
  availability: 25,
  bayesianRating: 20,
  responseRate: 10,
  profileCompleteness: 10,
  proximity: 5,
  activityRecency: 5,
};

const zeroSignals: CompositeScoreSignals = {
  subjectMatch: 0,
  availability: 0,
  bayesianRatingStars: 0,
  responseRate: 0,
  profileCompleteness: 0,
  proximity: 0,
  activityRecency: 0,
};

describe("computeCompositeScore — one signal at a time", () => {
  it("is 0 when every signal is at its floor", () => {
    expect(computeCompositeScore(zeroSignals, weights)).toBe(0);
  });

  it("subjectMatch at 100 contributes exactly its weight (25)", () => {
    const score = computeCompositeScore({ ...zeroSignals, subjectMatch: 100 }, weights);
    expect(score).toBe(25);
  });

  it("availability at 100 contributes exactly its weight (25)", () => {
    const score = computeCompositeScore({ ...zeroSignals, availability: 100 }, weights);
    expect(score).toBe(25);
  });

  it("a perfect 5-star bayesian rating contributes exactly its weight (20)", () => {
    const score = computeCompositeScore({ ...zeroSignals, bayesianRatingStars: 5 }, weights);
    expect(score).toBe(20);
  });

  it("a 2.5-star bayesian rating contributes half its weight (10)", () => {
    const score = computeCompositeScore({ ...zeroSignals, bayesianRatingStars: 2.5 }, weights);
    expect(score).toBe(10);
  });

  it("responseRate at 100 contributes exactly its weight (10)", () => {
    const score = computeCompositeScore({ ...zeroSignals, responseRate: 100 }, weights);
    expect(score).toBe(10);
  });

  it("profileCompleteness at 100 contributes exactly its weight (10)", () => {
    const score = computeCompositeScore({ ...zeroSignals, profileCompleteness: 100 }, weights);
    expect(score).toBe(10);
  });

  it("proximity at 100 contributes exactly its weight (5)", () => {
    const score = computeCompositeScore({ ...zeroSignals, proximity: 100 }, weights);
    expect(score).toBe(5);
  });

  it("activityRecency at 100 contributes exactly its weight (5)", () => {
    const score = computeCompositeScore({ ...zeroSignals, activityRecency: 100 }, weights);
    expect(score).toBe(5);
  });

  it("every signal maxed out sums to 100 (weights sum to 100)", () => {
    const allMax: CompositeScoreSignals = {
      subjectMatch: 100,
      availability: 100,
      bayesianRatingStars: 5,
      responseRate: 100,
      profileCompleteness: 100,
      proximity: 100,
      activityRecency: 100,
    };
    expect(computeCompositeScore(allMax, weights)).toBe(100);
  });

  it("a changed weight changes the resulting score for the same signals", () => {
    const heavierSubjectMatch: RankingWeightsInput = { ...weights, subjectMatch: 50 };
    const score = computeCompositeScore({ ...zeroSignals, subjectMatch: 100 }, heavierSubjectMatch);
    expect(score).toBe(50);
  });
});

describe("isNewTutorBoostEligible", () => {
  it("is false when newTutorBoostExpiresAt is null", () => {
    expect(isNewTutorBoostEligible(null, 0)).toBe(false);
  });

  it("is false once the expiry date has passed (30-day rule)", () => {
    const expired = new Date(Date.now() - 1000);
    expect(isNewTutorBoostEligible(expired, 0)).toBe(false);
  });

  it("is false once 5 sessions are completed, even if still within 30 days", () => {
    const stillActive = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    expect(isNewTutorBoostEligible(stillActive, 5)).toBe(false);
  });

  it("is true within the window and under 5 completed sessions", () => {
    const stillActive = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    expect(isNewTutorBoostEligible(stillActive, 4)).toBe(true);
  });
});

describe("applyNewTutorBoost", () => {
  const boostConfig: NewTutorBoostConfigInput = {
    boostPoints: 50,
    boostDurationDays: 30,
    boostMaxSessions: 5,
  };

  it("leaves the score unchanged when not eligible", () => {
    expect(applyNewTutorBoost(10, false, boostConfig)).toBe(10);
  });

  it("adds boostPoints to the base score when eligible", () => {
    expect(applyNewTutorBoost(10, true, boostConfig)).toBe(60);
  });
});
