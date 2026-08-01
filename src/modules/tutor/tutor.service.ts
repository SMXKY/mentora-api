import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  KycStatus,
  SubjectVerificationStatus,
  FileCategory,
  FileType,
} from "../../generated/prisma";
import { UpdateMyTutorProfileInput, UpdateSubjectPricingInput } from "./tutor.schema";
import { MaterialsService } from "../materials/materials.service";
import { resolveStorageUrl } from "../../services/media";
import { MediaService } from "../../services/media/media.service";
import { fileTypes } from "../../services/media/media.types";
import { probeDurationSeconds } from "../../services/media/mediaDuration.util";
import { getIntroVideoMinDurationSeconds } from "../../services/tutor/introVideoPolicy.service";
import { queueScoreRecompute } from "../../services/search/searchScore.processor";

// Both fields are stored as bare relative storage paths — resolve them to
// fetchable URLs through the active adapter on every read, never on write.
function withResolvedMediaUrls<
  T extends {
    profilePictureUrl?: string | null;
    introVideoUrl?: string | null;
    user?: { profilePictureUrl?: string | null };
  }
>(profile: T): T {
  return {
    ...profile,
    // The tutor's displayed avatar is always User.profilePictureUrl (the
    // one profile-photo upload flow every role shares) — TutorProfile's
    // own column is legacy/unused for display, never the source of truth.
    profilePictureUrl: resolveStorageUrl(profile.user?.profilePictureUrl ?? profile.profilePictureUrl),
    introVideoUrl: resolveStorageUrl(profile.introVideoUrl),
  };
}

/** Keeps TutorProfile.minRateXaf/maxRateXaf in sync with whatever the tutor
 * actually charges across their open, approved subjects — the min/max span
 * every non-null rate field (hourly, online flat fee, home flat fee) across
 * those rows. A no-op once the tutor has typed their own number
 * (rateManuallySet), and a no-op if the profile doesn't exist (e.g. called
 * from a KYC path before onboarding is complete). Called after any write
 * that could change a tutor's open+approved subject pricing — subject
 * pricing updates (tutor.service.ts) and subject approval/demotion
 * (kycAdmin.service.ts). */
async function recomputeTutorRateRange(tutorProfileId: string) {
  const profile = await prisma.tutorProfile.findUnique({
    where: { id: tutorProfileId },
    select: { rateManuallySet: true },
  });
  if (!profile || profile.rateManuallySet) return;

  const openSubjects = await prisma.tutorSubject.findMany({
    where: { tutorProfileId, status: SubjectVerificationStatus.APPROVED, isOpenForBooking: true },
    select: { ratePerHourXaf: true, ratePerOnlineSessionXaf: true, ratePerHomeSessionXaf: true },
  });

  const rates = openSubjects
    .flatMap((s) => [s.ratePerHourXaf, s.ratePerOnlineSessionXaf, s.ratePerHomeSessionXaf])
    .filter((r): r is number => r != null);

  await prisma.tutorProfile.update({
    where: { id: tutorProfileId },
    data: {
      minRateXaf: rates.length ? Math.min(...rates) : null,
      maxRateXaf: rates.length ? Math.max(...rates) : null,
    },
  });
}

const PUBLIC_TUTOR_SELECT = {
  id: true,
  bio: true,
  yearsOfExperience: true,
  teachingMode: true,
  languages: true,
  introVideoUrl: true,
  profilePictureUrl: true,
  responseRate: true,
  compositeScore: true,
  completedSessionsCount: true,
  minRateXaf: true,
  maxRateXaf: true,
  neighbourhood: true,
  createdAt: true,
  kycApprovedAt: true,
  city: { select: { id: true, name: true, region: { select: { id: true, name: true } } } },
  user: {
    select: {
      firstName: true,
      lastName: true,
      profilePictureUrl: true,
      ratingSnapshot: {
        select: { bayesianRating: true, rawAverage: true, totalReviewCount: true },
      },
    },
  },
  tutorSubjects: {
    where: { status: SubjectVerificationStatus.APPROVED, isOpenForBooking: true },
    select: {
      id: true,
      ratePerOnlineSessionXaf: true,
      ratePerHomeSessionXaf: true,
      ratePerHourXaf: true,
      subject: { select: { id: true, name: true, domain: { select: { name: true } } } },
      levels: { select: { level: { select: { id: true, name: true } } } },
    },
  },
  availabilitySlots: {
    where: { isActive: true },
    select: {
      id: true,
      slotType: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      specificDate: true,
    },
  },
} as const;

