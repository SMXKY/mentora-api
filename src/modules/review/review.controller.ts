import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { ReviewService } from "./review.service";

export const reviewController = {
  submit: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const review = await ReviewService.submitReview(ctx.userId!, req.params.bookingId, req.body);
    appResponder(StatusCodes.CREATED, { review }, res);
  }),

  listForTutor: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await ReviewService.listTutorReviewsByProfile(
      req.params.tutorProfileId,
      req.query.cursor as string | undefined,
      Number(req.query.limit) || 20
    );
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  respond: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const review = await ReviewService.respondToReview(ctx.userId!, req.params.id, req.body.response);
    appResponder(StatusCodes.OK, { review }, res);
  }),
};

export default reviewController;
