import { AppError } from "../../utils/AppError.util";

const mockPrisma: any = {
  collection: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  section: {
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
  },
  material: {
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  lessonPlan: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  lessonPlanTopic: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  disputeEvidenceFile: { findFirst: jest.fn() },
  storageUsage: { findUnique: jest.fn() },
  subject: { findUnique: jest.fn() },
  level: { findUnique: jest.fn() },
  auditLog: { create: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  platformConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  materialReview: { create: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(async (ops: any) =>
    Array.isArray(ops) ? Promise.all(ops) : ops()
  ),
};

jest.mock("../../config/database.config", () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock("../../services/media/media.service", () => ({
  MediaService: {
    upload: jest.fn(),
    replace: jest.fn(),
    delete: jest.fn(),
    getFileUrl: jest.fn(),
  },
}));

jest.mock("../../services/media/media.quota", () => ({
  resolveQuotaLimitBytes: jest.fn().mockResolvedValue(BigInt(500 * 1024 * 1024)),
}));

// materialsAdmin.service.ts pulls in NotificationService, which transitively
// imports the socket/env-check chain — irrelevant to these unit tests and
// requires a full runtime env, so it's mocked out at the boundary.
jest.mock("../../services/notification/notification.service", () => ({
  __esModule: true,
  default: { send: jest.fn().mockResolvedValue([]) },
}));

import { MaterialsService } from "./materials.service";
import { MaterialsAdminService } from "./materialsAdmin.service";

const ctx = { userId: "user-1", userEmail: "tutor@example.com", requestId: "req-1" };

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (ops: any) =>
    Array.isArray(ops) ? Promise.all(ops) : ops()
  );
});

describe("MaterialsService — ownership checks", () => {
  it("throws collectionNotFound when the collection doesn't belong to the tutor", async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(null);

    await expect(
      MaterialsService.createSection("tutor-1", "collection-1", ctx, {
        name: "Chapter 1",
        isFreePreview: false,
      })
    ).rejects.toMatchObject(
      new AppError("materials/errors:collectionNotFound", 404)
    );
  });

  it("proceeds when the collection belongs to the tutor", async () => {
    mockPrisma.collection.findFirst.mockResolvedValue({
      id: "collection-1",
      tutorProfileId: "tutor-1",
    });
    mockPrisma.section.count.mockResolvedValue(0);
    mockPrisma.section.create.mockResolvedValue({ id: "section-1", orderIndex: 0 });

    const section = await MaterialsService.createSection("tutor-1", "collection-1", ctx, {
      name: "Chapter 1",
      isFreePreview: false,
    });

    expect(section.id).toBe("section-1");
    expect(mockPrisma.section.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ orderIndex: 0 }) })
    );
  });
});

describe("MaterialsService — reorder", () => {
  beforeEach(() => {
    mockPrisma.collection.findFirst.mockResolvedValue({
      id: "collection-1",
      tutorProfileId: "tutor-1",
    });
  });

  it("rejects a reorder list containing an id that isn't owned by this collection", async () => {
    mockPrisma.material.findMany.mockResolvedValue([{ id: "m1" }]); // only 1 of 2 found

    await expect(
      MaterialsService.reorderMaterials("tutor-1", "collection-1", ctx, ["m1", "m2"])
    ).rejects.toMatchObject(new AppError("materials/errors:materialNotFound", 404));

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates orderIndex for every id, in order, inside a transaction", async () => {
    mockPrisma.material.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }, { id: "m3" }]);
    mockPrisma.material.update.mockResolvedValue({});

    await MaterialsService.reorderMaterials("tutor-1", "collection-1", ctx, [
      "m3",
      "m1",
      "m2",
    ]);

    expect(mockPrisma.material.update).toHaveBeenCalledTimes(3);
    expect(mockPrisma.material.update).toHaveBeenNthCalledWith(1, {
      where: { id: "m3" },
      data: { orderIndex: 0 },
    });
    expect(mockPrisma.material.update).toHaveBeenNthCalledWith(3, {
      where: { id: "m2" },
      data: { orderIndex: 2 },
    });
  });
});