export const TutorService = {
  async getMyProfile(userId: string) {
    const profile = await prisma.tutorProfile.findFirst({
      where: { userId, deletedAt: null },
      include: {
        city: true,
        user: { select: { profilePictureUrl: true } },
        tutorSubjects: { include: { subject: true, levels: { include: { level: true } } } },
        credentials: { include: { subjectLinks: { include: { subject: true } } } },
      },
    });
    if (!profile) return profile;

    const introVideoMinDurationSeconds = await getIntroVideoMinDurationSeconds();
    // Only meaningful once KYC is otherwise done — this is the banner that
    // *replaces* the KYC banner, not an extra step layered onto it.
    const needsIntroVideo =
      (profile.kycStatus === KycStatus.ACTIVE ||
        profile.kycStatus === KycStatus.IDENTITY_APPROVED) &&
      !profile.introVideoVerified;

    return {
      ...withResolvedMediaUrls(profile),
      needsIntroVideo,
      introVideoMinDurationSeconds,
    };
  },

  /** The only way introVideoUrl/introVideoVerified are ever set — a plain
   * URL field on the general profile update was removed in favor of this,
   * since verifying "at least N seconds long" requires probing the actual
   * uploaded file, not trusting an arbitrary client-supplied URL. */
  async uploadIntroVideo(userId: string, file: Express.Multer.File) {
    const profile = await prisma.tutorProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!profile) {
      throw new AppError("tutor/errors:tutorProfileNotFound", StatusCodes.NOT_FOUND);
    }

    const minDurationSeconds = await getIntroVideoMinDurationSeconds();
    const durationSeconds = await probeDurationSeconds(file.path).catch(() => 0);
    if (durationSeconds < minDurationSeconds) {
      throw new AppError(
        "tutor/errors:introVideoTooShort",
        StatusCodes.BAD_REQUEST,
        { minDurationSeconds, durationSeconds }
      );
    }

    const [uploaded] = await MediaService.upload(
      [{ tempFilePath: file.path, originalFileName: file.originalname }],
      {
        uploadedById: userId,
        fileCategory: FileCategory.INTRO_VIDEO,
        fileType: FileType.VIDEO,
        allowedTypes: Object.values(fileTypes.video),
        maxSizeMB: 200,
      }
    );

    const updated = await prisma.tutorProfile.update({
      where: { id: profile.id },
      data: { introVideoUrl: uploaded.storagePath, introVideoVerified: true },
    });
    queueScoreRecompute(profile.id).catch(() => {});
    return withResolvedMediaUrls(updated);
  },

  /** Create-or-update — closes the exact gap KYC's completion gate needs:
   * there was no endpoint to create a TutorProfile at all before this. */
  async upsertMyProfile(userId: string, data: UpdateMyTutorProfileInput) {
    const existing = await prisma.tutorProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });

    // Typing a rate here is a deliberate override — from this point on,
    // recomputeTutorRateRange leaves it alone even as subject pricing changes.
    const data_ =
      data.minRateXaf !== undefined || data.maxRateXaf !== undefined
        ? { ...data, rateManuallySet: true }
        : data;

    if (existing) {
      const updated = await prisma.tutorProfile.update({ where: { id: existing.id }, data: data_ });
      queueScoreRecompute(existing.id).catch(() => {});
      return updated;
    }
    return prisma.tutorProfile.create({ data: { ...data_, userId } });
  },

  async updateSubjectPricing(
    userId: string,
    subjectId: string,
    data: UpdateSubjectPricingInput
  ) {
    const profile = await prisma.tutorProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    if (!profile) {
      throw new AppError("tutor/errors:tutorProfileNotFound", StatusCodes.NOT_FOUND);
    }

    const tutorSubject = await prisma.tutorSubject.findUnique({
      where: { tutorProfileId_subjectId: { tutorProfileId: profile.id, subjectId } },
    });
    if (!tutorSubject) {
      // A subject can only be priced once it's been claimed via a KYC
      // credential submission — pricing doesn't create the claim itself.
      throw new AppError("tutor/errors:subjectNotClaimed", StatusCodes.NOT_FOUND);
    }

    // isOpenForBooking gates real bookability, so opening it needs the
    // subject to actually be approved and actually priced — check against
    // the merged (existing + incoming) state, not just what's in this call.
    const willBeOpen = data.isOpenForBooking ?? tutorSubject.isOpenForBooking;
    if (willBeOpen) {
      if (tutorSubject.status !== SubjectVerificationStatus.APPROVED) {
        throw new AppError("tutor/errors:subjectMustBeApprovedToOpen", StatusCodes.BAD_REQUEST);
      }
      const hasRate =
        (data.ratePerOnlineSessionXaf ?? tutorSubject.ratePerOnlineSessionXaf) != null ||
        (data.ratePerHomeSessionXaf ?? tutorSubject.ratePerHomeSessionXaf) != null ||
        (data.ratePerHourXaf ?? tutorSubject.ratePerHourXaf) != null;
      if (!hasRate) {
        throw new AppError("tutor/errors:subjectNeedsRateToOpen", StatusCodes.BAD_REQUEST);
      }
    }

    const updated = await prisma.tutorSubject.update({ where: { id: tutorSubject.id }, data });
    recomputeTutorRateRange(profile.id).catch(() => {});
    return updated;
  },

  async getPublicProfile(tutorProfileId: string) {
    const profile = await prisma.tutorProfile.findFirst({
      where: {
        id: tutorProfileId,
        kycStatus: KycStatus.ACTIVE,
        introVideoVerified: true,
        deletedAt: null,
      },
      select: PUBLIC_TUTOR_SELECT,
    });
    if (!profile) {
      // Same 404 whether the id doesn't exist or the tutor isn't ACTIVE —
      // a suspended/pending tutor's existence is not public information.
      throw new AppError("tutor/errors:tutorProfileNotFound", StatusCodes.NOT_FOUND);
    }

    // Module 8.5 — Learning Materials: only reachable once the tutor is
    // confirmed ACTIVE above, so a KYC suspension/ban hides collections
    // immediately with no separate write needed (see getPublicLessonPlans).
    const lessonPlans = await MaterialsService.getPublicLessonPlans(tutorProfileId);

    return { ...withResolvedMediaUrls(profile), lessonPlans };
  },

  recomputeTutorRateRange,
};

export default TutorService;
