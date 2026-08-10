import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { AnalyticsService } from "./analytics.service";

export const analyticsController = {
  getMine: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const { range } = req.query as any;
    const analytics = await AnalyticsService.getTutorAnalytics(ctx.userId!, range);
    appResponder(StatusCodes.OK, analytics as object, res);
  }),

  listSessions: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const { range, cursor, limit } = req.query as any;
    const result = await AnalyticsService.listAnalyticsSessions(ctx.userId!, range, cursor, limit);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),
};

export default analyticsController;
