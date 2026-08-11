import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  MaterialType,
  FileCategory,
  FileType,
  DisputeStatus,
  LogOperation,
  LogCategory,
  SubjectVerificationStatus,
} from "../../generated/prisma";
import { MediaService } from "../../services/media/media.service";
import { fileTypes, FileTypeSpec } from "../../services/media/media.types";
import { resolveQuotaLimitBytes } from "../../services/media/media.quota";
import { ServiceContext } from "../../base/base.types";
import { AuditService } from "../../utils/logUserActivity.util";
import {
  CollectionCreateInput,
  CollectionUpdateInput,
  CollectionListQueryInput,
  SectionCreateInput,
  SectionUpdateInput,
  MaterialCreateInput,
  WrittenNoteCreateInput,
  MaterialUpdateInput,
  WrittenNoteContentUpdateInput,
  LessonPlanCreateInput,
  LessonPlanUpdateInput,
  LessonPlanTopicCreateInput,
  LessonPlanTopicUpdateInput,
  TipTapDocSchema,
} from "./materials.types";
import { BookingStatus } from "../../generated/prisma";
import { BookingAccessService } from "../../services/booking/bookingAccess.service";

// Statuses under which a dispute is still "active" for the purposes of
// the "material tied to an active dispute cannot be deleted" rule.
const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = [
  DisputeStatus.OPEN,
  DisputeStatus.AWAITING_ADMIN,
  DisputeStatus.UNDER_REVIEW,
  DisputeStatus.ESCALATED,
];

// Only file-backed material types go through MediaService — WRITTEN_NOTE
// stores contentJson directly on the Material row.
const MATERIAL_UPLOAD_POLICY: Record<
  "VIDEO" | "AUDIO" | "DOCUMENT" | "IMAGE",
  {
    fileCategory: FileCategory;
    fileType: FileType;
    allowedTypes: FileTypeSpec[];
    maxSizeMB: number;
  }
> = {
  DOCUMENT: {
    fileCategory: FileCategory.LESSON_NOTE,
    fileType: FileType.DOCUMENT,
    allowedTypes: [fileTypes.document.pdf],
    maxSizeMB: 20,
  },
  AUDIO: {
    fileCategory: FileCategory.LESSON_AUDIO,
    fileType: FileType.AUDIO,
    allowedTypes: Object.values(fileTypes.audio),
    maxSizeMB: 50,
  },
  VIDEO: {
    fileCategory: FileCategory.LESSON_VIDEO,
    fileType: FileType.VIDEO,
    allowedTypes: Object.values(fileTypes.video),
    maxSizeMB: 500,
  },
  IMAGE: {
    fileCategory: FileCategory.LESSON_IMAGE,
    fileType: FileType.IMAGE,
    allowedTypes: Object.values(fileTypes.image),
    maxSizeMB: 15,
  },
};

interface UploadedFileInput {
  tempFilePath: string;
  originalFileName: string;
}

// ── Ownership helpers ────────────────────────────────────────
async function assertCollectionOwnership(
  tutorProfileId: string,
  collectionId: string
) {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, tutorProfileId, deletedAt: null },
  });
  if (!collection) {
    throw new AppError(
      "materials/errors:collectionNotFound",
      StatusCodes.NOT_FOUND
    );
  }
  return collection;
}

async function assertSectionOwnership(collectionId: string, sectionId: string) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, collectionId, deletedAt: null },
  });
  if (!section) {
    throw new AppError(
      "materials/errors:sectionNotFound",
      StatusCodes.NOT_FOUND
    );
  }
  return section;
}

async function assertMaterialOwnership(
  collectionId: string,
  materialId: string
) {
  const material = await prisma.material.findFirst({
    where: { id: materialId, collectionId, deletedAt: null },
  });
  if (!material) {
    throw new AppError(
      "materials/errors:materialNotFound",
      StatusCodes.NOT_FOUND
    );
  }
  return material;
}

/** A tutor may only build materials for a subject an admin has approved
 * them for, and only at a level they've been approved to teach that
 * subject at — mirrors the same TutorSubject/TutorSubjectLevel checks the
 * search module uses to decide whether a tutor is discoverable at all. */
async function assertTutorApprovedForSubject(
  tutorProfileId: string,
  subjectId: string,
  levelId: string
) {
  const approved = await prisma.tutorSubject.findFirst({
    where: {
      tutorProfileId,
      subjectId,
      status: SubjectVerificationStatus.APPROVED,
    },
    select: { id: true, levels: { where: { levelId }, select: { id: true } } },
  });
  if (!approved) {
    throw new AppError(
      "materials/errors:subjectNotApproved",
      StatusCodes.FORBIDDEN
    );
  }
  if (approved.levels.length === 0) {
    throw new AppError(
      "materials/errors:levelNotApproved",
      StatusCodes.FORBIDDEN
    );
  }
}

/** Blocks deletion of a material whose underlying file is evidence on an unresolved dispute. */
async function assertNotDisputeLocked(fileId: string | null) {
  if (!fileId) return;
  const evidence = await prisma.disputeEvidenceFile.findFirst({
    where: { fileId, dispute: { status: { in: ACTIVE_DISPUTE_STATUSES } } },
  });
  if (evidence) {
    throw new AppError("materials/errors:disputeLocked", StatusCodes.CONFLICT);
  }
}

