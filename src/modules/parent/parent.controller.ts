import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { ParentService } from "./parent.service";

export const parentController = {
  listMyStudents: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const students = await ParentService.listMyStudents(ctx.userId!);
    appResponder(StatusCodes.OK, students, res);
  }),

  createStudent: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const student = await ParentService.createManagedStudent(ctx.userId!, req.body);
    appResponder(StatusCodes.CREATED, student, res);
  }),

  updateStudent: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const student = await ParentService.updateManagedStudent(
      ctx.userId!,
      req.params.id,
      req.body
    );
    appResponder(StatusCodes.OK, student, res);
  }),

  removeStudent: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await ParentService.removeManagedStudent(ctx.userId!, req.params.id);
    appResponder(StatusCodes.OK, { removed: true }, res);
  }),
};

export default parentController;
