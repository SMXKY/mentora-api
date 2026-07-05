import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { KycAdminService } from "./kycAdmin.service";

export const kycAdminController = {
  getQueue: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await KycAdminService.getQueue();
    appResponder(StatusCodes.OK, result, res);
  }),

  getApplicationDetail: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await KycAdminService.getApplicationDetail(req.params.id, ctx.userId!);
    appResponder(StatusCodes.OK, result, res);
  }),

  approveIdentity: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await KycAdminService.approveIdentity(
      req.params.id,
      ctx.userId!,
      req.body.checklist,
      ctx
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  rejectApplication: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await KycAdminService.rejectApplication(
      req.params.id,
      ctx.userId!,
      req.body,
      ctx
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  banTutor: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await KycAdminService.banTutor(req.params.tutorProfileId, req.body.reason, ctx);
    appResponder(StatusCodes.OK, { banned: true }, res);
  }),

  suspendTutor: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await KycAdminService.suspendTutor(req.params.tutorProfileId, req.body.reason, ctx);
    appResponder(StatusCodes.OK, { suspended: true }, res);
  }),

  unsuspendTutor: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await KycAdminService.unsuspendTutor(req.params.tutorProfileId, ctx);
    appResponder(StatusCodes.OK, { unsuspended: true }, res);
  }),

  getSubjectQueue: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await KycAdminService.getSubjectQueue();
    appResponder(StatusCodes.OK, result, res);
  }),

  approveSubject: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await KycAdminService.approveSubject(
      req.params.tutorSubjectId,
      ctx.userId!,
      req.body,
      ctx
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  rejectSubject: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await KycAdminService.rejectSubject(
      req.params.tutorSubjectId,
      ctx.userId!,
      req.body.reason,
      ctx
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  reviewCredential: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await KycAdminService.reviewCredential(
      req.params.credentialId,
      ctx.userId!,
      req.body,
      ctx
    );
    appResponder(StatusCodes.OK, result, res);
  }),

  getSpotCheckQueue: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await KycAdminService.getSpotCheckQueue();
    appResponder(StatusCodes.OK, result, res);
  }),

  submitSpotCheckVerdict: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await KycAdminService.submitSpotCheckVerdict(
      req.params.kycStatusHistoryId,
      ctx.userId!,
      req.body,
      ctx
    );
    appResponder(StatusCodes.OK, { recorded: true }, res);
  }),

  getAdminStats: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await KycAdminService.getAdminStats(req.params.adminId);
    appResponder(StatusCodes.OK, result, res);
  }),

  getSlaConfig: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await KycAdminService.getSlaConfig();
    appResponder(StatusCodes.OK, result, res);
  }),

  updateSlaConfig: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await KycAdminService.updateSlaConfig(req.body, ctx);
    appResponder(StatusCodes.OK, result, res);
  }),
};

export default kycAdminController;