function sanitizeTipTapContent(contentJson: unknown): unknown {
  const result = TipTapDocSchema.safeParse(contentJson);
  if (!result.success) {
    throw new AppError(
      "materials/errors:invalidTipTapContent",
      StatusCodes.BAD_REQUEST,
      { issues: result.error.issues.map((i) => i.message) }
    );
  }
  return result.data;
}

// ── Collections ──────────────────────────────────────────────
async function createCollection(
  tutorProfileId: string,
  ctx: ServiceContext,
  input: CollectionCreateInput
) {
  const [subject, level] = await Promise.all([
    prisma.subject.findUnique({ where: { id: input.subjectId } }),
    prisma.level.findUnique({ where: { id: input.levelId } }),
  ]);
  if (!subject) {
    throw new AppError(
      "materials/errors:subjectNotFound",
      StatusCodes.NOT_FOUND
    );
  }
  if (!level) {
    throw new AppError("materials/errors:levelNotFound", StatusCodes.NOT_FOUND);
  }
  await assertTutorApprovedForSubject(
    tutorProfileId,
    input.subjectId,
    input.levelId
  );

  const count = await prisma.collection.count({
    where: { tutorProfileId, deletedAt: null },
  });

  const collection = await prisma.collection.create({
    data: {
      tutorProfileId,
      subjectId: input.subjectId,
      levelId: input.levelId,
      name: input.name,
      description: input.description,
      orderIndex: count,
    },
  });

  AuditService.record(ctx, "collections", {
    operation: LogOperation.CREATE,
    category: LogCategory.WRITE,
    recordId: collection.id,
    newState: collection,
  });

  return collection;
}

async function listCollections(
  tutorProfileId: string,
  query: CollectionListQueryInput
) {
  const where = {
    tutorProfileId,
    deletedAt: null,
    ...(query.subjectId && { subjectId: query.subjectId }),
    ...(query.search && {
      name: { contains: query.search, mode: "insensitive" as const },
    }),
  };

  const [total, collections] = await Promise.all([
    prisma.collection.count({ where }),
    prisma.collection.findMany({
      where,
      orderBy: { orderIndex: "asc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        subject: { select: { id: true, name: true } },
        level: { select: { id: true, name: true } },
        _count: { select: { sections: true, materials: true } },
      },
    }),
  ]);

  // Free-preview count per collection — separate groupBy rather than a
  // second filtered relation count on `materials`, since Prisma's `_count`
  // can only key one count per relation name; we already need the
  // unfiltered materials count above.
  const collectionIds = collections.map((c) => c.id);
  const freePreviewCounts = collectionIds.length
    ? await prisma.material.groupBy({
        by: ["collectionId"],
        where: {
          collectionId: { in: collectionIds },
          deletedAt: null,
          isFreePreview: true,
        },
        _count: { collectionId: true },
      })
    : [];
  const freePreviewByCollection = new Map(
    freePreviewCounts.map((f) => [f.collectionId, f._count.collectionId])
  );

  return {
    data: collections.map((c) => ({
      ...c,
      freePreviewCount: freePreviewByCollection.get(c.id) ?? 0,
    })),
    meta: {
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

async function getCollection(tutorProfileId: string, collectionId: string) {
  await assertCollectionOwnership(tutorProfileId, collectionId);

  return prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      subject: { select: { id: true, name: true } },
      level: { select: { id: true, name: true } },
      sections: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        include: {
          materials: {
            where: { deletedAt: null },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
      materials: {
        where: { deletedAt: null, sectionId: null },
        orderBy: { orderIndex: "asc" },
      },
      lessonPlan: true,
    },
  });
}

async function updateCollection(
  tutorProfileId: string,
  collectionId: string,
  ctx: ServiceContext,
  input: CollectionUpdateInput
) {
  const existing = await assertCollectionOwnership(
    tutorProfileId,
    collectionId
  );

  const updated = await prisma.collection.update({
    where: { id: collectionId },
    data: input,
  });

  AuditService.record(ctx, "collections", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: collectionId,
    previousState: existing,
    newState: updated,
  });

  return updated;
}

async function deleteCollection(
  tutorProfileId: string,
  collectionId: string,
  ctx: ServiceContext
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);

  const materials = await prisma.material.findMany({
    where: { collectionId, deletedAt: null },
    select: { id: true, fileId: true },
  });
  for (const material of materials) {
    await assertNotDisputeLocked(material.fileId);
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.material.updateMany({
      where: { collectionId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.section.updateMany({
      where: { collectionId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.collection.update({
      where: { id: collectionId },
      data: { deletedAt: now },
    }),
  ]);

  AuditService.record(ctx, "collections", {
    operation: LogOperation.DELETE,
    category: LogCategory.WRITE,
    recordId: collectionId,
  });
}

async function reorderCollections(
  tutorProfileId: string,
  ctx: ServiceContext,
  orderedIds: string[]
) {
  const owned = await prisma.collection.findMany({
    where: { id: { in: orderedIds }, tutorProfileId, deletedAt: null },
    select: { id: true },
  });
  if (owned.length !== orderedIds.length) {
    throw new AppError(
      "materials/errors:collectionNotFound",
      StatusCodes.NOT_FOUND
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.collection.update({ where: { id }, data: { orderIndex: index } })
    )
  );

  AuditService.record(ctx, "collections", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: tutorProfileId,
    eventType: "collections.reorder",
    newState: { orderedIds },
  });
}

/**
 * Aggregated, anonymized access stats — unique viewer count and per-material
 * view count, sourced from AuditLog READ entries against this collection's
 * materials/collection row. Returns zero counts until a consumer module
 * (student/parent material access, currently out of scope) starts logging
 * reads — the query is correct and forward-compatible today.
 */
async function getCollectionStats(
  tutorProfileId: string,
  collectionId: string
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);

  const materials = await prisma.material.findMany({
    where: { collectionId, deletedAt: null },
    select: { id: true, name: true },
  });
  const materialIds = materials.map((m) => m.id);

  const [collectionReads, materialReads] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        tableName: "collections",
        targetId: collectionId,
        category: LogCategory.READ,
      },
      select: { actorId: true },
    }),
    materialIds.length
      ? prisma.auditLog.groupBy({
          by: ["targetId"],
          where: {
            tableName: "materials",
            targetId: { in: materialIds },
            category: LogCategory.READ,
          },
          _count: { targetId: true },
        })
      : Promise.resolve(
          [] as { targetId: string | null; _count: { targetId: number } }[]
        ),
  ]);

  const uniqueStudents = new Set(
    collectionReads.map((r) => r.actorId).filter(Boolean)
  ).size;
  const viewCountByMaterial = new Map(
    materialReads.map((r) => [r.targetId, r._count.targetId])
  );

  return {
    uniqueStudents,
    materials: materials.map((m) => ({
      materialId: m.id,
      name: m.name,
      viewCount: viewCountByMaterial.get(m.id) ?? 0,
    })),
  };
}

