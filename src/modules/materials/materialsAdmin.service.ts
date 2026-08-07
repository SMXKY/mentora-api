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
  AdminCollectionSearchQuery,
  AdminMaterialSearchQuery,
} from "./materials.types";

interface AdminPaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

function paginationMeta(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit) || 1;
  return { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
}

const TUTOR_INFO_SELECT = {
  id: true,
  profilePictureUrl: true,
  user: { select: { firstName: true, lastName: true } },
} as const;

function toTutorInfo(tutorProfile: {
  id: string;
  profilePictureUrl: string | null;
  user: { firstName: string | null; lastName: string | null };
}) {
  return {
    tutorProfileId: tutorProfile.id,
    name: [tutorProfile.user.firstName, tutorProfile.user.lastName].filter(Boolean).join(" "),
    profilePictureUrl: tutorProfile.profilePictureUrl,
  };
}

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

// ── Cross-tutor search (Epic 5) ─────────────────────────────────
async function searchCollections(
  query: AdminCollectionSearchQuery
): Promise<AdminPaginatedResult<any>> {
  const { page, limit, search, tutorProfileId, subjectId, levelId, isPublished, isFreePreview, sortBy, sortOrder } = query;

  const where: Record<string, any> = { deletedAt: null };
  if (tutorProfileId) where.tutorProfileId = tutorProfileId;
  if (subjectId) where.subjectId = subjectId;
  if (levelId) where.levelId = levelId;
  if (isPublished !== undefined) where.isPublished = isPublished;
  if (isFreePreview !== undefined) where.isFreePreview = isFreePreview;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  // "tutorName" isn't a real column — sort on the joined User's first name.
  const orderBy =
    sortBy === "tutorName"
      ? { tutorProfile: { user: { firstName: sortOrder } } }
      : { [sortBy]: sortOrder };

  const [rows, total] = await Promise.all([
    prisma.collection.findMany({
      where,
      include: {
        tutorProfile: { select: TUTOR_INFO_SELECT },
        subject: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.collection.count({ where }),
  ]);

  return {
    data: rows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      subject: c.subject,
      level: c.level,
      isPublished: c.isPublished,
      isFreePreview: c.isFreePreview,
      createdAt: c.createdAt,
      tutor: toTutorInfo(c.tutorProfile),
    })),
    meta: paginationMeta(total, page, limit),
  };
}

async function searchMaterials(
  query: AdminMaterialSearchQuery
): Promise<AdminPaginatedResult<any>> {
  const { page, limit, search, collectionId, tutorProfileId, materialType, isFreePreview, sortBy, sortOrder } = query;

  const where: Record<string, any> = { deletedAt: null };
  if (collectionId) where.collectionId = collectionId;
  if (tutorProfileId) where.collection = { tutorProfileId };
  if (materialType) where.materialType = materialType;
  if (isFreePreview !== undefined) where.isFreePreview = isFreePreview;
  if (search) where.name = { contains: search, mode: "insensitive" };

  const [rows, total] = await Promise.all([
    prisma.material.findMany({
      where,
      include: {
        collection: {
          select: { id: true, name: true, tutorProfile: { select: TUTOR_INFO_SELECT } },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.material.count({ where }),
  ]);

  return {
    data: rows.map((m) => ({
      id: m.id,
      name: m.name,
      materialType: m.materialType,
      isFreePreview: m.isFreePreview,
      createdAt: m.createdAt,
      collection: { id: m.collection.id, name: m.collection.name },
      tutor: toTutorInfo(m.collection.tutorProfile),
    })),
    meta: paginationMeta(total, page, limit),
  };
}

export const MaterialsAdminService = {
  getDownloadPolicy,
  updateDownloadPolicy,
  removeMaterial,
  suspendCollection,
  getModerationHistory,
  getMaterialVersionHistory,
  searchCollections,
  searchMaterials,
};

export default MaterialsAdminService;
