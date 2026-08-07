import { Router } from "express";
import { z } from "zod";
import { materialsAdminController } from "./materialsAdmin.controller";
import { validate } from "../../middlewares/validate.middleware";
import protect from "../../middlewares/protect.middleware";
import restrictTo from "../../middlewares/restrictTo.middleware";
import { permissions } from "../../data/permission.data";
import {
  DownloadPolicyUpdateSchema,
  ModerationRemoveSchema,
  CollectionSuspendSchema,
  AdminCollectionSearchQuerySchema,
  AdminMaterialSearchQuerySchema,
} from "./materials.types";

const router = Router();

const MaterialIdParams = z.object({
  materialId: z.string().uuid("common/errors:validation.invalidFormat"),
});
const CollectionIdParams = z.object({
  collectionId: z.string().uuid("common/errors:validation.invalidFormat"),
});
const TutorIdParams = z.object({
  tutorId: z.string().uuid("common/errors:validation.invalidFormat"),
});

// Admin-side — no KYC/account-completion gate. Standard permission checks only.
router.use(protect);

router.get(
  "/download-policy",
  restrictTo(permissions.platform.configRead),
  materialsAdminController.getDownloadPolicy
);

router.put(
  "/download-policy",
  restrictTo(permissions.platform.configUpdate),
  validate(DownloadPolicyUpdateSchema),
  materialsAdminController.updateDownloadPolicy
);

router.post(
  "/materials/:materialId/remove",
  restrictTo(permissions.materials.moderationRemove),
  validate(MaterialIdParams, "params"),
  validate(ModerationRemoveSchema),
  materialsAdminController.removeMaterial
);

router.get(
  "/materials/:materialId/versions",
  restrictTo(permissions.materials.moderationRead),
  validate(MaterialIdParams, "params"),
  materialsAdminController.getMaterialVersionHistory
);

router.post(
  "/collections/:collectionId/suspend",
  restrictTo(permissions.materials.moderationRemove),
  validate(CollectionIdParams, "params"),
  validate(CollectionSuspendSchema),
  materialsAdminController.suspendCollection
);

router.get(
  "/tutors/:tutorId/moderation-history",
  restrictTo(permissions.materials.moderationRead),
  validate(TutorIdParams, "params"),
  materialsAdminController.getModerationHistory
);

// ── Cross-tutor search (Epic 5) — browse/search every tutor's
// collections and materials platform-wide, not one tutor at a time.
router.get(
  "/collections",
  restrictTo(permissions.materials.moderationRead),
  validate(AdminCollectionSearchQuerySchema, "query"),
  materialsAdminController.searchCollections
);

router.get(
  "/materials",
  restrictTo(permissions.materials.moderationRead),
  validate(AdminMaterialSearchQuerySchema, "query"),
  materialsAdminController.searchMaterials
);

export default router;
