import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { DisputeService } from "./dispute.service";
import { permissions } from "../../data/permission.data";

// Same permission that already gates the admin "list all disputes" endpoint —
// anyone who can list every dispute should also be able to open any one of
// them by id, not just the three parties (opener/booker/tutor) to it.
const isAdminDisputeReader = (res: Response): boolean =>
  (res.locals.user?.permissions ?? []).includes(permissions.disputes.readAll);

export const disputeController = {
  open: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const dispute = await DisputeService.openDispute(ctx.userId!, req.params.bookingId, req.body, ctx);
    appResponder(StatusCodes.CREATED, { dispute }, res);
  }),

  respond: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const dispute = await DisputeService.respondToDispute(
      ctx.userId!,
      req.params.id,
      req.body.statement,
      req.body.evidenceFileIds,
      ctx
    );
    appResponder(StatusCodes.OK, { dispute }, res);
  }),

  resolve: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const dispute = await DisputeService.resolveDispute(
      ctx.userId!,
      req.params.id,
      req.body.resolution,
      req.body.reason,
      ctx
    );
    appResponder(StatusCodes.OK, { dispute }, res);
  }),

  getOne: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const dispute = await DisputeService.getDisputeForUser(req.params.id, ctx.userId!, isAdminDisputeReader(res));
    appResponder(StatusCodes.OK, { dispute }, res);
  }),

  getForBooking: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const dispute = await DisputeService.getDisputeForBooking(
      req.params.bookingId,
      ctx.userId!,
      isAdminDisputeReader(res)
    );
    appResponder(StatusCodes.OK, { dispute }, res);
  }),

  getEvidence: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const snapshot = await DisputeService.getEvidenceSnapshot(req.params.id);
    appResponder(StatusCodes.OK, { snapshot }, res);
  }),

  listAdmin: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await DisputeService.listAdminDisputes(req.query as any);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),
};

export default disputeController;