// ── Sections ─────────────────────────────────────────────────
async function createSection(
  tutorProfileId: string,
  collectionId: string,
  ctx: ServiceContext,
  input: SectionCreateInput
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);

  const count = await prisma.section.count({
    where: { collectionId, deletedAt: null },
  });

  const section = await prisma.section.create({
    data: {
      collectionId,
      name: input.name,
      description: input.description,
      isFreePreview: input.isFreePreview,
      orderIndex: count,
    },
  });

  AuditService.record(ctx, "sections", {
    operation: LogOperation.CREATE,
    category: LogCategory.WRITE,
    recordId: section.id,
    newState: section,
  });

  return section;
}

async function updateSection(
  tutorProfileId: string,
  collectionId: string,
  sectionId: string,
  ctx: ServiceContext,
  input: SectionUpdateInput
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  const existing = await assertSectionOwnership(collectionId, sectionId);

  const updated = await prisma.section.update({
    where: { id: sectionId },
    data: input,
  });

  AuditService.record(ctx, "sections", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: sectionId,
    previousState: existing,
    newState: updated,
  });

  return updated;
}

/** Sections are optional — deleting one un-nests its materials rather than deleting them. */
async function deleteSection(
  tutorProfileId: string,
  collectionId: string,
  sectionId: string,
  ctx: ServiceContext
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  await assertSectionOwnership(collectionId, sectionId);

  await prisma.$transaction([
    prisma.material.updateMany({
      where: { sectionId, deletedAt: null },
      data: { sectionId: null },
    }),
    prisma.section.update({
      where: { id: sectionId },
      data: { deletedAt: new Date() },
    }),
  ]);

  AuditService.record(ctx, "sections", {
    operation: LogOperation.DELETE,
    category: LogCategory.WRITE,
    recordId: sectionId,
  });
}

async function reorderSections(
  tutorProfileId: string,
  collectionId: string,
  ctx: ServiceContext,
  orderedIds: string[]
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);

  const owned = await prisma.section.findMany({
    where: { id: { in: orderedIds }, collectionId, deletedAt: null },
    select: { id: true },
  });
  if (owned.length !== orderedIds.length) {
    throw new AppError(
      "materials/errors:sectionNotFound",
      StatusCodes.NOT_FOUND
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.section.update({ where: { id }, data: { orderIndex: index } })
    )
  );

  AuditService.record(ctx, "sections", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: collectionId,
    eventType: "sections.reorder",
    newState: { orderedIds },
  });
}

// ── Materials ────────────────────────────────────────────────
async function nextMaterialOrderIndex(
  collectionId: string,
  sectionId?: string | null
) {
  return prisma.material.count({
    where: { collectionId, sectionId: sectionId ?? null, deletedAt: null },
  });
}

