import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { KycStatus, SubjectVerificationStatus } from "../../generated/prisma";
import { UpdateMyTutorProfileInput, UpdateSubjectPricingInput } from "./tutor.schema";
import { MaterialsService } from "../materials/materials.service";
import { resolveStorageUrl } from "../../services/media";

// Both fields are stored as bare relative storage paths — resolve them to
// fetchable URLs through the active adapter on every read, never on write.
function withResolvedMediaUrls<
  T extends { profilePictureUrl?: string | null; introVideoUrl?: string | null }
>(profile: T): T {
  return {
    ...profile,
    profilePictureUrl: resolveStorageUrl(profile.profilePictureUrl),
    introVideoUrl: resolveStorageUrl(profile.introVideoUrl),
  };
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
  city: { select: { id: true, name: true, region: { select: { id: true, name: true } } } },
  tutorSubjects: {
    where: { status: SubjectVerificationStatus.APPROVED },
    select: {
      id: true,
      ratePerOnlineSessionXaf: true,
      ratePerHomeSessionXaf: true,
      subject: { select: { id: true, name: true, domain: { select: { name: true } } } },
    },
  },
} as const;

export const TutorService = {
  async getMyProfile(userId: string) {
    const profile = await prisma.tutorProfile.findFirst({
      where: { userId, deletedAt: null },
      include: {
        city: true,
        tutorSubjects: { include: { subject: true } },
        credentials: { include: { subjectLinks: { include: { subject: true } } } },
      },
    });
    return profile ? withResolvedMediaUrls(profile) : profile;
  },

  /** Create-or-update — closes the exact gap KYC's completion gate needs:
   * there was no endpoint to create a TutorProfile at all before this. */
  async upsertMyProfile(userId: string, data: UpdateMyTutorProfileInput) {
    const existing = await prisma.tutorProfile.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true },
    });

    if (existing) {
      return prisma.tutorProfile.update({ where: { id: existing.id }, data });
    }
    return prisma.tutorProfile.create({ data: { ...data, userId } });
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

    return prisma.tutorSubject.update({ where: { id: tutorSubject.id }, data });
  },

  async getPublicProfile(tutorProfileId: string) {
    const profile = await prisma.tutorProfile.findFirst({
      where: { id: tutorProfileId, kycStatus: KycStatus.ACTIVE, deletedAt: null },
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
};

export default TutorService;
