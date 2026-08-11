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
  tutorSubject: { findFirst: jest.fn() },
  auditLog: { create: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
  platformConfig: { findUnique: jest.fn(), upsert: jest.fn() },
  materialReview: { create: jest.fn(), findMany: jest.fn() },
  booking: { findFirst: jest.fn() },
  savedCollection: { findUnique: jest.fn() },
  $transaction: jest.fn(async (ops: any) =>
    Array.isArray(ops) ? Promise.all(ops) : ops()
  ),
};

jest.mock("../../config/database.config", () => ({
  __esModule: true,
  default: mockPrisma,
}));

const mockHasActiveOrUpcomingBookingAccess = jest.fn();
jest.mock("../../services/booking/bookingAccess.service", () => ({
  BookingAccessService: {
    hasActiveOrUpcomingBookingAccess: (...args: unknown[]) =>
      mockHasActiveOrUpcomingBookingAccess(...args),
  },
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
import { MediaService } from "../../services/media/media.service";
import { MaterialType } from "../../generated/prisma";

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

describe("MaterialsService.createCollection — subject-approval guard", () => {
  beforeEach(() => {
    mockPrisma.subject.findUnique.mockResolvedValue({ id: "subject-1" });
    mockPrisma.level.findUnique.mockResolvedValue({ id: "level-1" });
    mockPrisma.collection.count.mockResolvedValue(0);
  });

  it("rejects when the tutor has no APPROVED claim for the subject", async () => {
    mockPrisma.tutorSubject.findFirst.mockResolvedValue(null);

    await expect(
      MaterialsService.createCollection("tutor-1", ctx, {
        name: "Algebra Basics",
        subjectId: "subject-1",
        levelId: "level-1",
      })
    ).rejects.toMatchObject(new AppError("materials/errors:subjectNotApproved", 403));

    expect(mockPrisma.collection.create).not.toHaveBeenCalled();
  });

  it("proceeds when the tutor has an APPROVED claim for the subject", async () => {
    mockPrisma.tutorSubject.findFirst.mockResolvedValue({ id: "ts-1", levels: [{ id: "level-1" }] });
    mockPrisma.collection.create.mockResolvedValue({ id: "collection-1" });

    const collection = await MaterialsService.createCollection("tutor-1", ctx, {
      name: "Algebra Basics",
      subjectId: "subject-1",
      levelId: "level-1",
    });

    expect(collection.id).toBe("collection-1");
    expect(mockPrisma.tutorSubject.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tutorProfileId: "tutor-1",
          subjectId: "subject-1",
        }),
      })
    );
  });
});

describe("MaterialsService.getPublicCollectionPreview", () => {
  it("404s when the collection isn't published or the tutor isn't publicly visible", async () => {
    mockPrisma.collection.findFirst.mockResolvedValue(null);

    await expect(
      MaterialsService.getPublicCollectionPreview("collection-1")
    ).rejects.toMatchObject(new AppError("materials/errors:collectionNotFound", 404));
  });

  it("shows the full structure (sections/materials) to a guest, but withholds all content — a tutor's isFreePreview flag no longer bypasses this", async () => {
    mockPrisma.collection.findFirst.mockResolvedValue({
      id: "collection-1",
      name: "Algebra Basics",
      description: "Intro to algebra",
      subject: { id: "subject-1", name: "Mathematics" },
      level: { id: "level-1", name: "Form 3" },
      tutorProfile: { id: "tutor-1", user: { firstName: "Ada", lastName: "L." } },
      sections: [
        {
          id: "section-1",
          name: "Chapter 1",
          description: null,
          // isFreePreview: true here must NOT unlock content for a guest —
          // that's the exact loophole this behavior closes (a tutor could
          // otherwise put contact info in a "free preview" item and it'd be
          // visible to anyone, no booking required).
          isFreePreview: true,
          materials: [
            {
              id: "m1",
              name: "Video 1",
              materialType: MaterialType.VIDEO,
              fileId: "file-1",
              contentJson: null,
              isFreePreview: true,
            },
          ],
        },
      ],
      materials: [
        {
          id: "m2",
          name: "Note 1",
          materialType: MaterialType.WRITTEN_NOTE,
          fileId: null,
          contentJson: { type: "doc", content: [] },
          isFreePreview: true,
        },
      ],
    });
    (MediaService.getFileUrl as jest.Mock).mockResolvedValue("https://cdn.example/file-1");

    const preview = await MaterialsService.getPublicCollectionPreview("collection-1");

    // Structure is visible — the section and both materials are present...
    expect(preview.sections[0].materials[0]).toEqual(
      expect.objectContaining({ id: "m1", name: "Video 1", locked: true })
    );
    expect(preview.materials[0]).toEqual(
      expect.objectContaining({ id: "m2", name: "Note 1", locked: true })
    );
    // ...but content is withheld regardless of isFreePreview.
    expect(preview.sections[0].materials[0].fileUrl).toBeNull();
    expect(preview.sections[0].materials[0].content).toBeNull();
    expect(preview.materials[0].fileUrl).toBeNull();
    expect(preview.materials[0].content).toBeNull();
    expect(MediaService.getFileUrl).not.toHaveBeenCalled();
    expect(preview.tutor).toEqual({ tutorProfileId: "tutor-1", firstName: "Ada", lastName: "L." });
  });

  it("resolves actual content/fileUrl once access is FULL (owner path), proving the gate isn't just always-locked", async () => {
    mockPrisma.collection.findFirst
      .mockResolvedValueOnce({
        // resolveViewerAccess's own lookup — just enough to identify the owner.
        tutorProfileId: "tutor-profile-1",
        tutorProfile: { userId: "tutor-user-1" },
      })
      .mockResolvedValueOnce({
        // buildCollectionView's full-shape lookup.
        id: "collection-1",
        name: "Algebra Basics",
        description: null,
        subject: { id: "subject-1", name: "Mathematics" },
        level: { id: "level-1", name: "Form 3" },
        tutorProfile: { id: "tutor-profile-1", user: { firstName: "Ada", lastName: "L." } },
        lessonPlan: null,
        sections: [],
        materials: [
          {
            id: "m2",
            name: "Note 1",
            materialType: MaterialType.WRITTEN_NOTE,
            fileId: null,
            contentJson: { type: "doc", content: [] },
            isFreePreview: false,
          },
        ],
      });
    mockPrisma.savedCollection.findUnique.mockResolvedValue(null);

    const owner = await MaterialsService.getCollectionForViewer("collection-1", "tutor-user-1");

    expect(owner.accessLevel).toBe("FULL");
    expect(owner.materials[0]).toEqual(
      expect.objectContaining({ id: "m2", locked: false, content: { type: "doc", content: [] } })
    );
  });
});