async function createMaterial(
  tutorProfileId: string,
  collectionId: string,
  ctx: ServiceContext,
  input: MaterialCreateInput,
  file: UploadedFileInput
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  if (input.sectionId) {
    await assertSectionOwnership(collectionId, input.sectionId);
  }

  const policy = MATERIAL_UPLOAD_POLICY[input.materialType];
  const [uploadResult] = await MediaService.upload(
    [
      {
        tempFilePath: file.tempFilePath,
        originalFileName: file.originalFileName,
      },
    ],
    {
      uploadedById: ctx.userId!,
      fileCategory: policy.fileCategory,
      fileType: policy.fileType,
      allowedTypes: policy.allowedTypes,
      maxSizeMB: policy.maxSizeMB,
      refTable: "materials",
    }
  );

  const orderIndex = await nextMaterialOrderIndex(
    collectionId,
    input.sectionId
  );

  try {
    const material = await prisma.material.create({
      data: {
        collectionId,
        sectionId: input.sectionId,
        name: input.name,
        materialType: input.materialType as MaterialType,
        orderIndex,
        fileId: uploadResult.fileId,
        isFreePreview: input.isFreePreview,
      },
    });

    AuditService.record(ctx, "materials", {
      operation: LogOperation.CREATE,
      category: LogCategory.WRITE,
      recordId: material.id,
      newState: material,
    });

    return material;
  } catch (err) {
    await MediaService.delete([uploadResult.fileId], {
      ownerId: ctx.userId!,
    }).catch(() => {});
    throw err;
  }
}

async function createWrittenNote(
  tutorProfileId: string,
  collectionId: string,
  ctx: ServiceContext,
  input: WrittenNoteCreateInput
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  if (input.sectionId) {
    await assertSectionOwnership(collectionId, input.sectionId);
  }

  const sanitized = sanitizeTipTapContent(input.contentJson);
  const orderIndex = await nextMaterialOrderIndex(
    collectionId,
    input.sectionId
  );

  const material = await prisma.material.create({
    data: {
      collectionId,
      sectionId: input.sectionId,
      name: input.name,
      materialType: MaterialType.WRITTEN_NOTE,
      orderIndex,
      contentJson: sanitized as any,
      isFreePreview: input.isFreePreview,
    },
  });

  AuditService.record(ctx, "materials", {
    operation: LogOperation.CREATE,
    category: LogCategory.WRITE,
    recordId: material.id,
    newState: material,
  });

  return material;
}

async function updateMaterial(
  tutorProfileId: string,
  collectionId: string,
  materialId: string,
  ctx: ServiceContext,
  input: MaterialUpdateInput
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  const existing = await assertMaterialOwnership(collectionId, materialId);

  if (input.sectionId) {
    await assertSectionOwnership(collectionId, input.sectionId);
  }

  const updated = await prisma.material.update({
    where: { id: materialId },
    data: input,
  });

  AuditService.record(ctx, "materials", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: materialId,
    previousState: existing,
    newState: updated,
  });

  return updated;
}

/**
 * Written-note edits are "versioned" by relying on AuditLog's
 * previousState/newState snapshot (already captured on every UPDATE) —
 * an admin can reconstruct the full edit history for a disputed note by
 * querying AuditLog for tableName=materials/targetId=materialId, rather
 * than maintaining a separate version table.
 */
async function updateWrittenNoteContent(
  tutorProfileId: string,
  collectionId: string,
  materialId: string,
  ctx: ServiceContext,
  input: WrittenNoteContentUpdateInput
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  const existing = await assertMaterialOwnership(collectionId, materialId);

  if (existing.materialType !== MaterialType.WRITTEN_NOTE) {
    throw new AppError(
      "materials/errors:notAWrittenNote",
      StatusCodes.BAD_REQUEST
    );
  }

  const sanitized = sanitizeTipTapContent(input.contentJson);

  const updated = await prisma.material.update({
    where: { id: materialId },
    data: { contentJson: sanitized as any },
  });

  AuditService.record(ctx, "materials", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: materialId,
    previousState: { contentJson: existing.contentJson },
    newState: { contentJson: sanitized },
    changedFields: ["contentJson"],
  });

  return updated;
}

async function replaceMaterialFile(
  tutorProfileId: string,
  collectionId: string,
  materialId: string,
  ctx: ServiceContext,
  file: UploadedFileInput
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  const existing = await assertMaterialOwnership(collectionId, materialId);

  if (existing.materialType === MaterialType.WRITTEN_NOTE || !existing.fileId) {
    throw new AppError(
      "materials/errors:materialHasNoFile",
      StatusCodes.BAD_REQUEST
    );
  }

  const policy =
    MATERIAL_UPLOAD_POLICY[
      existing.materialType as "VIDEO" | "AUDIO" | "DOCUMENT" | "IMAGE"
    ];

  const result = await MediaService.replace(
    {
      tempFilePath: file.tempFilePath,
      originalFileName: file.originalFileName,
    },
    {
      fileId: existing.fileId,
      uploadedById: ctx.userId!,
      fileCategory: policy.fileCategory,
      fileType: policy.fileType,
      allowedTypes: policy.allowedTypes,
      maxSizeMB: policy.maxSizeMB,
      refTable: "materials",
      refRecordId: materialId,
    }
  );

  AuditService.record(ctx, "materials", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: materialId,
    eventType: "materials.file_replaced",
    newState: { fileId: result.fileId },
  });

  return result;
}

async function deleteMaterial(
  tutorProfileId: string,
  collectionId: string,
  materialId: string,
  ctx: ServiceContext
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  const existing = await assertMaterialOwnership(collectionId, materialId);
  await assertNotDisputeLocked(existing.fileId);

  await prisma.material.update({
    where: { id: materialId },
    data: { deletedAt: new Date() },
  });

  AuditService.record(ctx, "materials", {
    operation: LogOperation.DELETE,
    category: LogCategory.WRITE,
    recordId: materialId,
  });
}

