import prisma from "../../config/database.config";
import { ConfigCategory } from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import {
  RankingWeightsInput,
  BayesianConfigInput,
  NewTutorBoostConfigInput,
} from "../../modules/tutorSearch/tutorSearch.types";

const RANKING_WEIGHTS_KEY = "search.ranking_weights";
const BAYESIAN_CONFIG_KEY = "search.bayesian_config";
const NEW_TUTOR_BOOST_KEY = "search.new_tutor_boost";

// Sums to 100 — mirrors the weighting table in the search spec exactly.
export const DEFAULT_RANKING_WEIGHTS: RankingWeightsInput = {
  subjectMatch: 25,
  availability: 25,
  bayesianRating: 20,
  responseRate: 10,
  profileCompleteness: 10,
  proximity: 5,
  activityRecency: 5,
};

export const DEFAULT_BAYESIAN_CONFIG: BayesianConfigInput = {
  minReviewCount: 5,
};

// boostPoints is added directly to a new tutor's composite score (0-100
// scale) — default chosen to land a typical new tutor around the middle
// of a results page rather than the top or bottom.
export const DEFAULT_NEW_TUTOR_BOOST: NewTutorBoostConfigInput = {
  boostPoints: 50,
  boostDurationDays: 30,
  boostMaxSessions: 5,
};

async function getConfigValue<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.platformConfig.findUnique({ where: { key } });
  if (!row) return fallback;
  return { ...fallback, ...(row.value as Partial<T>) };
}

async function setConfigValue<T extends object>(
  key: string,
  value: T,
  defaultValue: T,
  description: string,
  ctx: ServiceContext
): Promise<T> {
  await prisma.platformConfig.upsert({
    where: { key },
    create: {
      key,
      value: value as any,
      category: ConfigCategory.SEARCH,
      description,
      defaultValue: defaultValue as any,
      updatedById: ctx.userId!,
    },
    update: { value: value as any, updatedById: ctx.userId! },
  });
  return value;
}

export async function getRankingWeights(): Promise<RankingWeightsInput> {
  return getConfigValue(RANKING_WEIGHTS_KEY, DEFAULT_RANKING_WEIGHTS);
}

export async function updateRankingWeights(
  input: RankingWeightsInput,
  ctx: ServiceContext
): Promise<RankingWeightsInput> {
  return setConfigValue(
    RANKING_WEIGHTS_KEY,
    input,
    DEFAULT_RANKING_WEIGHTS,
    "Weighted signals used to compute each tutor's search composite score",
    ctx
  );
}

export async function getBayesianConfig(): Promise<BayesianConfigInput> {
  return getConfigValue(BAYESIAN_CONFIG_KEY, DEFAULT_BAYESIAN_CONFIG);
}

export async function updateBayesianConfig(
  input: BayesianConfigInput,
  ctx: ServiceContext
): Promise<BayesianConfigInput> {
  return setConfigValue(
    BAYESIAN_CONFIG_KEY,
    input,
    DEFAULT_BAYESIAN_CONFIG,
    "Minimum review count threshold (C) for the Bayesian rating formula",
    ctx
  );
}

export async function getNewTutorBoostConfig(): Promise<NewTutorBoostConfigInput> {
  return getConfigValue(NEW_TUTOR_BOOST_KEY, DEFAULT_NEW_TUTOR_BOOST);
}

export async function updateNewTutorBoostConfig(
  input: NewTutorBoostConfigInput,
  ctx: ServiceContext
): Promise<NewTutorBoostConfigInput> {
  return setConfigValue(
    NEW_TUTOR_BOOST_KEY,
    input,
    DEFAULT_NEW_TUTOR_BOOST,
    "New-tutor search score boost — amount, duration, and session cap",
    ctx
  );
}
