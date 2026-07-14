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
import { FileCategory, FileType } from "../../generated/prisma";

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
        // Own self-registered profile only — a Parent's managed children
        // (studentProfilesGuarded, userId: null) are out of scope here.
        studentProfiles: { where: { userId, deletedAt: null }, take: 1 },
      },
    });

    if (!user || user.deletedAt) {
      // Defensive only — protect middleware already guarantees userId
      // resolves to a live user. Reuses auth's key: no user/errors
      // namespace exists yet and this is the same "session outlived the
      // account" case auth.service.ts guards against elsewhere.
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
}
