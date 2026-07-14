import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { MaterialsAdminService } from "./materialsAdmin.service";

export const materialsAdminController = {
  getDownloadPolicy: catchAsync(async (_req: Request, res: Response) => {
    const policy = await MaterialsAdminService.getDownloadPolicy();
    appResponder(StatusCodes.OK, policy, res);
  }),

  updateDownloadPolicy: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const policy = await MaterialsAdminService.updateDownloadPolicy(ctx, req.body);
    appResponder(StatusCodes.OK, policy, res);
  }),

  removeMaterial: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    await MaterialsAdminService.removeMaterial(req.params.materialId, ctx, req.body);
    appResponder(StatusCodes.OK, { removed: true }, res);
  }),

  suspendCollection: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    await MaterialsAdminService.suspendCollection(
      req.params.collectionId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.OK, { suspended: true }, res);
  }),

  getModerationHistory: catchAsync(async (req: Request, res: Response) => {
    const history = await MaterialsAdminService.getModerationHistory(
      req.params.tutorId
    );
    appResponder(StatusCodes.OK, history, res);
  }),

  getMaterialVersionHistory: catchAsync(async (req: Request, res: Response) => {
    const versions = await MaterialsAdminService.getMaterialVersionHistory(
      req.params.materialId
    );
    appResponder(StatusCodes.OK, versions, res);
  }),
};

export default materialsAdminController;
