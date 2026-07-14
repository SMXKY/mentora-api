import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  ConfigCategory,
  MaterialReviewDecision,
  NotificationType,
  NotificationResourceType,
  LogOperation,
  LogCategory,
} from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import { AuditService } from "../../utils/logUserActivity.util";
import NotificationService from "../../services/notification/notification.service";
import {
  DownloadPolicyUpdateInput,
  DownloadPolicyResponse,
  ModerationRemoveInput,
  CollectionSuspendInput,
} from "./materials.types";

const DOWNLOAD_POLICY_CONFIG_KEY = "materials.download_policy";
const DEFAULT_DOWNLOAD_POLICY: DownloadPolicyResponse = {
  VIDEO: true,
  AUDIO: true,
  DOCUMENT: true,
  IMAGE: true,
};

// ── Downloadability toggle (PlatformConfig-backed, no schema needed) ──
async function getDownloadPolicy(): Promise<DownloadPolicyResponse> {
  const row = await prisma.platformConfig.findUnique({
    where: { key: DOWNLOAD_POLICY_CONFIG_KEY },
  });
  if (!row) return { ...DEFAULT_DOWNLOAD_POLICY };
  return { ...DEFAULT_DOWNLOAD_POLICY, ...(row.value as Partial<DownloadPolicyResponse>) };
}

async function updateDownloadPolicy(
  ctx: ServiceContext,
  input: DownloadPolicyUpdateInput
): Promise<DownloadPolicyResponse> {
  const current = await getDownloadPolicy();
  const next: DownloadPolicyResponse = { ...current, ...input };

  await prisma.platformConfig.upsert({
    where: { key: DOWNLOAD_POLICY_CONFIG_KEY },
    create: {
      key: DOWNLOAD_POLICY_CONFIG_KEY,
      value: next,
      category: ConfigCategory.MEDIA,
      description:
        "Per-content-type downloadability for tutor Learning Materials (Module 8.5). Written notes are never downloadable — not part of this toggle.",
      defaultValue: DEFAULT_DOWNLOAD_POLICY,
      updatedById: ctx.userId!,
    },
    update: { value: next, updatedById: ctx.userId! },
  });

  AuditService.record(ctx, "platform_configs", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: DOWNLOAD_POLICY_CONFIG_KEY,
    previousState: current,
    newState: next,
  });

  return next;
}

// ── Moderation ─────────────────────────────────────────────────
async function findMaterialWithTutorOrThrow(materialId: string) {
  const material = await prisma.material.findFirst({
    where: { id: materialId, deletedAt: null },
    include: {
      collection: {
        include: { tutorProfile: { select: { userId: true } } },
      },
    },
  });
  if (!material) {
    throw new AppError(
      "materials/errors:materialNotFound",
      StatusCodes.NOT_FOUND
    );
  }
  return material;
}

async function findCollectionWithTutorOrThrow(collectionId: string) {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, deletedAt: null },
    include: { tutorProfile: { select: { userId: true } } },
  });
  if (!collection) {
    throw new AppError(
      "materials/errors:collectionNotFound",
      StatusCodes.NOT_FOUND
    );
  }
  return collection;
}

async function removeMaterial(
  materialId: string,
  ctx: ServiceContext,
  input: ModerationRemoveInput
) {
  const material = await findMaterialWithTutorOrThrow(materialId);
  const tutorUserId = material.collection.tutorProfile.userId;

  await prisma.$transaction([
    prisma.material.update({
      where: { id: materialId },
      data: { deletedAt: new Date() },
    }),
    prisma.materialReview.create({
      data: {
        collectionId: material.collectionId,
        materialId,
        reviewedById: ctx.userId!,
        tutorId: tutorUserId,
        decision: MaterialReviewDecision.REMOVED,
        reviewNote: input.reviewNote,
        removalReason: input.reasonCode,
      },
    }),
  ]);

  await NotificationService.send({
    type: NotificationType.MATERIAL_REMOVED,
    target: { kind: "user", userId: tutorUserId },
    resourceType: NotificationResourceType.MATERIAL,
    resourceId: materialId,
    data: { reasonCode: input.reasonCode, materialName: material.name },
  }).catch(() => {});

  AuditService.record(ctx, "materials", {
    operation: LogOperation.DELETE,
    category: LogCategory.WRITE,
    recordId: materialId,
    eventType: "materials.moderation_removed",
    newState: { reasonCode: input.reasonCode },
  });
}

async function suspendCollection(
  collectionId: string,
  ctx: ServiceContext,
  input: CollectionSuspendInput
) {
  const collection = await findCollectionWithTutorOrThrow(collectionId);
  const tutorUserId = collection.tutorProfile.userId;

  await prisma.$transaction([
    prisma.collection.update({
      where: { id: collectionId },
      data: { isPublished: false },
    }),
    prisma.materialReview.create({
      data: {
        collectionId,
        reviewedById: ctx.userId!,
        tutorId: tutorUserId,
        decision: MaterialReviewDecision.SUSPENDED,
        reviewNote: input.reviewNote,
        removalReason: input.reasonCode,
      },
    }),
  ]);

  // No dedicated "collection suspended" notification type is registered
  // yet (only MATERIAL_REMOVED / MATERIAL_ACCESS_GRANTED exist) — the
  // tutor still sees the collection go unpublished immediately and the
  // reason is visible in their moderation history. Register a
  // COLLECTION_SUSPENDED notification type in a follow-up if a push/email
  // alert on suspend is required.

  AuditService.record(ctx, "collections", {
    operation: LogOperation.SUSPEND,
    category: LogCategory.WRITE,
    recordId: collectionId,
    eventType: "collections.moderation_suspended",
    newState: { reasonCode: input.reasonCode },
  });
}

/** tutorUserId is User.id — MaterialReview.tutorId points at User, not TutorProfile. */
async function getModerationHistory(tutorUserId: string) {
  return prisma.materialReview.findMany({
    where: { tutorId: tutorUserId },
    orderBy: { createdAt: "desc" },
    include: {
      collection: { select: { id: true, name: true } },
      material: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

/**
 * Written-note edit history for dispute recovery — reconstructed from
 * AuditLog rather than a dedicated version table (see materials.service.ts
 * updateWrittenNoteContent for where these entries are written).
 */
async function getMaterialVersionHistory(materialId: string) {
  await findMaterialWithTutorOrThrow(materialId);

  return prisma.auditLog.findMany({
    where: { tableName: "materials", targetId: materialId, operation: LogOperation.UPDATE },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      actorId: true,
      actorEmail: true,
      previousState: true,
      newState: true,
      changedFields: true,
      createdAt: true,
    },
  });
}

export const MaterialsAdminService = {
  getDownloadPolicy,
  updateDownloadPolicy,
  removeMaterial,
  suspendCollection,
  getModerationHistory,
  getMaterialVersionHistory,
};

export default MaterialsAdminService;