async function reorderMaterials(
  tutorProfileId: string,
  collectionId: string,
  ctx: ServiceContext,
  orderedIds: string[]
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);

  const owned = await prisma.material.findMany({
    where: { id: { in: orderedIds }, collectionId, deletedAt: null },
    select: { id: true },
  });
  if (owned.length !== orderedIds.length) {
    throw new AppError(
      "materials/errors:materialNotFound",
      StatusCodes.NOT_FOUND
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.material.update({ where: { id }, data: { orderIndex: index } })
    )
  );

  AuditService.record(ctx, "materials", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: collectionId,
    eventType: "materials.reorder",
    newState: { orderedIds },
  });
}

// ── Lesson Plans ─────────────────────────────────────────────
async function createLessonPlan(
  tutorProfileId: string,
  collectionId: string,
  ctx: ServiceContext,
  input: LessonPlanCreateInput
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);

  const existing = await prisma.lessonPlan.findUnique({
    where: { collectionId },
  });
  if (existing) {
    throw new AppError(
      "materials/errors:lessonPlanAlreadyExists",
      StatusCodes.CONFLICT
    );
  }

  const lessonPlan = await prisma.lessonPlan.create({
    data: {
      collectionId,
      tutorProfileId,
      title: input.title,
      description: input.description,
    },
  });

  AuditService.record(ctx, "lesson_plans", {
    operation: LogOperation.CREATE,
    category: LogCategory.WRITE,
    recordId: lessonPlan.id,
    newState: lessonPlan,
  });

  return lessonPlan;
}

async function getLessonPlanOrThrow(collectionId: string) {
  const lessonPlan = await prisma.lessonPlan.findUnique({
    where: { collectionId },
    include: {
      topics: { where: { deletedAt: null }, orderBy: { orderIndex: "asc" } },
    },
  });
  if (!lessonPlan) {
    throw new AppError(
      "materials/errors:lessonPlanNotFound",
      StatusCodes.NOT_FOUND
    );
  }
  return lessonPlan;
}

/**
 * A topic is "coming soon" (per spec) when it has no linked section yet,
 * or the linked section has zero materials uploaded so far. Ownership-free
 * so it can back both the tutor-facing getLessonPlan below and the public
 * tutor-profile lesson plan listing (getPublicLessonPlans) without either
 * one duplicating this computation.
 */
async function attachTopicStatuses<
  T extends { id: string; sectionId: string | null }
>(topics: T[]): Promise<(T & { status: "coming_soon" | "available" })[]> {
  const sectionIds = topics
    .map((t) => t.sectionId)
    .filter((id): id is string => !!id);

  const materialCounts = sectionIds.length
    ? await prisma.material.groupBy({
        by: ["sectionId"],
        where: { sectionId: { in: sectionIds }, deletedAt: null },
        _count: { sectionId: true },
      })
    : [];
  const countBySection = new Map(
    materialCounts.map((c) => [c.sectionId, c._count.sectionId])
  );

  return topics.map((topic) => ({
    ...topic,
    status: (!topic.sectionId ||
    (countBySection.get(topic.sectionId) ?? 0) === 0
      ? "coming_soon"
      : "available") as "coming_soon" | "available",
  }));
}

async function getLessonPlan(tutorProfileId: string, collectionId: string) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  const lessonPlan = await getLessonPlanOrThrow(collectionId);
  const topics = await attachTopicStatuses(lessonPlan.topics);
  return { ...lessonPlan, topics };
}

async function updateLessonPlan(
  tutorProfileId: string,
  collectionId: string,
  ctx: ServiceContext,
  input: LessonPlanUpdateInput
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  const existing = await getLessonPlanOrThrow(collectionId);

  const updated = await prisma.lessonPlan.update({
    where: { collectionId },
    data: input,
  });

  AuditService.record(ctx, "lesson_plans", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: existing.id,
    previousState: existing,
    newState: updated,
  });

  return updated;
}

async function createLessonPlanTopic(
  tutorProfileId: string,
  collectionId: string,
  ctx: ServiceContext,
  input: LessonPlanTopicCreateInput
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  const lessonPlan = await getLessonPlanOrThrow(collectionId);
  if (input.sectionId) {
    await assertSectionOwnership(collectionId, input.sectionId);
  }

  const count = await prisma.lessonPlanTopic.count({
    where: { lessonPlanId: lessonPlan.id, deletedAt: null },
  });

  const topic = await prisma.lessonPlanTopic.create({
    data: {
      lessonPlanId: lessonPlan.id,
      sectionId: input.sectionId,
      title: input.title,
      description: input.description,
      orderIndex: count,
    },
  });

  AuditService.record(ctx, "lesson_plan_topics", {
    operation: LogOperation.CREATE,
    category: LogCategory.WRITE,
    recordId: topic.id,
    newState: topic,
  });

  return topic;
}

async function assertTopicOwnership(lessonPlanId: string, topicId: string) {
  const topic = await prisma.lessonPlanTopic.findFirst({
    where: { id: topicId, lessonPlanId, deletedAt: null },
  });
  if (!topic) {
    throw new AppError(
      "materials/errors:lessonPlanTopicNotFound",
      StatusCodes.NOT_FOUND
    );
  }
  return topic;
}

