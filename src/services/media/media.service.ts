import fs from "fs";
import path from "path";
import * as FileType from "file-type";
import { v4 as uuidv4 } from "uuid";
import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { FileProcessingStatus, FileUploadType } from "../../generated/prisma";
import { getStorageAdapter } from ".";
import { scanFileOrThrow } from "./media.virusScan";
import { assertWithinQuota, adjustUsage } from "./media.quota";
import { queueFileProcessing } from "./media.processor";
import {
  MEDIA_ERROR_KEYS,
  UploadInput,
  UploadOptions,
  UploadResult,
  ReplaceOptions,
  categoryFolderMap,
  FileTypeSpec,
} from "./media.types";

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
      const fileId = await this.uploadSingle(input, options);
      results.push(fileId);
      results[results.length - 1] = { ...fileId, id: resolvedId };
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

    // 5. Quota check (pessimistic — pre-processing size)
    await assertWithinQuota(options.uploadedById, stats.size);

    // 6. Build storage path — category folder, never caller-decided
    const folder = categoryFolderMap[options.fileCategory];
    const fileName = input.fileName ?? `${uuidv4()}${ext}`;
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

    // 9. Reserve quota now; reconciled to true size after processing
    await adjustUsage(options.uploadedById, BigInt(stats.size));

    // 10. Hand off to background pipeline
    await queueFileProcessing(record.id);

    return { id: "", fileId: record.id, storagePath: relativePath };
  }

  /**
   * Replaces an existing file's bytes. Old file is soft-deleted only
   * after the new file has been confirmed ready by the pipeline.
   */
  async replace(
    input: UploadInput,
    options: ReplaceOptions
  ): Promise<UploadResult> {
    const existing = await prisma.file.findUnique({
      where: { id: options.fileId },
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
   * Soft-deletes one or many files by id. Bytes are removed from
   * permanent storage only after the DB record is marked deleted.
   */
  async delete(
    fileIds: string[],
    opts: { skipDisputeCheck?: boolean } = {}
  ): Promise<void> {
    const files = await prisma.file.findMany({
      where: { id: { in: fileIds } },
      select: {
        id: true,
        storagePath: true,
        isDisputeLocked: true,
        fileSizeBytes: true,
        uploadedById: true,
      },
    });

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

    const storage = getStorageAdapter();

    for (const file of files) {
      await prisma.file.update({
        where: { id: file.id },
        data: { deletedAt: new Date() },
      });
      await adjustUsage(file.uploadedById, BigInt(-Number(file.fileSizeBytes)));
      // Bytes retained 30 days per policy — actual removal is a scheduled
      // hard-delete job, not done inline here.
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
