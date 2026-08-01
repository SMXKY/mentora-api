import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { AvailabilityService } from "./availability.service";

export const availabilityController = {
  listMine: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const slots = await AvailabilityService.listMySlots(ctx.userId!);
    appResponder(StatusCodes.OK, { slots }, res);
  }),

  create: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const slot = await AvailabilityService.createSlot(ctx.userId!, req.body);
    appResponder(StatusCodes.CREATED, { slot }, res);
  }),

  update: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const slot = await AvailabilityService.updateSlot(ctx.userId!, req.params.id, req.body);
    appResponder(StatusCodes.OK, { slot }, res);
  }),

  remove: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await AvailabilityService.deleteSlot(ctx.userId!, req.params.id);
    appResponder(StatusCodes.NO_CONTENT, {}, res);
  }),

  getWindowsForTutor: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const windows = await AvailabilityService.getAvailableWindows(
      req.params.tutorProfileId,
      req.query.date as string
    );
    appResponder(StatusCodes.OK, { windows }, res);
  }),
};

export default availabilityController;
