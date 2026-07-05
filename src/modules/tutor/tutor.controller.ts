import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { TutorService } from "./tutor.service";

export const tutorController = {
  getMe: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const profile = await TutorService.getMyProfile(ctx.userId!);
    appResponder(StatusCodes.OK, { profile }, res);
  }),

  updateMe: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const profile = await TutorService.upsertMyProfile(ctx.userId!, req.body);
    appResponder(StatusCodes.OK, profile as object, res);
  }),

  updateSubjectPricing: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await TutorService.updateSubjectPricing(
      ctx.userId!,
      req.params.subjectId,
      req.body
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  getPublicProfile: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const profile = await TutorService.getPublicProfile(req.params.id);
    appResponder(StatusCodes.OK, profile, res);
  }),
};

export default tutorController;
