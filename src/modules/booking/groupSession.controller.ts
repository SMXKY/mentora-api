import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { GroupSessionService } from "./groupSession.service";
import { withIdempotency } from "../../services/payment/idempotency.util";

export const groupSessionController = {
  create: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await GroupSessionService.createGroupSession(ctx.userId!, req.body, ctx);
    appResponder(StatusCodes.CREATED, result, res);
  }),

  publish: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const groupSession = await GroupSessionService.publishGroupSession(ctx.userId!, req.params.bookingId);
    appResponder(StatusCodes.OK, { groupSession }, res);
  }),

  getOne: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await GroupSessionService.getGroupSession(req.params.bookingId);
    appResponder(StatusCodes.OK, result, res);
  }),

  join: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const participant = await GroupSessionService.joinGroupSession(
      ctx.userId!,
      req.params.bookingId,
      req.body.studentProfileId
    );
    appResponder(StatusCodes.CREATED, { participant }, res);
  }),

  checkoutWithWallet: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const idempotencyKey = req.header("Idempotency-Key");
    const { status, body } = await withIdempotency(ctx.userId!, idempotencyKey, "group.checkout.wallet", async () => {
      const result = await GroupSessionService.walletCheckoutParticipant(ctx.userId!, req.params.bookingId);
      return { status: StatusCodes.OK, body: result };
    });
    appResponder(status, body as object, res);
  }),

  checkoutWithDirectMomo: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const idempotencyKey = req.header("Idempotency-Key");
    const { status, body } = await withIdempotency(ctx.userId!, idempotencyKey, "group.checkout.momo", async () => {
      const result = await GroupSessionService.directMomoCheckoutParticipant(
        ctx.userId!,
        req.params.bookingId,
        req.body.phone
      );
      return { status: StatusCodes.OK, body: result };
    });
    appResponder(status, body as object, res);
  }),
};

export default groupSessionController;
