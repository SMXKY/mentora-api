import { Router } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { materialsController } from "./materials.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import checkAccountCompletion from "../../middlewares/checkAccountCompletion.middleware";
import checkKyc from "../../middlewares/checkKyc.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";
import {
  CollectionCreateSchema,
  CollectionUpdateSchema,
  CollectionListQuerySchema,
  SectionCreateSchema,
  SectionUpdateSchema,
  ReorderSchema,
  MaterialCreateSchema,
  WrittenNoteCreateSchema,
  MaterialUpdateSchema,
  WrittenNoteContentUpdateSchema,
  LessonPlanCreateSchema,
  LessonPlanUpdateSchema,
  LessonPlanTopicCreateSchema,
  LessonPlanTopicUpdateSchema,
} from "./materials.types";

const meRouter = Router();

const CollectionIdParams = z.object({
  collectionId: z.string().uuid("common/errors:validation.invalidFormat"),
});
const SectionParams = CollectionIdParams.extend({
  sectionId: z.string().uuid("common/errors:validation.invalidFormat"),
});
const MaterialParams = CollectionIdParams.extend({
  materialId: z.string().uuid("common/errors:validation.invalidFormat"),
});
const TopicParams = CollectionIdParams.extend({
  topicId: z.string().uuid("common/errors:validation.invalidFormat"),
});

