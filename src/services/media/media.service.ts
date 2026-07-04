import fs from "fs";
import path from "path";
import * as FileType from "file-type";
import { randomUUID } from "crypto";
import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { FileProcessingStatus, FileUploadType } from "../../generated/prisma";
import { getStorageAdapter } from ".";
import { scanFileOrThrow } from "./media.virusScan";
import { reserveQuota, adjustUsage } from "./media.quota";
import { queueFileProcessing } from "./media.processor";
import {
  MEDIA_ERROR_KEYS,
  UploadInput,
  UploadOptions,
  UploadResult,
  ReplaceOptions,
  categoryFolderMap,
} from "./media.types";

/**
 * A caller-supplied file name must be a bare name — no directory
 * separators, no traversal, no null bytes. The storage path is always
 * `<category-folder>/<name>` and nothing an uploader controls may
 * change which folder the bytes land in.
 */
function assertSafeFileName(fileName: string): void {
  if (
    fileName !== path.basename(fileName) ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes("\0")
  ) {
    throw new AppError(
      MEDIA_ERROR_KEYS.invalidFileName,
      StatusCodes.BAD_REQUEST
    );
  }
}

class MediaServiceClass {
  /**
   * Uploads one or many files. Always returns an array, in the same
   * order/id as the input. This is the only upload entry point.
   */
  async upload(
    files: UploadInput[],
    options: UploadOptions
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const input = files[i];
      const resolvedId = input.id ?? String(i);
      const uploaded = await this.uploadSingle(input, options);
      results.push({ ...uploaded, id: resolvedId });
    }

