import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import prisma from "../../config/database.config";
import { MediaService } from "../../services/media/media.service";
import {
  fileTypes,
  FileTypeSpec,
  UploadOptions,
  UploadResult,
  MEDIA_ERROR_KEYS,
} from "../../services/media/media.types";
import { FileCategory, FileType } from "../../generated/prisma";

const images = Object.values(fileTypes.image);
const videos = Object.values(fileTypes.video);
const audio = Object.values(fileTypes.audio);
const pdf = [fileTypes.document.pdf];

// Per-category constraints are decided here, server-side — an HTTP caller
// never chooses its own allowed types or size ceiling.
export const uploadPolicies: Record<
  FileCategory,
  { allowedTypes: FileTypeSpec[]; maxSizeMB: number }
> = {
  PROFILE_PHOTO: { allowedTypes: images, maxSizeMB: 5 },
  INTRO_VIDEO: { allowedTypes: videos, maxSizeMB: 200 },
  KYC_DOCUMENT: { allowedTypes: [...images, ...pdf], maxSizeMB: 10 },
  LESSON_NOTE: { allowedTypes: pdf, maxSizeMB: 20 },
  LESSON_AUDIO: { allowedTypes: audio, maxSizeMB: 50 },
  LESSON_VIDEO: { allowedTypes: videos, maxSizeMB: 500 },
  SESSION_RECORDING: { allowedTypes: videos, maxSizeMB: 500 },
  WHITEBOARD_EXPORT: { allowedTypes: [...images, ...pdf], maxSizeMB: 20 },
  RECEIPT: { allowedTypes: [...images, ...pdf], maxSizeMB: 10 },
  DISPUTE_EVIDENCE: {
    allowedTypes: [...images, ...pdf, ...videos, ...audio],
    maxSizeMB: 100,
  },
  MESSAGE_ATTACHMENT: {
    allowedTypes: [...images, ...pdf, ...audio],
    maxSizeMB: 25,
  },
};

const fileTypeFromMime = (mime: string): FileType =>
  mime.startsWith("image/")
    ? FileType.IMAGE
    : mime.startsWith("video/")
    ? FileType.VIDEO
    : mime.startsWith("audio/")
    ? FileType.AUDIO
    : FileType.DOCUMENT;

function buildUploadOptions(
  fileCategory: FileCategory,
  file: Express.Multer.File,
  uploadedById: string,
  ref: { refTable?: string; refRecordId?: string } = {}
): UploadOptions {
  const policy = uploadPolicies[fileCategory];
  const ext = path.extname(file.originalname).toLowerCase();
  const matched = policy.allowedTypes.find((t) => t.ext === ext);
  return {
    uploadedById,
    fileCategory,
    fileType: fileTypeFromMime(matched?.mime ?? ""),
    allowedTypes: policy.allowedTypes,
    maxSizeMB: policy.maxSizeMB,
    ...ref,
  };
}

function requireFiles(req: Request): Express.Multer.File[] {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) {
    throw new AppError(MEDIA_ERROR_KEYS.noFileProvided, StatusCodes.BAD_REQUEST);
  }
  return files;
}

function requireFile(req: Request): Express.Multer.File {
  if (!req.file) {
    throw new AppError(MEDIA_ERROR_KEYS.noFileProvided, StatusCodes.BAD_REQUEST);
  }
  return req.file;
}

async function cleanupTemp(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(
    files.map((f) => fs.promises.unlink(f.path).catch(() => undefined))
  );
}

/** Every mutation on an existing file is scoped to its uploader. */
async function assertOwnedFile(fileId: string, userId: string) {
  const file = await prisma.file.findFirst({
    where: { id: fileId, uploadedById: userId, deletedAt: null },
    select: { id: true, fileCategory: true },
  });
  if (!file) {
    throw new AppError(MEDIA_ERROR_KEYS.fileNotFound, StatusCodes.NOT_FOUND);
  }
  return file;
}

async function uploadAll(
  files: Express.Multer.File[],
  userId: string,
  body: { fileCategory: FileCategory; refTable?: string; refRecordId?: string }
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const options = buildUploadOptions(body.fileCategory, files[i], userId, {
      refTable: body.refTable,
      refRecordId: body.refRecordId,
    });
    const [result] = await MediaService.upload(
      [
        {
          id: String(i),
          tempFilePath: files[i].path,
          originalFileName: files[i].originalname,
        },
      ],
      options
    );
    results.push({ ...result, id: String(i) });
  }
  return results;
}

export const mediaController = {
  upload: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const files = requireFiles(req);
    try {
      const results = await uploadAll(files, ctx.userId!, req.body);
      appResponder(StatusCodes.CREATED, results, res);
    } finally {
      await cleanupTemp(files);
    }
  }),

  replace: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const file = requireFile(req);
    try {
      const existing = await assertOwnedFile(req.params.id, ctx.userId!);
      const options = buildUploadOptions(existing.fileCategory, file, ctx.userId!);
      const result = await MediaService.replace(
        { tempFilePath: file.path, originalFileName: file.originalname },
        { ...options, fileId: existing.id }
      );
      appResponder(StatusCodes.OK, result, res);
    } finally {
      await cleanupTemp([file]);
    }
  }),

  remove: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    await MediaService.delete([req.params.id], { ownerId: ctx.userId! });
    appResponder(StatusCodes.OK, { deleted: true }, res);
  }),

  getUrl: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const existing = await assertOwnedFile(req.params.id, ctx.userId!);
    const url = await MediaService.getFileUrl(existing.id);
    appResponder(StatusCodes.OK, { url }, res);
  }),
};

export default mediaController;
