import { AppError } from "../../utils/AppError.util";
import { KycStatus, SubjectVerificationStatus } from "../../generated/prisma";

const mockPrisma: any = {
  tutorProfile: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
  tutorSubject: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  platformConfig: { findUnique: jest.fn() },
};

jest.mock("../../config/database.config", () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock("../../services/media", () => ({
  resolveStorageUrl: (path: string | null | undefined) =>
    path ? `https://cdn.example/${path}` : null,
}));

jest.mock("../../services/media/media.service", () => ({
  MediaService: { upload: jest.fn() },
}));

jest.mock("../../services/media/mediaDuration.util", () => ({
  probeDurationSeconds: jest.fn(),
}));

// Pulls in bullmq (Queue/Worker) plus redis.config's startup env-var checks —
// irrelevant to these unit tests and would otherwise fail outside a full
// runtime env (or try to open a real Redis connection) on import.
jest.mock("../../services/search/searchScore.processor", () => ({
  queueScoreRecompute: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../materials/materials.service", () => ({
  MaterialsService: { getPublicLessonPlans: jest.fn().mockResolvedValue([]) },
}));

import { TutorService } from "./tutor.service";
import { MediaService } from "../../services/media/media.service";
import { probeDurationSeconds } from "../../services/media/mediaDuration.util";

const file = { path: "/tmp/video.mp4", originalname: "video.mp4" } as Express.Multer.File;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("TutorService.getMyProfile — needsIntroVideo", () => {
  it("is false when there is no tutor profile yet", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue(null);
    const result = await TutorService.getMyProfile("user-1");
    expect(result).toBeNull();
  });

  it("is true once ACTIVE but no verified intro video", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({
      kycStatus: KycStatus.ACTIVE,
      introVideoVerified: false,
      profilePictureUrl: null,
      introVideoUrl: null,
    });
    mockPrisma.platformConfig.findUnique.mockResolvedValue(null);

    const result: any = await TutorService.getMyProfile("user-1");

    expect(result.needsIntroVideo).toBe(true);
    expect(result.introVideoMinDurationSeconds).toBe(60);
  });

  it("is false once the intro video is verified", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({
      kycStatus: KycStatus.ACTIVE,
      introVideoVerified: true,
      profilePictureUrl: null,
      introVideoUrl: "path/video.mp4",
    });
    mockPrisma.platformConfig.findUnique.mockResolvedValue(null);

    const result: any = await TutorService.getMyProfile("user-1");

    expect(result.needsIntroVideo).toBe(false);
  });

  it("is false while KYC is still incomplete/pending (not the right time to nag)", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({
      kycStatus: KycStatus.PENDING,
      introVideoVerified: false,
      profilePictureUrl: null,
      introVideoUrl: null,
    });
    mockPrisma.platformConfig.findUnique.mockResolvedValue(null);

    const result: any = await TutorService.getMyProfile("user-1");

    expect(result.needsIntroVideo).toBe(false);
  });
});

describe("TutorService.uploadIntroVideo", () => {
  it("rejects a video shorter than the configured minimum", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({ id: "profile-1" });
    mockPrisma.platformConfig.findUnique.mockResolvedValue({ value: 60 });
    (probeDurationSeconds as jest.Mock).mockResolvedValue(12);

    await expect(
      TutorService.uploadIntroVideo("user-1", file)
    ).rejects.toMatchObject(new AppError("tutor/errors:introVideoTooShort", 400));

    expect(MediaService.upload).not.toHaveBeenCalled();
  });

  it("accepts and marks introVideoVerified when duration meets the minimum", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({ id: "profile-1" });
    mockPrisma.platformConfig.findUnique.mockResolvedValue({ value: 60 });
    (probeDurationSeconds as jest.Mock).mockResolvedValue(75);
    (MediaService.upload as jest.Mock).mockResolvedValue([
      { fileId: "file-1", storagePath: "tutors/video.mp4" },
    ]);
    mockPrisma.tutorProfile.update.mockResolvedValue({
      introVideoUrl: "tutors/video.mp4",
      introVideoVerified: true,
      profilePictureUrl: null,
    });

    const result: any = await TutorService.uploadIntroVideo("user-1", file);

    expect(mockPrisma.tutorProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: { introVideoUrl: "tutors/video.mp4", introVideoVerified: true },
    });
    expect(result.introVideoVerified).toBe(true);
  });

  it("throws tutorProfileNotFound when the tutor has no profile yet", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue(null);

    await expect(
      TutorService.uploadIntroVideo("user-1", file)
    ).rejects.toMatchObject(new AppError("tutor/errors:tutorProfileNotFound", 404));
  });
});

describe("TutorService.getPublicProfile — intro video gate", () => {
  it("404s when kycStatus is ACTIVE but introVideoVerified is false", async () => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue(null); // where clause excludes it

    await expect(
      TutorService.getPublicProfile("tutor-1")
    ).rejects.toMatchObject(new AppError("tutor/errors:tutorProfileNotFound", 404));

    expect(mockPrisma.tutorProfile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kycStatus: KycStatus.ACTIVE,
          introVideoVerified: true,
        }),
      })
    );
  });
});

function tutorSubjectRow(overrides: Partial<any> = {}) {
  return {
    id: "ts-1",
    tutorProfileId: "profile-1",
    status: SubjectVerificationStatus.APPROVED,
    isOpenForBooking: true,
    ratePerOnlineHourXaf: null,
    ratePerHomeHourXaf: null,
    ...overrides,
  };
}