    return results;
  }

  private async uploadSingle(
    input: UploadInput,
    options: UploadOptions
  ): Promise<UploadResult> {
    const { tempFilePath, originalFileName } = input;

    // 1. Validate size
    const stats = fs.statSync(tempFilePath);
    const maxBytes = options.maxSizeMB * 1024 * 1024;
    if (stats.size > maxBytes) {
      throw new AppError(
        MEDIA_ERROR_KEYS.fileTooLarge,
        StatusCodes.BAD_REQUEST,
        {
          maxSizeMB: options.maxSizeMB,
        }
      );
    }

    // 2. Validate extension against caller-declared allowed types
    const ext = path.extname(originalFileName).toLowerCase();
    const matchedType = options.allowedTypes.find((t) => t.ext === ext);
    if (!matchedType) {
      throw new AppError(
        MEDIA_ERROR_KEYS.invalidExtension,
        StatusCodes.BAD_REQUEST,
        {
          allowed: options.allowedTypes.map((t) => t.ext),
        }
      );
    }

    // 3. Validate MIME from actual file content — never trust extension/header
    const detected = await FileType.fromFile(tempFilePath);
    const isAllowedMime = options.allowedTypes.some(
      (t) => t.mime === detected?.mime
    );
    if (!detected || !isAllowedMime) {
      throw new AppError(
        MEDIA_ERROR_KEYS.invalidMimeType,
        StatusCodes.BAD_REQUEST,
        {
          detected: detected?.mime ?? "unknown",
        }
      );
    }

    // 4. Virus scan — throws immediately, nothing else happens on infection
    await scanFileOrThrow(tempFilePath);

    // 5. Reserve quota atomically (pessimistic — pre-processing size).
    //    Everything after this must release the reservation on failure.
    await reserveQuota(options.uploadedById, stats.size);

    try {
      // 6. Build storage path — category folder, never caller-decided
      const folder = categoryFolderMap[options.fileCategory];
      if (input.fileName) assertSafeFileName(input.fileName);
      const fileName = input.fileName ?? `${randomUUID()}${ext}`;
      const relativePath = `${folder}/${fileName}`;

      // 7. Move bytes to permanent storage
      const storage = getStorageAdapter();
      await storage.put(tempFilePath, relativePath);

      // 8. Create the DB record — pending until processing pipeline finishes
      const record = await prisma.file.create({
        data: {
          uploadedById: options.uploadedById,
          originalFileName,
          storagePath: relativePath,
          fileCategory: options.fileCategory,
          fileType: options.fileType,
          mimeType: matchedType.mime,
          fileSizeBytes: BigInt(stats.size),
          uploadType: FileUploadType.SERVER_SIDE,
          status: FileProcessingStatus.PENDING,
          refTable: options.refTable,
          refRecordId: options.refRecordId,
        },
        select: { id: true },
      });

      // 9. Hand off to background pipeline
      await queueFileProcessing(record.id);

      return { id: "", fileId: record.id, storagePath: relativePath };
    } catch (err) {
      // Release the reservation — the bytes never became a live file.
      await adjustUsage(options.uploadedById, -BigInt(stats.size));
      throw err;
    }
  }

  /**
   * Replaces an existing file's bytes. The file must belong to
   * options.uploadedById — replacing someone else's file is a 404,
   * indistinguishable from the file not existing. Old file is
   * soft-deleted only after the new file has been confirmed in the DB.
   */
  async replace(
    input: UploadInput,
    options: ReplaceOptions
  ): Promise<UploadResult> {
    const existing = await prisma.file.findFirst({
      where: {
        id: options.fileId,
        uploadedById: options.uploadedById,
        deletedAt: null,
      },
      select: { id: true, isDisputeLocked: true, storagePath: true },
    });

    if (!existing) {
      throw new AppError(MEDIA_ERROR_KEYS.fileNotFound, StatusCodes.NOT_FOUND);
    }
    if (existing.isDisputeLocked) {
      throw new AppError(MEDIA_ERROR_KEYS.disputeLocked, StatusCodes.CONFLICT);
    }

    const uploaded = await this.uploadSingle(input, options);

    // Old file is only removed once the new one is confirmed in the DB.
    // Actual byte deletion happens through the standard delete path so
    // storage + quota bookkeeping stay in one place.
    await this.delete([existing.id], { skipDisputeCheck: true });

    return uploaded;
  }

  /**
   * Soft-deletes one or many files by id. When `ownerId` is given, only
   * files uploaded by that user are touched — ids belonging to anyone
   * else are treated as not found. Bytes are removed from permanent
   * storage by the scheduled purge job after the 30-day retention window.
   */
  async delete(
    fileIds: string[],
    opts: { skipDisputeCheck?: boolean; ownerId?: string } = {}
  ): Promise<void> {
    const files = await prisma.file.findMany({
      where: {
        id: { in: fileIds },
        deletedAt: null,
        ...(opts.ownerId && { uploadedById: opts.ownerId }),
      },
      select: {
        id: true,
        storagePath: true,
        isDisputeLocked: true,
        fileSizeBytes: true,
        uploadedById: true,
        variants: { select: { fileSizeBytes: true } },
      },
    });

    if (opts.ownerId && files.length !== fileIds.length) {
      throw new AppError(MEDIA_ERROR_KEYS.fileNotFound, StatusCodes.NOT_FOUND);
    }

    for (const file of files) {
      if (file.isDisputeLocked && !opts.skipDisputeCheck) {
        throw new AppError(
          MEDIA_ERROR_KEYS.disputeLocked,
          StatusCodes.CONFLICT,
          {
            fileId: file.id,
          }
        );
      }
    }

    for (const file of files) {
      await prisma.file.update({
        where: { id: file.id },
        data: { deletedAt: new Date() },
      });
      // Free the main file plus every processed variant from the quota.
      const totalBytes = file.variants.reduce(
        (sum, v) => sum + v.fileSizeBytes,
        file.fileSizeBytes
      );
      await adjustUsage(file.uploadedById, -totalBytes);
      // Bytes retained 30 days per policy — removal happens in the
      // scheduled purge job in media.processor.ts, not inline here.
    }
  }

  /**
   * Resolves a file id to a fully qualified, base-agnostic URL.
   * Base is applied fresh on every call — never stored.
   */
  async getFileUrl(fileId: string): Promise<string> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: { storagePath: true, deletedAt: true, status: true },
    });

    if (!file || file.deletedAt) {
      throw new AppError(MEDIA_ERROR_KEYS.fileNotFound, StatusCodes.NOT_FOUND);
    }

    const storage = getStorageAdapter();
    return storage.resolveUrl(file.storagePath);
  }
}

export const MediaService = new MediaServiceClass();
