import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { StudentService } from "./student.service";

export const studentController = {
  getMe: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const profile = await StudentService.getMyProfile(ctx.userId!);
    appResponder(StatusCodes.OK, { profile }, res);
  }),

  updateMe: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const profile = await StudentService.upsertMyProfile(ctx.userId!, req.body);
    appResponder(StatusCodes.OK, profile as object, res);
  }),

  addSubject: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await StudentService.addSubjectOfInterest(ctx.userId!, req.body.subjectId);
    appResponder(StatusCodes.CREATED, result, res);
  }),

  removeSubject: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await StudentService.removeSubjectOfInterest(ctx.userId!, req.params.subjectId);
    appResponder(StatusCodes.OK, { removed: true }, res);
  }),
};

export default studentController;