describe("TutorService.recomputeTutorRateRange", () => {
  it("does nothing when the profile has manually overridden its rate", async () => {
    mockPrisma.tutorProfile.findUnique.mockResolvedValue({ rateManuallySet: true });

    await TutorService.recomputeTutorRateRange("profile-1");

    expect(mockPrisma.tutorSubject.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.tutorProfile.update).not.toHaveBeenCalled();
  });

  it("does nothing when the profile no longer exists", async () => {
    mockPrisma.tutorProfile.findUnique.mockResolvedValue(null);

    await TutorService.recomputeTutorRateRange("profile-1");

    expect(mockPrisma.tutorProfile.update).not.toHaveBeenCalled();
  });

  it("picks the min/max across both hourly rates (online, home) on open+approved subjects", async () => {
    mockPrisma.tutorProfile.findUnique.mockResolvedValue({ rateManuallySet: false });
    mockPrisma.tutorSubject.findMany.mockResolvedValue([
      { ratePerOnlineHourXaf: 3000, ratePerHomeHourXaf: null },
      { ratePerOnlineHourXaf: 8000, ratePerHomeHourXaf: 10000 },
    ]);

    await TutorService.recomputeTutorRateRange("profile-1");

    expect(mockPrisma.tutorSubject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tutorProfileId: "profile-1",
          status: SubjectVerificationStatus.APPROVED,
          isOpenForBooking: true,
        },
      })
    );
    expect(mockPrisma.tutorProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: { minRateXaf: 3000, maxRateXaf: 10000 },
    });
  });

  it("resets both fields to null when there are no open, priced subjects", async () => {
    mockPrisma.tutorProfile.findUnique.mockResolvedValue({ rateManuallySet: false });
    mockPrisma.tutorSubject.findMany.mockResolvedValue([]);

    await TutorService.recomputeTutorRateRange("profile-1");

    expect(mockPrisma.tutorProfile.update).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: { minRateXaf: null, maxRateXaf: null },
    });
  });
});

describe("TutorService.updateSubjectPricing — open-for-booking gating", () => {
  beforeEach(() => {
    mockPrisma.tutorProfile.findFirst.mockResolvedValue({ id: "profile-1" });
    // Short-circuits the fire-and-forget recompute call in every test here —
    // its own behavior is covered above.
    mockPrisma.tutorProfile.findUnique.mockResolvedValue({ rateManuallySet: true });
  });

  it("rejects opening a subject that isn't APPROVED", async () => {
    mockPrisma.tutorSubject.findUnique.mockResolvedValue(
      tutorSubjectRow({ status: SubjectVerificationStatus.PENDING, isOpenForBooking: false, ratePerOnlineHourXaf: 3000 })
    );

    await expect(
      TutorService.updateSubjectPricing("user-1", "subject-1", { isOpenForBooking: true })
    ).rejects.toMatchObject(new AppError("tutor/errors:subjectMustBeApprovedToOpen", 400));
    expect(mockPrisma.tutorSubject.update).not.toHaveBeenCalled();
  });

  it("rejects opening a subject that has no rate configured yet", async () => {
    mockPrisma.tutorSubject.findUnique.mockResolvedValue(
      tutorSubjectRow({ isOpenForBooking: false })
    );

    await expect(
      TutorService.updateSubjectPricing("user-1", "subject-1", { isOpenForBooking: true })
    ).rejects.toMatchObject(new AppError("tutor/errors:subjectNeedsRateToOpen", 400));
    expect(mockPrisma.tutorSubject.update).not.toHaveBeenCalled();
  });

  it("allows opening when the rate arrives in the same request as the toggle", async () => {
    mockPrisma.tutorSubject.findUnique.mockResolvedValue(
      tutorSubjectRow({ isOpenForBooking: false })
    );
    mockPrisma.tutorSubject.update.mockResolvedValue(tutorSubjectRow({ ratePerOnlineHourXaf: 5000 }));

    await TutorService.updateSubjectPricing("user-1", "subject-1", {
      isOpenForBooking: true,
      ratePerOnlineHourXaf: 5000,
    });

    expect(mockPrisma.tutorSubject.update).toHaveBeenCalledWith({
      where: { id: "ts-1" },
      data: { isOpenForBooking: true, ratePerOnlineHourXaf: 5000 },
    });
  });

  it("allows opening when a rate was already set on a prior call", async () => {
    mockPrisma.tutorSubject.findUnique.mockResolvedValue(
      tutorSubjectRow({ isOpenForBooking: false, ratePerOnlineHourXaf: 4000 })
    );
    mockPrisma.tutorSubject.update.mockResolvedValue(tutorSubjectRow());

    await expect(
      TutorService.updateSubjectPricing("user-1", "subject-1", { isOpenForBooking: true })
    ).resolves.toBeDefined();
    expect(mockPrisma.tutorSubject.update).toHaveBeenCalled();
  });

  it("does not gate a plain rate update that leaves the subject closed", async () => {
    mockPrisma.tutorSubject.findUnique.mockResolvedValue(
      tutorSubjectRow({ status: SubjectVerificationStatus.PENDING, isOpenForBooking: false })
    );
    mockPrisma.tutorSubject.update.mockResolvedValue(tutorSubjectRow());

    await expect(
      TutorService.updateSubjectPricing("user-1", "subject-1", { ratePerHomeHourXaf: 6000 })
    ).resolves.toBeDefined();
    expect(mockPrisma.tutorSubject.update).toHaveBeenCalledWith({
      where: { id: "ts-1" },
      data: { ratePerHomeHourXaf: 6000 },
    });
  });
});