describe("MaterialsService.getCollectionForViewer — time-bound access + saved-collection escape hatch", () => {
  const collectionForResolve = {
    tutorProfileId: "tutor-profile-1",
    tutorProfile: { userId: "tutor-user-1" },
  };
  const collectionForBuild = {
    id: "collection-1",
    name: "Algebra Basics",
    description: null,
    subject: { id: "subject-1", name: "Mathematics" },
    level: { id: "level-1", name: "Form 3" },
    tutorProfile: { id: "tutor-profile-1", user: { firstName: "Ada", lastName: "L." } },
    lessonPlan: null,
    sections: [],
    materials: [],
  };

  it("grants FULL to the collection's owner without running any booking check", async () => {
    mockPrisma.collection.findFirst
      .mockResolvedValueOnce(collectionForResolve)
      .mockResolvedValueOnce(collectionForBuild);
    mockPrisma.savedCollection.findUnique.mockResolvedValue(null);

    const view = await MaterialsService.getCollectionForViewer("collection-1", "tutor-user-1");

    expect(view.accessLevel).toBe("FULL");
    expect(view.everHadAccess).toBe(true);
    expect(mockHasActiveOrUpcomingBookingAccess).not.toHaveBeenCalled();
    expect(mockPrisma.booking.findFirst).not.toHaveBeenCalled();
  });

  it("grants FULL when the viewer has a live active/upcoming booking", async () => {
    mockPrisma.collection.findFirst
      .mockResolvedValueOnce(collectionForResolve)
      .mockResolvedValueOnce(collectionForBuild);
    mockHasActiveOrUpcomingBookingAccess.mockResolvedValue(true);
    mockPrisma.booking.findFirst.mockResolvedValue({ id: "booking-1" });
    mockPrisma.savedCollection.findUnique.mockResolvedValue(null);

    const view = await MaterialsService.getCollectionForViewer("collection-1", "student-1");

    expect(view.accessLevel).toBe("FULL");
    expect(mockHasActiveOrUpcomingBookingAccess).toHaveBeenCalledWith("student-1", "tutor-user-1");
  });

  it("grants FULL when live access has lapsed but the viewer once qualified AND saved the collection", async () => {
    mockPrisma.collection.findFirst
      .mockResolvedValueOnce(collectionForResolve)
      .mockResolvedValueOnce(collectionForBuild);
    mockHasActiveOrUpcomingBookingAccess.mockResolvedValue(false);
    mockPrisma.booking.findFirst.mockResolvedValue({ id: "booking-old" });
    mockPrisma.savedCollection.findUnique.mockResolvedValue({ id: "saved-1" });

    const view = await MaterialsService.getCollectionForViewer("collection-1", "student-1");

    expect(view.accessLevel).toBe("FULL");
    expect(view.isSaved).toBe(true);
    expect(view.everHadAccess).toBe(true);
  });

  it("drops to PREVIEW_ONLY when live access has lapsed and the viewer never saved the collection", async () => {
    mockPrisma.collection.findFirst
      .mockResolvedValueOnce(collectionForResolve)
      .mockResolvedValueOnce(collectionForBuild);
    mockHasActiveOrUpcomingBookingAccess.mockResolvedValue(false);
    mockPrisma.booking.findFirst.mockResolvedValue({ id: "booking-old" });
    mockPrisma.savedCollection.findUnique.mockResolvedValue(null);

    const view = await MaterialsService.getCollectionForViewer("collection-1", "student-1");

    expect(view.accessLevel).toBe("PREVIEW_ONLY");
    expect(view.everHadAccess).toBe(true);
  });

  it("keeps a viewer at PREVIEW_ONLY even if saved, when they've never had a qualifying booking (saving alone unlocks nothing)", async () => {
    mockPrisma.collection.findFirst
      .mockResolvedValueOnce(collectionForResolve)
      .mockResolvedValueOnce(collectionForBuild);
    mockHasActiveOrUpcomingBookingAccess.mockResolvedValue(false);
    mockPrisma.booking.findFirst.mockResolvedValue(null);
    mockPrisma.savedCollection.findUnique.mockResolvedValue({ id: "saved-1" });

    const view = await MaterialsService.getCollectionForViewer("collection-1", "student-1");

    expect(view.accessLevel).toBe("PREVIEW_ONLY");
    expect(view.isSaved).toBe(true);
    expect(view.everHadAccess).toBe(false);
  });
});