async function updateLessonPlanTopic(
  tutorProfileId: string,
  collectionId: string,
  topicId: string,
  ctx: ServiceContext,
  input: LessonPlanTopicUpdateInput
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  const lessonPlan = await getLessonPlanOrThrow(collectionId);
  const existing = await assertTopicOwnership(lessonPlan.id, topicId);
  if (input.sectionId) {
    await assertSectionOwnership(collectionId, input.sectionId);
  }

  const updated = await prisma.lessonPlanTopic.update({
    where: { id: topicId },
    data: input,
  });

  AuditService.record(ctx, "lesson_plan_topics", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: topicId,
    previousState: existing,
    newState: updated,
  });

  return updated;
}

async function deleteLessonPlanTopic(
  tutorProfileId: string,
  collectionId: string,
  topicId: string,
  ctx: ServiceContext
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  const lessonPlan = await getLessonPlanOrThrow(collectionId);
  await assertTopicOwnership(lessonPlan.id, topicId);

  await prisma.lessonPlanTopic.update({
    where: { id: topicId },
    data: { deletedAt: new Date() },
  });

  AuditService.record(ctx, "lesson_plan_topics", {
    operation: LogOperation.DELETE,
    category: LogCategory.WRITE,
    recordId: topicId,
  });
}

async function reorderLessonPlanTopics(
  tutorProfileId: string,
  collectionId: string,
  ctx: ServiceContext,
  orderedIds: string[]
) {
  await assertCollectionOwnership(tutorProfileId, collectionId);
  const lessonPlan = await getLessonPlanOrThrow(collectionId);

  const owned = await prisma.lessonPlanTopic.findMany({
    where: {
      id: { in: orderedIds },
      lessonPlanId: lessonPlan.id,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (owned.length !== orderedIds.length) {
    throw new AppError(
      "materials/errors:lessonPlanTopicNotFound",
      StatusCodes.NOT_FOUND
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.lessonPlanTopic.update({
        where: { id },
        data: { orderIndex: index },
      })
    )
  );

  AuditService.record(ctx, "lesson_plan_topics", {
    operation: LogOperation.UPDATE,
    category: LogCategory.WRITE,
    recordId: lessonPlan.id,
    eventType: "lesson_plan_topics.reorder",
    newState: { orderedIds },
  });
}

/**
 * Powers "the lesson plan is visible on the tutor's public profile" —
 * lesson plans are optional: a published collection with no lesson plan
 * still shows (as "materials available"), just with `lessonPlan: null`
 * instead of a topic table of contents.
 */
async function getPublicLessonPlans(tutorProfileId: string) {
  const collections = await prisma.collection.findMany({
    where: {
      tutorProfileId,
      isPublished: true,
      deletedAt: null,
      OR: [
        // Normal case — subject must currently be approved
        {
          subject: {
            tutorSubjects: {
              some: {
                tutorProfileId,
                status: SubjectVerificationStatus.APPROVED,
              },
            },
          },
        },
        // Free-preview content stays visible for discovery even if the
        // subject is mid re-review — collection-level flag overrides,
        // matching the same cascade used everywhere else.
        { isFreePreview: true },
      ],
    },
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      name: true,
      subject: { select: { id: true, name: true } },
      level: { select: { id: true, name: true } },
      lessonPlan: {
        select: {
          id: true,
          title: true,
          description: true,
          topics: {
            where: { deletedAt: null },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
    },
  });

  const allTopics = collections.flatMap((c) => c.lessonPlan?.topics ?? []);
  const topicsWithStatus = await attachTopicStatuses(allTopics);
  const statusById = new Map(topicsWithStatus.map((t) => [t.id, t.status]));

  return collections.map((c) => ({
    collectionId: c.id,
    collectionName: c.name,
    subject: c.subject,
    level: c.level,
    lessonPlan: c.lessonPlan
      ? {
          id: c.lessonPlan.id,
          title: c.lessonPlan.title,
          description: c.lessonPlan.description,
          topics: c.lessonPlan.topics.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            orderIndex: t.orderIndex,
            status: statusById.get(t.id)!,
          })),
        }
      : null,
  }));
}

// Lifetime-scoped "has this viewer EVER reached a real, paid/completed
// engagement with this tutor" — deliberately not time-bound, unlike
// hasActiveOrUpcomingBookingAccess below. Used only as one half of the
// saved-collection escape hatch: on its own it grants nothing (see
// resolveViewerAccess) — it exists so that saving a collection you never
// booked can't be used to unlock it for free.
const VALID_ACCESS_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PAID,
  BookingStatus.IN_PROGRESS,
  BookingStatus.AWAITING_CONFIRMATION,
  BookingStatus.CONFIRMED,
  BookingStatus.AUTO_CONFIRMED,
  BookingStatus.DISPUTED,
  BookingStatus.RESOLVED_TUTOR_FAVOR,
  BookingStatus.RESOLVED_PARENT_FAVOR,
];

async function hasEverQualifiedBooking(
  viewerUserId: string,
  tutorProfileId: string
): Promise<boolean> {
  const booking = await prisma.booking.findFirst({
    where: {
      bookerId: viewerUserId,
      tutorProfileId,
      status: { in: VALID_ACCESS_BOOKING_STATUSES },
      deletedAt: null,
    },
    select: { id: true },
  });
  return !!booking;
}

/**
 * Resolves what a given viewer is allowed to see for a collection —
 * the single source of truth the reading UI is built around: backend
 * decides access, frontend only renders what it's handed.
 * - FULL: the tutor who owns the collection; or a viewer with a currently
 *   active/upcoming booking with that tutor (time-bound, computed live via
 *   BookingAccessService — same helper messaging/media gating use); or a
 *   viewer who has EVER had a qualifying booking with that tutor AND has
 *   saved this collection (the "keep it after the booking ends" escape
 *   hatch — saving alone, with no booking history, grants nothing).
 * - PREVIEW_ONLY: everyone else, including guests. Sees the collection's
 *   structure (sections, material names/types/order) but no content —
 *   isFreePreview no longer unlocks anything here, see isMaterialVisible's
 *   old removed comment / buildCollectionView for why.
 *
 * Also returns isSaved/everQualified so callers don't need a second
 * round-trip to answer "is this bookmarked" / "did access lapse, or did
 * they just never book" for the UI copy.
 */
async function resolveViewerAccess(
  collectionId: string,
  viewerUserId: string
): Promise<{
  access: "FULL" | "PREVIEW_ONLY";
  isSaved: boolean;
  everQualified: boolean;
}> {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, deletedAt: null },
    select: {
      tutorProfileId: true,
      tutorProfile: { select: { userId: true } },
    },
  });
  if (!collection) {
    throw new AppError(
      "materials/errors:collectionNotFound",
      StatusCodes.NOT_FOUND
    );
  }

  const isSavedPromise = prisma.savedCollection.findUnique({
    where: { userId_collectionId: { userId: viewerUserId, collectionId } },
    select: { id: true },
  });

  if (collection.tutorProfile.userId === viewerUserId) {
    return { access: "FULL", isSaved: !!(await isSavedPromise), everQualified: true };
  }

  const [hasLiveAccess, everQualified, isSaved] = await Promise.all([
    BookingAccessService.hasActiveOrUpcomingBookingAccess(
      viewerUserId,
      collection.tutorProfile.userId
    ),
    hasEverQualifiedBooking(viewerUserId, collection.tutorProfileId),
    isSavedPromise,
  ]);

  const access: "FULL" | "PREVIEW_ONLY" =
    hasLiveAccess || (everQualified && !!isSaved) ? "FULL" : "PREVIEW_ONLY";

  return { access, isSaved: !!isSaved, everQualified };
}

