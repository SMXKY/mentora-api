import { BaseService } from "../../base/BaseService";
import { UserRepository } from "./user.repository";
import { ServiceContext } from "../../base/base.types";
import { CreateUserInput, UpdateUserInput } from "./user.types";
import prisma from "../../config/database.config";
import { MediaService } from "../../services/media/media.service";
import { getStorageAdapter } from "../../services/media";
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
}
