import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { TutorSearchService } from "./tutorSearch.service";
import {
  getRankingWeights,
  updateRankingWeights,
  getBayesianConfig,
  updateBayesianConfig,
  getNewTutorBoostConfig,
  updateNewTutorBoostConfig,
} from "../../services/search/searchConfig";

export const tutorSearchController = {
  searchTutors: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    // Neither User nor StudentProfile carries a city today — there is no
    // signal to resolve a searcher's default city from yet. Featured
    // tutors (no query/filters) fall back to the global top composite
    // score until a city is added to one of those models; an explicit
    // ?cityId filter always works regardless.
    const result: any = await TutorSearchService.searchTutors(req.query as any, {
      userId: ctx.userId,
      searcherCityId: null,
    });
    // appResponder's envelope is strictly { success, data, meta } — the
    // zero-result fallback object rides inside meta rather than being
    // dropped on the floor.
    appResponder(
      StatusCodes.OK,
      result.data,
      res,
      result.fallback ? { ...result.meta, fallback: result.fallback } : result.meta
    );
  }),

  notifyMe: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await TutorSearchService.submitNotifyMe(req.body, ctx.userId);
    appResponder(StatusCodes.CREATED, result, res);
  }),

  recordEvent: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await TutorSearchService.recordSearchEvent(req.body, ctx.userId);
    appResponder(StatusCodes.CREATED, { recorded: true }, res);
  }),

  getRankingConfig: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const [weights, bayesian, newTutorBoost] = await Promise.all([
      getRankingWeights(),
      getBayesianConfig(),
      getNewTutorBoostConfig(),
    ]);
    appResponder(StatusCodes.OK, { weights, bayesian, newTutorBoost }, res);
  }),

  updateRankingWeights: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await updateRankingWeights(req.body, ctx);
    appResponder(StatusCodes.OK, result, res);
  }),

  updateBayesianConfig: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await updateBayesianConfig(req.body, ctx);
    appResponder(StatusCodes.OK, result, res);
  }),

  updateNewTutorBoostConfig: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await updateNewTutorBoostConfig(req.body, ctx);
    appResponder(StatusCodes.OK, result, res);
  }),

  getCtrByPosition: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await TutorSearchService.getCtrByPosition(
      req.query.windowDays ? Number(req.query.windowDays) : undefined
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  getDeadEndQueries: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await TutorSearchService.getDeadEndQueries(
      req.query.windowDays ? Number(req.query.windowDays) : undefined
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  getDemandSignals: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await TutorSearchService.getDemandSignals();
    appResponder(StatusCodes.OK, result, res);
  }),
};

export default tutorSearchController;