// A tutor's own isFreePreview flag (collection/section/material) is
// deliberately NEVER consulted here anymore — it used to let a tutor mark
// specific content visible to literally anyone (including guests) with no
// booking at all, which is exactly the loophole stakeholders flagged: a
// tutor could put a phone number/email in a "free preview" note or image
// and it would be visible to every visitor, no booking required, no
// booking-access check ever run. Content visibility is now booking-access
// only, full stop — FULL or nothing. The flags themselves are left alone in
// the schema/authoring UI (a tutor can still toggle them), they just no
// longer have any effect on what a non-FULL viewer can actually see.

/**
 * Shared builder behind both the guest-facing and viewer-aware collection
 * reads — one access-aware tree, so the "book" (collection → sections →
 * materials, plus lesson plan as table of contents) is assembled exactly
 * once regardless of who's looking at it.
 */
async function buildCollectionView(
  collectionId: string,
  access: "FULL" | "PREVIEW_ONLY"
) {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, isPublished: true, deletedAt: null },
    include: {
      subject: { select: { id: true, name: true } },
      level: { select: { id: true, name: true } },
      tutorProfile: {
        select: {
          id: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
      lessonPlan: {
        select: {
          id: true,
          title: true,
          description: true,
          topics: {
            where: { deletedAt: null },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
      sections: {
        where: { deletedAt: null },
        orderBy: { orderIndex: "asc" },
        include: {
          materials: {
            where: { deletedAt: null },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
      materials: {
        where: { deletedAt: null, sectionId: null },
        orderBy: { orderIndex: "asc" },
      },
    },
  });
  if (!collection) {
    throw new AppError(
      "materials/errors:collectionNotFound",
      StatusCodes.NOT_FOUND
    );
  }

  // Structure (names, types, order, section layout) is always shown, even
  // to a guest with zero relationship to the tutor — that's how a prospect
  // sees what's in a collection worth booking for. Content is the opposite:
  // strictly FULL-access-only, no exceptions. A locked item still appears
  // in the list (so the book's shape is visible), just with content/fileUrl
  // withheld and `locked: true` for the UI to render a lock state instead
  // of the actual note/file.
  const resolveMaterial = async (material: any) => {
    const locked = access !== "FULL";
    return {
      id: material.id,
      name: material.name,
      materialType: material.materialType,
      locked,
      content:
        !locked && material.materialType === MaterialType.WRITTEN_NOTE
          ? material.contentJson
          : null,
      fileUrl:
        !locked && material.fileId
          ? await MediaService.getFileUrl(material.fileId).catch(() => null)
          : null,
    };
  };

  const looseMaterials = await Promise.all(collection.materials.map(resolveMaterial));

  const sections = await Promise.all(
    collection.sections.map(async (section) => ({
      id: section.id,
      name: section.name,
      description: section.description,
      materials: await Promise.all(section.materials.map(resolveMaterial)),
    }))
  );

  const topicsWithStatus = collection.lessonPlan
    ? await attachTopicStatuses(collection.lessonPlan.topics)
    : [];
  const statusById = new Map(topicsWithStatus.map((t) => [t.id, t.status]));

  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    subject: collection.subject,
    level: collection.level,
    tutor: {
      tutorProfileId: collection.tutorProfile.id,
      firstName: collection.tutorProfile.user.firstName,
      lastName: collection.tutorProfile.user.lastName,
    },
    // Optional — a collection with no lesson plan still shows (materials
    // available), just without a table-of-contents.
    lessonPlan: collection.lessonPlan
      ? {
          id: collection.lessonPlan.id,
          title: collection.lessonPlan.title,
          description: collection.lessonPlan.description,
          topics: collection.lessonPlan.topics.map((t) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            orderIndex: t.orderIndex,
            sectionId: t.sectionId,
            status: statusById.get(t.id)!,
          })),
        }
      : null,
    sections,
    materials: looseMaterials,
    accessLevel: access,
  };
}

/** Guest/unauthenticated path — always PREVIEW_ONLY, cascade-filtered. */
async function getPublicCollectionPreview(collectionId: string) {
  return buildCollectionView(collectionId, "PREVIEW_ONLY");
}

/** Authenticated path — owner, or a viewer with a live active/upcoming
 * booking, or a viewer who ever qualified AND saved the collection, gets
 * FULL; everyone else still gets the same PREVIEW_ONLY cascade a guest
 * would see. Also surfaces isSaved/everHadAccess so the UI can tell "book
 * to unlock" apart from "your access lapsed — save it to keep it" without
 * a second round-trip. */
async function getCollectionForViewer(
  collectionId: string,
  viewerUserId: string
) {
  const { access, isSaved, everQualified } = await resolveViewerAccess(
    collectionId,
    viewerUserId
  );
  const view = await buildCollectionView(collectionId, access);
  return { ...view, isSaved, everHadAccess: everQualified };
}

// ── Saved Collections ───────────────────────────────────────
async function saveCollection(userId: string, collectionId: string) {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, isPublished: true, deletedAt: null },
    select: { id: true },
  });
  if (!collection) {
    throw new AppError(
      "materials/errors:collectionNotFound",
      StatusCodes.NOT_FOUND
    );
  }
  return prisma.savedCollection.upsert({
    where: { userId_collectionId: { userId, collectionId } },
    create: { userId, collectionId },
    update: {},
  });
}

