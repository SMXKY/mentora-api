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
    const { cursor, limit, sort, rating, wouldRebook } = req.query as any;
    const result = await ReviewService.listTutorReviewsByProfile(req.params.tutorProfileId, {
      cursor,
      limit: Number(limit) || 20,
      sort,
      rating: rating !== undefined ? Number(rating) : undefined,
      wouldRebook: wouldRebook !== undefined ? wouldRebook === "true" || wouldRebook === true : undefined,
    });
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  respond: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const review = await ReviewService.respondToReview(ctx.userId!, req.params.id, req.body.response);
    appResponder(StatusCodes.OK, { review }, res);
  }),

  report: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await ReviewService.reportReview(ctx.userId!, req.params.id, req.body.reason, req.body.description, ctx);
    appResponder(StatusCodes.CREATED, result, res);
  }),

  submitIncidentReport: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const incidentReport = await ReviewService.submitIncidentReport(
      ctx.userId!,
      req.params.bookingId,
      req.body.reason,
      req.body.description,
      ctx
    );
    appResponder(StatusCodes.CREATED, { incidentReport }, res);
  }),

  // ── Admin/Moderator ──
  listReviewReports: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { status, cursor, limit } = req.query as any;
    const result = await ReviewService.listReviewReports(status, cursor, Number(limit) || 20);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  reviewReport: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const report = await ReviewService.reviewReportAction(req.params.id, ctx.userId!, req.body.status, req.body.reviewNote, ctx);
    appResponder(StatusCodes.OK, { report }, res);
  }),

  listIncidentReports: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { bookingId, reviewed, cursor, limit } = req.query as any;
    const result = await ReviewService.listIncidentReports(
      bookingId,
      reviewed !== undefined ? reviewed === "true" || reviewed === true : undefined,
      cursor,
      Number(limit) || 20
    );
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  getIncidentReport: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const incidentReport = await ReviewService.getIncidentReportDetail(req.params.id);
    appResponder(StatusCodes.OK, { incidentReport }, res);
  }),

  reviewIncidentReport: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const incidentReport = await ReviewService.reviewIncidentReport(
      req.params.id,
      ctx.userId!,
      req.body.reviewNote,
      req.body.actionTaken,
      ctx
    );
    appResponder(StatusCodes.OK, { incidentReport }, res);
  }),
};

export default reviewController;
