import { AppError } from "../../utils/AppError.util";

const mockPrisma: any = {
  tutorProfile: { findFirst: jest.fn(), findUnique: jest.fn() },
  level: { findMany: jest.fn() },
  subject: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  subjectDomain: { findUnique: jest.fn() },
  tutorSubject: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    upsert: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
  tutorSubjectLevel: { createMany: jest.fn(), deleteMany: jest.fn() },
  tutorCredential: { create: jest.fn() },
  credentialSubjectLink: { create: jest.fn() },
  $transaction: jest.fn(async (ops: any) =>
    Array.isArray(ops) ? Promise.all(ops) : ops(mockPrisma)
  ),
};

jest.mock("../../config/database.config", () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock("../../services/media/media.service", () => ({
  MediaService: {
    upload: jest.fn().mockResolvedValue([{ fileId: "file-1", storagePath: "path/1" }]),
  },
}));

jest.mock("../../services/accountCompletion/accountCompletion.service", () => ({
  evaluateCompletion: jest.fn().mockResolvedValue({ isComplete: true, missing: [] }),
}));

jest.mock("../../services/notification/notification.service", () => ({
  __esModule: true,
  default: { send: jest.fn().mockResolvedValue([]) },
}));

import { KycService } from "./kyc.service";
import { KycStatus, SubjectVerificationStatus } from "../../generated/prisma";

const file = { path: "/tmp/x.pdf", originalname: "x.pdf", mimetype: "application/pdf" } as Express.Multer.File;

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (ops: any) =>
    Array.isArray(ops) ? Promise.all(ops) : ops(mockPrisma)
  );
});

