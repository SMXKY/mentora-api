import { Queue, Worker, Job } from "bullmq";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { PDFDocument } from "pdf-lib";
import prisma from "../../config/database.config";
import { getStorageAdapter } from ".";
import {
  FileType,
  FileVariantType,
  FileProcessingStatus,
} from "../../generated/prisma";
import { adjustUsage } from "./media.quota";

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
};

const QUEUE_NAME = "media-processing";
const PROCESS_JOB = "process";
const PURGE_JOB = "purge-deleted";
const PURGE_RETENTION_DAYS = 30;
const TEMP_DIR = path.join(os.tmpdir(), "media-processing");
fs.mkdirSync(TEMP_DIR, { recursive: true });

const fileProcessingQueue = new Queue(QUEUE_NAME, { connection });

export async function queueFileProcessing(fileId: string): Promise<void> {
  await fileProcessingQueue.add(
    PROCESS_JOB,
    { fileId },
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 10000 }, // 10s, 20s, 40s
      removeOnComplete: true,
      removeOnFail: { count: 1000 },
    }
  );
}

// Daily purge of soft-deleted files past the retention window. Repeatable
// job registration is idempotent — re-running this on every boot is safe.
fileProcessingQueue
  .add(
    PURGE_JOB,
    {},
    {
      repeat: { pattern: "0 3 * * *" },
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    }
  )
  .catch((err) => {
    console.error({
      event: "media_purge_schedule_failed",
      error: err instanceof Error ? err.message : String(err),
    });
  });

async function processImage(
  tempPath: string,
  outPath: string,
  mimeType: string
): Promise<void> {
  // Resize in the file's own format — the stored extension and recorded
  // mimeType must keep describing the actual bytes.
  const pipeline = sharp(tempPath).resize(800, 800, {
    fit: "inside",
    withoutEnlargement: true,
  });
  if (mimeType === "image/png") {
    await pipeline.png().toFile(outPath);
  } else if (mimeType === "image/webp") {
    await pipeline.webp({ quality: 85 }).toFile(outPath);
  } else {
    await pipeline.jpeg({ quality: 85 }).toFile(outPath);
  }
}

function transcodeVariant(
  inputPath: string,
  outputPath: string,
  resolution: "720p" | "360p"
): Promise<void> {
  const height = resolution === "720p" ? 720 : 360;
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec("libx264")
      .audioCodec("aac")
      .size(`?x${height}`)
      .outputOptions(["-movflags +faststart"])
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
}

async function validatePdf(tempPath: string): Promise<number> {
  const bytes = fs.readFileSync(tempPath);
  const doc = await PDFDocument.load(bytes); // throws if not a genuine PDF
  return doc.getPageCount();
}

// ffprobe (ships with the ffmpeg install the video pipeline already
// requires) both validates the audio file and reads its duration.
// music-metadata was dropped: it is ESM-only and cannot be loaded from
// this CommonJS codebase (ts-node and jest both fail on it).
function readAudioDuration(tempPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(tempPath, (err, data) => {
      if (err) return reject(err);
      resolve(Math.round(data.format?.duration ?? 0));
    });
  });
}

