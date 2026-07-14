import { Request, Response } from "express";
import fs from "fs";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { MEDIA_ERROR_KEYS } from "../../services/media/media.types";
import { MaterialsService } from "./materials.service";

function requireFile(req: Request): Express.Multer.File {
  if (!req.file) {
    throw new AppError(MEDIA_ERROR_KEYS.noFileProvided, StatusCodes.BAD_REQUEST);
  }
  return req.file;
}

async function cleanupTemp(file?: Express.Multer.File): Promise<void> {
  if (!file) return;
  await fs.promises.unlink(file.path).catch(() => undefined);
}

export const materialsController = {
  // ── Collections ──────────────────────────────────────────
  createCollection: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const collection = await MaterialsService.createCollection(
      res.locals.tutorProfileId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.CREATED, collection, res);
  }),

  listCollections: catchAsync(async (req: Request, res: Response) => {
    const result = await MaterialsService.listCollections(
      res.locals.tutorProfileId,
      req.query as any
    );
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  getCollection: catchAsync(async (req: Request, res: Response) => {
    const collection = await MaterialsService.getCollection(
      res.locals.tutorProfileId,
      req.params.collectionId
    );
    appResponder(StatusCodes.OK, collection ?? {}, res);
  }),

  updateCollection: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const collection = await MaterialsService.updateCollection(
      res.locals.tutorProfileId,
      req.params.collectionId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.OK, collection, res);
  }),

  deleteCollection: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    await MaterialsService.deleteCollection(
      res.locals.tutorProfileId,
      req.params.collectionId,
      ctx
    );
    appResponder(StatusCodes.OK, { deleted: true }, res);
  }),

  reorderCollections: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    await MaterialsService.reorderCollections(
      res.locals.tutorProfileId,
      ctx,
      req.body.orderedIds
    );
    appResponder(StatusCodes.OK, { reordered: true }, res);
  }),

  getCollectionStats: catchAsync(async (req: Request, res: Response) => {
    const stats = await MaterialsService.getCollectionStats(
      res.locals.tutorProfileId,
      req.params.collectionId
    );
    appResponder(StatusCodes.OK, stats, res);
  }),

  // ── Sections ─────────────────────────────────────────────
  createSection: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const section = await MaterialsService.createSection(
      res.locals.tutorProfileId,
      req.params.collectionId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.CREATED, section, res);
  }),

  updateSection: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const section = await MaterialsService.updateSection(
      res.locals.tutorProfileId,
      req.params.collectionId,
      req.params.sectionId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.OK, section, res);
  }),

  deleteSection: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    await MaterialsService.deleteSection(
      res.locals.tutorProfileId,
      req.params.collectionId,
      req.params.sectionId,
      ctx
    );
    appResponder(StatusCodes.OK, { deleted: true }, res);
  }),

  reorderSections: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    await MaterialsService.reorderSections(
      res.locals.tutorProfileId,
      req.params.collectionId,
      ctx,
      req.body.orderedIds
    );
    appResponder(StatusCodes.OK, { reordered: true }, res);
  }),

  // ── Materials ────────────────────────────────────────────
  createMaterial: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const file = requireFile(req);
    try {
      const material = await MaterialsService.createMaterial(
        res.locals.tutorProfileId,
        req.params.collectionId,
        ctx,
        req.body,
        { tempFilePath: file.path, originalFileName: file.originalname }
      );
      appResponder(StatusCodes.CREATED, material, res);
    } finally {
      await cleanupTemp(file);
    }
  }),

  createWrittenNote: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const material = await MaterialsService.createWrittenNote(
      res.locals.tutorProfileId,
      req.params.collectionId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.CREATED, material, res);
  }),

  updateMaterial: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const material = await MaterialsService.updateMaterial(
      res.locals.tutorProfileId,
      req.params.collectionId,
      req.params.materialId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.OK, material, res);
  }),

  updateWrittenNoteContent: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const material = await MaterialsService.updateWrittenNoteContent(
      res.locals.tutorProfileId,
      req.params.collectionId,
      req.params.materialId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.OK, material, res);
  }),

  replaceMaterialFile: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const file = requireFile(req);
    try {
      const result = await MaterialsService.replaceMaterialFile(
        res.locals.tutorProfileId,
        req.params.collectionId,
        req.params.materialId,
        ctx,
        { tempFilePath: file.path, originalFileName: file.originalname }
      );
      appResponder(StatusCodes.OK, result, res);
    } finally {
      await cleanupTemp(file);
    }
  }),

  deleteMaterial: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    await MaterialsService.deleteMaterial(
      res.locals.tutorProfileId,
      req.params.collectionId,
      req.params.materialId,
      ctx
    );
    appResponder(StatusCodes.OK, { deleted: true }, res);
  }),

  reorderMaterials: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    await MaterialsService.reorderMaterials(
      res.locals.tutorProfileId,
      req.params.collectionId,
      ctx,
      req.body.orderedIds
    );
    appResponder(StatusCodes.OK, { reordered: true }, res);
  }),

  // ── Lesson Plans ─────────────────────────────────────────
  createLessonPlan: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const lessonPlan = await MaterialsService.createLessonPlan(
      res.locals.tutorProfileId,
      req.params.collectionId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.CREATED, lessonPlan, res);
  }),

  getLessonPlan: catchAsync(async (req: Request, res: Response) => {
    const lessonPlan = await MaterialsService.getLessonPlan(
      res.locals.tutorProfileId,
      req.params.collectionId
    );
    appResponder(StatusCodes.OK, lessonPlan, res);
  }),

  updateLessonPlan: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const lessonPlan = await MaterialsService.updateLessonPlan(
      res.locals.tutorProfileId,
      req.params.collectionId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.OK, lessonPlan, res);
  }),

  createLessonPlanTopic: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const topic = await MaterialsService.createLessonPlanTopic(
      res.locals.tutorProfileId,
      req.params.collectionId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.CREATED, topic, res);
  }),

  updateLessonPlanTopic: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const topic = await MaterialsService.updateLessonPlanTopic(
      res.locals.tutorProfileId,
      req.params.collectionId,
      req.params.topicId,
      ctx,
      req.body
    );
    appResponder(StatusCodes.OK, topic, res);
  }),

  deleteLessonPlanTopic: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    await MaterialsService.deleteLessonPlanTopic(
      res.locals.tutorProfileId,
      req.params.collectionId,
      req.params.topicId,
      ctx
    );
    appResponder(StatusCodes.OK, { deleted: true }, res);
  }),

  reorderLessonPlanTopics: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    await MaterialsService.reorderLessonPlanTopics(
      res.locals.tutorProfileId,
      req.params.collectionId,
      ctx,
      req.body.orderedIds
    );
    appResponder(StatusCodes.OK, { reordered: true }, res);
  }),

  // ── Storage ──────────────────────────────────────────────
  getStorageUsage: catchAsync(async (req: Request, res: Response) => {
    const ctx = buildContext(req, res);
    const usage = await MaterialsService.getStorageUsage(ctx.userId!);
    appResponder(StatusCodes.OK, usage, res);
  }),
};

export default materialsController;