describe("KycService.addAdditionalSubject", () => {
  const activeProfile = { id: "profile-1", kycStatus: KycStatus.ACTIVE, userId: "user-1" };

  it("throws mustBeActiveForAdditionalSubject when the tutor isn't ACTIVE", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({
      ...activeProfile,
      kycStatus: KycStatus.PENDING,
    });

    await expect(
      KycService.addAdditionalSubject(
        "user-1",
        { levelIds: ["level-1"], subjectId: "subject-1" } as any,
        file
      )
    ).rejects.toMatchObject(
      new AppError("kyc/errors:mustBeActiveForAdditionalSubject", 409)
    );
  });

  it("throws invalidLevel when a levelId doesn't resolve", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue(activeProfile);
    mockPrisma.level.findMany.mockResolvedValue([]); // none found

    await expect(
      KycService.addAdditionalSubject(
        "user-1",
        { levelIds: ["level-1"], subjectId: "subject-1" } as any,
        file
      )
    ).rejects.toMatchObject(new AppError("kyc/errors:invalidLevel", 400));
  });

  it("claims an existing approved subject and records the chosen levels", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue(activeProfile);
    mockPrisma.level.findMany.mockResolvedValue([{ id: "level-1" }]);
    mockPrisma.subject.findFirst.mockResolvedValue({ id: "subject-1" });
    mockPrisma.tutorSubject.findUnique.mockResolvedValue(null); // no existing claim
    mockPrisma.tutorCredential.create.mockResolvedValue({ id: "cred-1" });
    mockPrisma.tutorSubject.upsert.mockResolvedValue({ id: "ts-1" });

    const result = await KycService.addAdditionalSubject(
      "user-1",
      {
        institutionName: "Uni",
        qualificationType: "BSC",
        fieldOfStudy: "Physics",
        yearAwarded: 2020,
        subjectId: "subject-1",
        levelIds: ["level-1"],
      } as any,
      file
    );

    expect(mockPrisma.tutorSubjectLevel.createMany).toHaveBeenCalledWith({
      data: [{ tutorSubjectId: "ts-1", levelId: "level-1" }],
      skipDuplicates: true,
    });
    expect(result.tutorSubject).toEqual({ id: "ts-1" });
  });

  it("rejects claiming a subject the tutor has already applied for", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue(activeProfile);
    mockPrisma.level.findMany.mockResolvedValue([{ id: "level-1" }]);
    mockPrisma.subject.findFirst.mockResolvedValue({ id: "subject-1" });
    mockPrisma.tutorSubject.findUnique.mockResolvedValue({ id: "already-claimed" });

    await expect(
      KycService.addAdditionalSubject(
        "user-1",
        {
          institutionName: "Uni",
          qualificationType: "BSC",
          fieldOfStudy: "Physics",
          yearAwarded: 2020,
          subjectId: "subject-1",
          levelIds: ["level-1"],
        } as any,
        file
      )
    ).rejects.toMatchObject(new AppError("kyc/errors:subjectAlreadyClaimed", 409));
  });

  it("proposes a brand-new subject as PENDING/inactive when no near-duplicate exists", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue(activeProfile);
    mockPrisma.level.findMany.mockResolvedValue([{ id: "level-1" }]);
    mockPrisma.subject.findFirst.mockResolvedValue(null); // no existing match
    mockPrisma.subjectDomain.findUnique.mockResolvedValue({ id: "domain-1" });
    mockPrisma.subject.create.mockResolvedValue({ id: "new-subject-1" });
    mockPrisma.tutorSubject.findUnique.mockResolvedValue(null);
    mockPrisma.tutorCredential.create.mockResolvedValue({ id: "cred-1" });
    mockPrisma.tutorSubject.upsert.mockResolvedValue({ id: "ts-2" });

    await KycService.addAdditionalSubject(
      "user-1",
      {
        institutionName: "Uni",
        qualificationType: "BSC",
        fieldOfStudy: "Physics",
        yearAwarded: 2020,
        newSubject: {
          name: "Astrophysics",
          description: "The study of celestial objects",
          domainId: "domain-1",
        },
        levelIds: ["level-1"],
      } as any,
      file
    );

    expect(mockPrisma.subject.create).toHaveBeenCalledWith({
      data: {
        name: "Astrophysics",
        description: "The study of celestial objects",
        domainId: "domain-1",
        status: SubjectVerificationStatus.PENDING,
        isActive: false,
        submittedById: "user-1",
      },
    });
  });

  it("reuses an existing approved subject instead of creating a duplicate when names match", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue(activeProfile);
    mockPrisma.level.findMany.mockResolvedValue([{ id: "level-1" }]);
    mockPrisma.subject.findFirst.mockResolvedValue({ id: "existing-subject" });
    mockPrisma.tutorSubject.findUnique.mockResolvedValue(null);
    mockPrisma.tutorCredential.create.mockResolvedValue({ id: "cred-1" });
    mockPrisma.tutorSubject.upsert.mockResolvedValue({ id: "ts-3" });

    await KycService.addAdditionalSubject(
      "user-1",
      {
        institutionName: "Uni",
        qualificationType: "BSC",
        fieldOfStudy: "Physics",
        yearAwarded: 2020,
        newSubject: { name: "Physics", description: "Already exists", domainId: "domain-1" },
        levelIds: ["level-1"],
      } as any,
      file
    );

    expect(mockPrisma.subject.create).not.toHaveBeenCalled();
    expect(mockPrisma.credentialSubjectLink.create).toHaveBeenCalledWith({
      data: { credentialId: "cred-1", subjectId: "existing-subject" },
    });
  });
});

describe("KycService.updateSubjectLevels", () => {
  it("throws subjectNotFound when the claim doesn't belong to the tutor", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({ id: "profile-1" });
    mockPrisma.tutorSubject.findFirst.mockResolvedValue(null);

    await expect(
      KycService.updateSubjectLevels("user-1", "ts-1", { levelIds: ["level-1"] })
    ).rejects.toMatchObject(new AppError("kyc/errors:subjectNotFound", 404));
  });

  it("replaces the level set for an owned subject claim", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({ id: "profile-1" });
    mockPrisma.tutorSubject.findFirst.mockResolvedValue({ id: "ts-1" });
    mockPrisma.level.findMany.mockResolvedValue([{ id: "level-2" }]);
    mockPrisma.tutorSubject.findUniqueOrThrow.mockResolvedValue({ id: "ts-1", levels: [] });

    await KycService.updateSubjectLevels("user-1", "ts-1", { levelIds: ["level-2"] });

    expect(mockPrisma.tutorSubjectLevel.deleteMany).toHaveBeenCalledWith({
      where: { tutorSubjectId: "ts-1" },
    });
    expect(mockPrisma.tutorSubjectLevel.createMany).toHaveBeenCalledWith({
      data: [{ tutorSubjectId: "ts-1", levelId: "level-2" }],
      skipDuplicates: true,
    });
  });
});