async function unsaveCollection(userId: string, collectionId: string) {
  await prisma.savedCollection.deleteMany({ where: { userId, collectionId } });
}

/** A saved collection can later be unpublished or soft-deleted by the
 * tutor — surfaced as `available: false` rather than silently dropped,
 * so a student understands why something they saved disappeared. */
async function listSavedCollections(userId: string) {
  const saved = await prisma.savedCollection.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      collection: {
        select: {
          id: true,
          name: true,
          description: true,
          isPublished: true,
          deletedAt: true,
          subject: { select: { id: true, name: true } },
          level: { select: { id: true, name: true } },
          tutorProfile: {
            select: {
              id: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  return saved.map((s) => ({
    savedAt: s.createdAt,
    collectionId: s.collectionId,
    available: s.collection.isPublished && !s.collection.deletedAt,
    collection: {
      id: s.collection.id,
      name: s.collection.name,
      description: s.collection.description,
      subject: s.collection.subject,
      level: s.collection.level,
      tutor: {
        tutorProfileId: s.collection.tutorProfile.id,
        firstName: s.collection.tutorProfile.user.firstName,
        lastName: s.collection.tutorProfile.user.lastName,
      },
    },
  }));
}

// ── Storage ──────────────────────────────────────────────────
async function getStorageUsage(userId: string) {
  const [usage, limitBytes] = await Promise.all([
    prisma.storageUsage.findUnique({ where: { userId } }),
    resolveQuotaLimitBytes(userId),
  ]);

  const usedBytes = usage?.usedBytes ?? BigInt(0);

  return {
    usedBytes: usedBytes.toString(),
    limitBytes: limitBytes.toString(),
    percentUsed:
      limitBytes > BigInt(0)
        ? Number((usedBytes * BigInt(10000)) / limitBytes) / 100
        : 0,
  };
}

export const MaterialsService = {
  createCollection,
  listCollections,
  getCollection,
  updateCollection,
  deleteCollection,
  reorderCollections,
  getCollectionStats,

  createSection,
  updateSection,
  deleteSection,
  reorderSections,

  createMaterial,
  createWrittenNote,
  updateMaterial,
  updateWrittenNoteContent,
  replaceMaterialFile,
  deleteMaterial,
  reorderMaterials,

  createLessonPlan,
  getLessonPlan,
  updateLessonPlan,
  createLessonPlanTopic,
  updateLessonPlanTopic,
  deleteLessonPlanTopic,
  reorderLessonPlanTopics,

  getPublicLessonPlans,
  getPublicCollectionPreview,
  getCollectionForViewer,

  saveCollection,
  unsaveCollection,
  listSavedCollections,

  getStorageUsage,
};

export default MaterialsService;