describe("MaterialsService — written-note TipTap sanitizer", () => {
  beforeEach(() => {
    mockPrisma.collection.findFirst.mockResolvedValue({
      id: "collection-1",
      tutorProfileId: "tutor-1",
    });
    mockPrisma.material.count.mockResolvedValue(0);
  });

  it("rejects content containing a disallowed node type (e.g. raw html)", async () => {
    await expect(
      MaterialsService.createWrittenNote("tutor-1", "collection-1", ctx, {
        name: "Note",
        isFreePreview: false,
        contentJson: {
          type: "doc",
          content: [{ type: "html", content: [] }],
        },
      })
    ).rejects.toMatchObject(new AppError("materials/errors:invalidTipTapContent", 400));

    expect(mockPrisma.material.create).not.toHaveBeenCalled();
  });

  it("rejects a payload that isn't a doc at all", async () => {
    await expect(
      MaterialsService.createWrittenNote("tutor-1", "collection-1", ctx, {
        name: "Note",
        isFreePreview: false,
        contentJson: { foo: "bar" },
      })
    ).rejects.toThrow(AppError);
  });

  it("accepts a well-formed doc and persists the sanitized content", async () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
    };
    mockPrisma.material.create.mockResolvedValue({ id: "mat-1", contentJson: doc });

    await MaterialsService.createWrittenNote("tutor-1", "collection-1", ctx, {
      name: "Note",
      isFreePreview: false,
      contentJson: doc,
    });

    expect(mockPrisma.material.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contentJson: doc, materialType: "WRITTEN_NOTE" }),
      })
    );
  });
});

describe("MaterialsService — dispute-lock delete guard", () => {
  beforeEach(() => {
    mockPrisma.collection.findFirst.mockResolvedValue({
      id: "collection-1",
      tutorProfileId: "tutor-1",
    });
  });

  it("blocks deletion when the material's file is evidence on an active dispute", async () => {
    mockPrisma.material.findFirst.mockResolvedValue({
      id: "material-1",
      collectionId: "collection-1",
      fileId: "file-1",
    });
    mockPrisma.disputeEvidenceFile.findFirst.mockResolvedValue({ id: "evidence-1" });

    await expect(
      MaterialsService.deleteMaterial("tutor-1", "collection-1", "material-1", ctx)
    ).rejects.toMatchObject(new AppError("materials/errors:disputeLocked", 409));

    expect(mockPrisma.material.update).not.toHaveBeenCalled();
  });

  it("allows deletion when there is no dispute evidence linkage", async () => {
    mockPrisma.material.findFirst.mockResolvedValue({
      id: "material-1",
      collectionId: "collection-1",
      fileId: "file-1",
    });
    mockPrisma.disputeEvidenceFile.findFirst.mockResolvedValue(null);
    mockPrisma.material.update.mockResolvedValue({});

    await MaterialsService.deleteMaterial("tutor-1", "collection-1", "material-1", ctx);

    expect(mockPrisma.material.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "material-1" } })
    );
  });
});

describe("MaterialsAdminService — download policy defaults", () => {
  it("falls back to true for every content type when no PlatformConfig row exists yet", async () => {
    mockPrisma.platformConfig.findUnique.mockResolvedValue(null);

    const policy = await MaterialsAdminService.getDownloadPolicy();

    expect(policy).toEqual({ VIDEO: true, AUDIO: true, DOCUMENT: true, IMAGE: true });
  });

  it("merges a stored partial value over the defaults", async () => {
    mockPrisma.platformConfig.findUnique.mockResolvedValue({
      value: { VIDEO: false },
    });

    const policy = await MaterialsAdminService.getDownloadPolicy();

    expect(policy).toEqual({ VIDEO: false, AUDIO: true, DOCUMENT: true, IMAGE: true });
  });

  it("updateDownloadPolicy merges the partial update onto the current policy and upserts", async () => {
    mockPrisma.platformConfig.findUnique.mockResolvedValue(null);
    mockPrisma.platformConfig.upsert.mockResolvedValue({});

    const result = await MaterialsAdminService.updateDownloadPolicy(ctx, { VIDEO: false });

    expect(result).toEqual({ VIDEO: false, AUDIO: true, DOCUMENT: true, IMAGE: true });
    expect(mockPrisma.platformConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "materials.download_policy" },
        update: expect.objectContaining({ value: result }),
      })
    );
  });
});