// Largest allowed material is a 500MB lesson video (see materials.service's
// MATERIAL_UPLOAD_POLICY) — multer's ceiling is intentionally generous;
// MediaService re-validates the precise per-category cap server-side.
function makeUpload(maxSizeMB: number) {
  return multer({
    storage: multer.diskStorage({
      destination: os.tmpdir(),
      filename: (_req, file, cb) =>
        cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: maxSizeMB * 1024 * 1024, files: 1 },
  });
}
const materialUpload = makeUpload(500);

// Every route in this module requires: a valid session, a fully complete
// profile, and an ACTIVE (approved) KYC application — in that order.
meRouter.use(protect, checkAccountCompletion, checkKyc);

// ── Collections ────────────────────────────────────────────
meRouter.post(
  "/collections",
  restrictTo(permissions.materials.collectionsCreate),
  validate(CollectionCreateSchema),
  materialsController.createCollection
);

meRouter.get(
  "/collections",
  restrictTo(permissions.materials.collectionsRead),
  validate(CollectionListQuerySchema, "query"),
  materialsController.listCollections
);

meRouter.patch(
  "/collections/reorder",
  restrictTo(permissions.materials.collectionsUpdate),
  validate(ReorderSchema),
  materialsController.reorderCollections
);

meRouter.get(
  "/collections/:collectionId",
  restrictTo(permissions.materials.collectionsRead),
  validate(CollectionIdParams, "params"),
  materialsController.getCollection
);

meRouter.patch(
  "/collections/:collectionId",
  restrictTo(permissions.materials.collectionsUpdate),
  validate(CollectionIdParams, "params"),
  validate(CollectionUpdateSchema),
  materialsController.updateCollection
);

meRouter.delete(
  "/collections/:collectionId",
  restrictTo(permissions.materials.collectionsDelete),
  validate(CollectionIdParams, "params"),
  materialsController.deleteCollection
);

meRouter.get(
  "/collections/:collectionId/stats",
  restrictTo(permissions.materials.collectionsRead),
  validate(CollectionIdParams, "params"),
  materialsController.getCollectionStats
);

// ── Sections ───────────────────────────────────────────────
meRouter.post(
  "/collections/:collectionId/sections",
  restrictTo(permissions.materials.collectionsCreate),
  validate(CollectionIdParams, "params"),
  validate(SectionCreateSchema),
  materialsController.createSection
);

meRouter.patch(
  "/collections/:collectionId/sections/reorder",
  restrictTo(permissions.materials.collectionsUpdate),
  validate(CollectionIdParams, "params"),
  validate(ReorderSchema),
  materialsController.reorderSections
);

meRouter.patch(
  "/collections/:collectionId/sections/:sectionId",
  restrictTo(permissions.materials.collectionsUpdate),
  validate(SectionParams, "params"),
  validate(SectionUpdateSchema),
  materialsController.updateSection
);

meRouter.delete(
  "/collections/:collectionId/sections/:sectionId",
  restrictTo(permissions.materials.collectionsDelete),
  validate(SectionParams, "params"),
  materialsController.deleteSection
);

// ── Materials ──────────────────────────────────────────────
meRouter.post(
  "/collections/:collectionId/materials",
  restrictTo(permissions.materials.collectionsCreate),
  validate(CollectionIdParams, "params"),
  materialUpload.single("file"),
  validate(MaterialCreateSchema),
  materialsController.createMaterial
);

meRouter.post(
  "/collections/:collectionId/materials/written-note",
  restrictTo(permissions.materials.collectionsCreate),
  validate(CollectionIdParams, "params"),
  validate(WrittenNoteCreateSchema),
  materialsController.createWrittenNote
);

meRouter.patch(
  "/collections/:collectionId/materials/reorder",
  restrictTo(permissions.materials.collectionsUpdate),
  validate(CollectionIdParams, "params"),
  validate(ReorderSchema),
  materialsController.reorderMaterials
);

meRouter.patch(
  "/collections/:collectionId/materials/:materialId/content",
  restrictTo(permissions.materials.collectionsUpdate),
  validate(MaterialParams, "params"),
  validate(WrittenNoteContentUpdateSchema),
  materialsController.updateWrittenNoteContent
);

meRouter.post(
  "/collections/:collectionId/materials/:materialId/replace-file",
  restrictTo(permissions.materials.collectionsUpdate),
  validate(MaterialParams, "params"),
  materialUpload.single("file"),
  materialsController.replaceMaterialFile
);

meRouter.patch(
  "/collections/:collectionId/materials/:materialId",
  restrictTo(permissions.materials.collectionsUpdate),
  validate(MaterialParams, "params"),
  validate(MaterialUpdateSchema),
  materialsController.updateMaterial
);

meRouter.delete(
  "/collections/:collectionId/materials/:materialId",
  restrictTo(permissions.materials.collectionsDelete),
  validate(MaterialParams, "params"),
  materialsController.deleteMaterial
);

// ── Lesson Plans ───────────────────────────────────────────
meRouter.post(
  "/collections/:collectionId/lesson-plan",
  restrictTo(permissions.materials.collectionsCreate),
  validate(CollectionIdParams, "params"),
  validate(LessonPlanCreateSchema),
  materialsController.createLessonPlan
);

meRouter.get(
  "/collections/:collectionId/lesson-plan",
  restrictTo(permissions.materials.collectionsRead),
  validate(CollectionIdParams, "params"),
  materialsController.getLessonPlan
);

meRouter.patch(
  "/collections/:collectionId/lesson-plan",
  restrictTo(permissions.materials.collectionsUpdate),
  validate(CollectionIdParams, "params"),
  validate(LessonPlanUpdateSchema),
  materialsController.updateLessonPlan
);

meRouter.post(
  "/collections/:collectionId/lesson-plan/topics",
  restrictTo(permissions.materials.collectionsCreate),
  validate(CollectionIdParams, "params"),
  validate(LessonPlanTopicCreateSchema),
  materialsController.createLessonPlanTopic
);

meRouter.patch(
  "/collections/:collectionId/lesson-plan/topics/reorder",
  restrictTo(permissions.materials.collectionsUpdate),
  validate(CollectionIdParams, "params"),
  validate(ReorderSchema),
  materialsController.reorderLessonPlanTopics
);

meRouter.patch(
  "/collections/:collectionId/lesson-plan/topics/:topicId",
  restrictTo(permissions.materials.collectionsUpdate),
  validate(TopicParams, "params"),
  validate(LessonPlanTopicUpdateSchema),
  materialsController.updateLessonPlanTopic
);

meRouter.delete(
  "/collections/:collectionId/lesson-plan/topics/:topicId",
  restrictTo(permissions.materials.collectionsDelete),
  validate(TopicParams, "params"),
  materialsController.deleteLessonPlanTopic
);

// ── Storage ────────────────────────────────────────────────
meRouter.get(
  "/storage",
  restrictTo(permissions.materials.collectionsRead),
  materialsController.getStorageUsage
);

const router = Router();
router.use("/me", meRouter);

export default router;
