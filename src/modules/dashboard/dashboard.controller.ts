import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { DashboardService } from "./dashboard.service";

export const dashboardController = {
  getMine: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const fresh = req.query.fresh === "true";
    const dashboard = await DashboardService.getForUser(ctx.userId!, { fresh });
    appResponder(StatusCodes.OK, dashboard as object, res);
  }),
};

export default dashboardController;