async function processFile(job: Job): Promise<void> {
  const { fileId } = job.data as { fileId: string };
  const start = Date.now();

  const file = await prisma.file.findUnique({ where: { id: fileId } });
  // A retry of a job that already finished must not process (and charge
  // quota for) the same file twice.
  if (!file || file.status === FileProcessingStatus.READY) return;

  await prisma.file.update({
    where: { id: fileId },
    data: {
      status: FileProcessingStatus.PROCESSING,
      processingStartedAt: new Date(),
    },
  });

  const storage = getStorageAdapter();
  const localTemp = path.join(
    TEMP_DIR,
    `${fileId}-${path.basename(file.storagePath)}`
  );

  try {
    await storage.fetchToTemp(file.storagePath, localTemp);
    const originalSize = fs.statSync(localTemp).size;
    // Size of the bytes living at the main storagePath after processing.
    let mainSize = originalSize;
    // Extra bytes stored beyond the original reservation (video variants).
    let extraStoredBytes = 0;

    switch (file.fileType) {
      case FileType.IMAGE: {
        const ext = path.extname(file.storagePath);
        const resizedTemp = `${localTemp}.resized${ext}`;
        await processImage(localTemp, resizedTemp, file.mimeType);
        await storage.put(resizedTemp, file.storagePath);
        mainSize = fs.statSync(resizedTemp).size;
        fs.unlinkSync(resizedTemp);
        break;
      }

      case FileType.VIDEO: {
        const variant720Temp = `${localTemp}.720p.mp4`;
        const variant360Temp = `${localTemp}.360p.mp4`;
        await transcodeVariant(localTemp, variant720Temp, "720p");
        await transcodeVariant(localTemp, variant360Temp, "360p");

        const path720 = file.storagePath.replace(/(\.[^.]+)$/, "-720p.mp4");
        const path360 = file.storagePath.replace(/(\.[^.]+)$/, "-360p.mp4");

        await storage.put(variant720Temp, path720);
        await storage.put(variant360Temp, path360);

        const size720 = fs.statSync(variant720Temp).size;
        const size360 = fs.statSync(variant360Temp).size;

        // Re-runs of this job must not duplicate variant rows.
        await prisma.fileVariant.deleteMany({ where: { fileId: file.id } });
        await prisma.fileVariant.createMany({
          data: [
            {
              fileId: file.id,
              variant: FileVariantType.VIDEO_720P,
              storagePath: path720,
              fileSizeBytes: BigInt(size720),
              status: FileProcessingStatus.READY,
            },
            {
              fileId: file.id,
              variant: FileVariantType.VIDEO_360P,
              storagePath: path360,
              fileSizeBytes: BigInt(size360),
              status: FileProcessingStatus.READY,
            },
          ],
        });

        // The original stays at storagePath; the variants are additional
        // stored bytes and must be added to the user's quota usage.
        extraStoredBytes = size720 + size360;

        fs.unlinkSync(variant720Temp);
        fs.unlinkSync(variant360Temp);
        break;
      }

      case FileType.DOCUMENT: {
        await validatePdf(localTemp);
        break;
      }

      case FileType.AUDIO: {
        await readAudioDuration(localTemp);
        break;
      }
    }

    // Reconcile quota: reservation was originalSize; actual stored bytes
    // are mainSize + extraStoredBytes.
    const delta = BigInt(mainSize + extraStoredBytes) - BigInt(originalSize);
    if (delta !== BigInt(0)) {
      await adjustUsage(file.uploadedById, delta);
    }

    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileProcessingStatus.READY,
        fileSizeBytes: BigInt(mainSize),
        processingCompletedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.file.update({
      where: { id: fileId },
      data: {
        status: FileProcessingStatus.FAILED,
        processingError: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  } finally {
    const duration = Date.now() - start;
    if (duration > 60000) {
      console.error({
        event: "media_processing_slow",
        fileId,
        durationMs: duration,
      });
    }
    try {
      fs.unlinkSync(localTemp);
    } catch {
      // already cleaned up
    }
  }
}

/**
 * Removes the bytes of files soft-deleted more than PURGE_RETENTION_DAYS
 * ago. The DB rows are kept (audit trail, FK targets) and marked with
 * purgedAt so they are never re-processed.
 */
async function purgeDeletedFiles(): Promise<void> {
  const cutoff = new Date(
    Date.now() - PURGE_RETENTION_DAYS * 24 * 60 * 60 * 1000
  );
  const files = await prisma.file.findMany({
    where: { deletedAt: { lt: cutoff }, purgedAt: null },
    select: {
      id: true,
      storagePath: true,
      variants: { select: { storagePath: true } },
    },
    take: 500,
  });

  const storage = getStorageAdapter();
  for (const file of files) {
    await storage.remove(file.storagePath);
    for (const variant of file.variants) {
      await storage.remove(variant.storagePath);
    }
    await prisma.file.update({
      where: { id: file.id },
      data: { purgedAt: new Date() },
    });
  }

  if (files.length > 0) {
    console.log({ event: "media_purge_completed", purged: files.length });
  }
}

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    if (job.name === PURGE_JOB) {
      return purgeDeletedFiles();
    }
    return processFile(job);
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error({
    event: "media_processing_failed",
    job: job?.name,
    fileId: job?.data?.fileId,
    attempt: job?.attemptsMade,
    error: err.message,
  });
});
