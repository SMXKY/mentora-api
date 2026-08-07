import { BaseService } from "../../base/BaseService";
import { UserRepository } from "./user.repository";
import { ServiceContext } from "../../base/base.types";
import { CreateUserInput, UpdateUserInput } from "./user.types";
import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { MediaService } from "../../services/media/media.service";
import { getStorageAdapter, resolveStorageUrl } from "../../services/media";
import { fileTypes } from "../../services/media/media.types";
import { FileCategory, FileType, BookingStatus, ReviewSubjectRole, ReviewStatus } from "../../generated/prisma";
import { toPublicLastNameInitial } from "../../utils/publicProfile.util";
import { ReviewService } from "../review/review.service";

// A session actually happened, past a bare paid-but-not-yet-run booking —
// same "real engagement" bar materials.service.ts uses for content access,
// minus the still-in-flight statuses (PAID/IN_PROGRESS/AWAITING_CONFIRMATION)
// since those haven't concluded yet.
const COMPLETED_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.AUTO_CONFIRMED,
  BookingStatus.RESOLVED_TUTOR_FAVOR,
  BookingStatus.RESOLVED_PARENT_FAVOR,
];

export class UserService extends BaseService<
  any,
  CreateUserInput,
  UpdateUserInput
> {
  protected repository = new UserRepository();
  protected tableName = "user";

  // ============================================================
  // LIFECYCLE HOOKS
  // Uncomment and implement as needed
  // ============================================================

  // protected async beforeCreate(data: CreateUserInput, ctx: ServiceContext) {
  //   // Enrich or validate data before insert
  //   // e.g. hash a password, generate a reference number
  //   return data
  // }

  // protected async afterCreate(record: any, ctx: ServiceContext) {
  //   // Side effects after successful insert
  //   // e.g. send notification, update a counter
  // }

  // protected async beforeUpdate(id: string, data: UpdateUserInput, ctx: ServiceContext) {
  //   // Modify data before update
  //   // e.g. strip fields the user should not change
  //   return data
  // }

  // protected async afterUpdate(record: any, ctx: ServiceContext) {
  //   // Side effects after successful update
  // }

  // protected async beforeDelete(id: string, ctx: ServiceContext) {
  //   // Run checks before deletion
  //   // e.g. check no active bookings exist before deleting a tutor
  // }

  // protected async afterDelete(record: any, ctx: ServiceContext) {
  //   // Side effects after deletion
  //   // e.g. release associated escrow, cancel scheduled jobs
  // }

  // ============================================================
  // CUSTOM METHODS
  // Add business logic methods here beyond standard CRUD
  // ============================================================

  /**
   * Replaces the caller's own avatar. Goes through MediaService so the
   * same virus scan / MIME sniffing / quota enforcement that protects
   * every other upload also protects this one — profile pictures are not
   * a special case. Any prior PROFILE_PHOTO files for this user are
   * soft-deleted after the new one lands, mirroring MediaService.replace's
   * own old-file-cleanup semantics.
   */
  async updateProfilePicture(
    userId: string,
    file: Express.Multer.File,
    ctx: ServiceContext
  ): Promise<{ url: string }> {
    const [uploaded] = await MediaService.upload(
      [{ tempFilePath: file.path, originalFileName: file.originalname }],
      {
        uploadedById: userId,
        fileCategory: FileCategory.PROFILE_PHOTO,
        fileType: FileType.IMAGE,
        allowedTypes: [
          fileTypes.image.jpg,
          fileTypes.image.jpeg,
          fileTypes.image.png,
          fileTypes.image.webp,
        ],
        maxSizeMB: 5,
      }
    );

    const previous = await prisma.file.findMany({
      where: {
        uploadedById: userId,
        fileCategory: FileCategory.PROFILE_PHOTO,
        id: { not: uploaded.fileId },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (previous.length > 0) {
      await MediaService.delete(
        previous.map((p) => p.id),
        { ownerId: userId }
      ).catch(() => {});
    }

    await prisma.user.update({
      where: { id: userId },
      data: { profilePictureUrl: uploaded.storagePath },
    });

    this.log(ctx, {
      operation: "UPDATE",
      category: "WRITE",
      recordId: userId,
      changedFields: ["profilePictureUrl"],
      newState: { profilePictureUrl: uploaded.storagePath },
    });

    return { url: getStorageAdapter().resolveUrl(uploaded.storagePath) };
  }

  /**
   * Cheap, cacheable self-profile fetch — core identity fields, roles, and
   * a lightweight tutor/student summary. Deliberately not a full data
   * dump: bookings, wallet, disputes, KYC history, risk scores, and
   * support tickets each have their own dedicated routes.
   */
  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: { where: { isActive: true }, include: { role: true } },
        tutorProfile: true,
        studentProfiles: { where: { userId, deletedAt: null }, take: 1 },
        city: { select: { id: true, name: true } }, // NEW
      },
    });

    if (!user || user.deletedAt) {
      throw new AppError("auth/errors:userNotFound", StatusCodes.NOT_FOUND);
    }

    const tutorProfile =
      user.tutorProfile && !user.tutorProfile.deletedAt
        ? {
            id: user.tutorProfile.id,
            bio: user.tutorProfile.bio,
            yearsOfExperience: user.tutorProfile.yearsOfExperience,
            teachingMode: user.tutorProfile.teachingMode,
            languages: user.tutorProfile.languages,
            kycStatus: user.tutorProfile.kycStatus,
            completedSessionsCount: user.tutorProfile.completedSessionsCount,
            cityId: user.tutorProfile.cityId,
            neighbourhood: user.tutorProfile.neighbourhood,
          }
        : null;

    const studentProfileRow = user.studentProfiles[0] ?? null;
    const studentProfile = studentProfileRow
      ? {
          id: studentProfileRow.id,
          firstName: studentProfileRow.firstName,
          levelId: studentProfileRow.levelId,
          schoolType: studentProfileRow.schoolType,
          preferredLanguage: studentProfileRow.preferredLanguage,
        }
      : null;

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      isEmailVerified: user.isEmailVerified,
      phoneNumber: user.phoneNumber,
      whatsappNumber: user.whatsappNumber,
      whatsappOptIn: user.whatsappOptIn,
      dob: user.dob,
      gender: user.gender,
      profilePictureUrl: resolveStorageUrl(user.profilePictureUrl),
      address: user.address,
      cityId: user.cityId, // NEW
      city: user.city, // NEW
      preferredLanguage: user.preferredLanguage,
      notificationsMuted: user.notificationsMuted,
      status: user.status,
      isAccountComplete: user.isAccountComplete,
      lastLoggedInAt: user.lastLoggedInAt,
      roles: user.userRoles.map((ur) => ur.role.name),
      tutorProfile,
      studentProfile,
    };
  }

  /**
   * A tutor-only, booking-or-conversation-gated profile of a student/parent
   * they're actually dealing with — never searchable, never reachable for a
   * tutor with no relationship to this person. Deliberately non-invasive:
   * no last name, phone, email, DOB, or address, and (for a parent) no
   * details about which children they manage beyond a headcount.
   *
   * Mirrors TutorService.getPublicProfile's "same 404 whether the target
   * doesn't exist or isn't accessible" — a booker's existence is not
   * information a tutor gets for free just by guessing a user id.
   */
  async getBookerProfile(viewerUserId: string, targetUserId: string) {
    const viewerTutorProfile = await prisma.tutorProfile.findFirst({
      where: { userId: viewerUserId, deletedAt: null },
      select: { id: true },
    });
    if (!viewerTutorProfile) {
      throw new AppError("common/errors:forbidden", StatusCodes.FORBIDDEN);
    }

    const [hasBooking, hasConversation] = await Promise.all([
      prisma.booking.findFirst({
        where: {
          bookerId: targetUserId,
          tutorProfileId: viewerTutorProfile.id,
          deletedAt: null,
        },
        select: { id: true },
      }),
      prisma.conversation.findFirst({
        where: {
          deletedAt: null,
          AND: [
            { participants: { some: { userId: viewerUserId, removedAt: null } } },
            { participants: { some: { userId: targetUserId, removedAt: null } } },
          ],
        },
        select: { id: true },
      }),
    ]);

    if (!hasBooking && !hasConversation) {
      throw new AppError("auth/errors:userNotFound", StatusCodes.NOT_FOUND);
    }

    const user = await prisma.user.findFirst({
      where: { id: targetUserId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePictureUrl: true,
        createdAt: true,
        city: {
          select: { id: true, name: true, region: { select: { id: true, name: true } } },
        },
        studentProfiles: {
          where: { deletedAt: null },
          take: 1,
          select: {
            subjects: { select: { subject: { select: { id: true, name: true } } } },
          },
        },
        studentProfilesGuarded: {
          where: { deletedAt: null },
          select: {
            subjects: { select: { subject: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (!user) {
      throw new AppError("auth/errors:userNotFound", StatusCodes.NOT_FOUND);
    }

    // A self-registered student always takes priority over "parent" — a
    // user can't simultaneously be a booking child and someone else's
    // guardian in this schema, but the ordering keeps intent explicit.
    const ownStudentProfile = user.studentProfiles[0] ?? null;
    const guardedProfiles = user.studentProfilesGuarded;
    const role: "STUDENT" | "PARENT" | null = ownStudentProfile
      ? "STUDENT"
      : guardedProfiles.length > 0
        ? "PARENT"
        : null;

    // For a parent, "their subjects" doesn't map to a field of their own —
    // it's the deduped union of what their children are learning.
    const subjectRows = ownStudentProfile
      ? ownStudentProfile.subjects
      : guardedProfiles.flatMap((p) => p.subjects);
    const subjects = Array.from(
      new Map(subjectRows.map((s) => [s.subject.id, s.subject])).values()
    );

    const subjectRole =
      role === "STUDENT"
        ? ReviewSubjectRole.STUDENT
        : role === "PARENT"
          ? ReviewSubjectRole.PARENT
          : null;

    const [sessionsCount, reviewsPage, reviewsCount] = await Promise.all([
      prisma.booking.count({
        where: {
          bookerId: targetUserId,
          status: { in: COMPLETED_BOOKING_STATUSES },
          deletedAt: null,
        },
      }),
      subjectRole
        ? ReviewService.listReviewsForSubject(targetUserId, subjectRole, undefined, 5)
        : Promise.resolve({ data: [] as unknown[] }),
      subjectRole
        ? prisma.review.count({
            where: {
              subjectId: targetUserId,
              subjectRole,
              status: ReviewStatus.REVEALED,
              deletedAt: null,
            },
          })
        : Promise.resolve(0),
    ]);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: toPublicLastNameInitial(user.lastName),
      profilePictureUrl: resolveStorageUrl(user.profilePictureUrl),
      city: user.city,
      memberSince: user.createdAt,
      role,
      subjects,
      studentsCount: role === "PARENT" ? guardedProfiles.length : null,
      sessionsCount,
      reviewsCount,
      reviews: reviewsPage.data,
    };
  }

  /**
   * Chat-only block — deliberately doesn't touch search results or booking
   * eligibility (see the UserBlock model comment). Enforcement lives in
   * MessagingService.sendMessage, which checks getBlockStatus for the
   * conversation's other participant on every send.
   */
  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new AppError("common/errors:forbidden", StatusCodes.BAD_REQUEST);
    }
    const target = await prisma.user.findFirst({
      where: { id: blockedId, deletedAt: null },
      select: { id: true },
    });
    if (!target) {
      throw new AppError("auth/errors:userNotFound", StatusCodes.NOT_FOUND);
    }
    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
    return { blocked: true };
  }

  async unblockUser(blockerId: string, blockedId: string) {
    await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
    return { blocked: false };
  }

  /** Direction-aware — the caller needs to know not just "is this pair
   * blocked" but which side did it, since the UI/error message differs
   * ("you blocked them" vs "they blocked you"). */
  async getBlockStatus(
    userIdA: string,
    userIdB: string
  ): Promise<{ blockedByA: boolean; blockedByB: boolean }> {
    const rows = await prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerId: userIdA, blockedId: userIdB },
          { blockerId: userIdB, blockedId: userIdA },
        ],
      },
      select: { blockerId: true },
    });
    return {
      blockedByA: rows.some((r) => r.blockerId === userIdA),
      blockedByB: rows.some((r) => r.blockerId === userIdB),
    };
  }
}
