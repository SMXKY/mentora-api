import { Queue, Worker, Job } from "bullmq";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { parseFile as parseAudioFile } from "music-metadata";
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
const TEMP_DIR = path.join(os.tmpdir(), "media-processing");
fs.mkdirSync(TEMP_DIR, { recursive: true });

const fileProcessingQueue = new Queue(QUEUE_NAME, { connection });

export async function queueFileProcessing(fileId: string): Promise<void> {
  await fileProcessingQueue.add(
    "process",
    { fileId },
    { attempts: 1, removeOnComplete: true, removeOnFail: false }
  );
}

async function processImage(tempPath: string, outPath: string): Promise<void> {
  await sharp(tempPath)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .toFormat("jpeg", { quality: 85 })
    .toFile(outPath);
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

async function readAudioDuration(tempPath: string): Promise<number> {
  const meta = await parseAudioFile(tempPath);
  return Math.round(meta.format.duration ?? 0);
}

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { fileId } = job.data as { fileId: string };
    const start = Date.now();

    const file = await prisma.file.findUnique({ where: { id: fileId } });
    if (!file) return;

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
      let finalSize = originalSize;

      switch (file.fileType) {
        case FileType.IMAGE: {
          const resizedTemp = `${localTemp}.resized.jpg`;
          await processImage(localTemp, resizedTemp);
          await storage.put(resizedTemp, file.storagePath);
          finalSize = fs.statSync(resizedTemp).size;
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

          await prisma.fileVariant.createMany({
            data: [
              {
                fileId: file.id,
                variant: FileVariantType.VIDEO_720P,
                storagePath: path720,
                fileSizeBytes: BigInt(fs.statSync(variant720Temp).size),
                status: FileProcessingStatus.READY,
              },
              {
                fileId: file.id,
                variant: FileVariantType.VIDEO_360P,
                storagePath: path360,
                fileSizeBytes: BigInt(fs.statSync(variant360Temp).size),
                status: FileProcessingStatus.READY,
              },
            ],
          });

          finalSize =
            fs.statSync(variant720Temp).size + fs.statSync(variant360Temp).size;

          fs.unlinkSync(variant720Temp);
          fs.unlinkSync(variant360Temp);
          break;
        }

        case FileType.DOCUMENT: {
          const pageCount = await validatePdf(localTemp);
          await prisma.file.update({
            where: { id: fileId },
            data: { processingCompletedAt: new Date() },
          });
          // pageCount stored via a dedicated column if added to schema;
          // for now attach through processingError-free completion.
          void pageCount;
          break;
        }

        case FileType.AUDIO: {
          await readAudioDuration(localTemp);
          break;
        }
      }

      // Reconcile quota: remove the pessimistic reservation, add true final size
      const delta = BigInt(finalSize) - BigInt(originalSize);
      if (delta !== BigInt(0)) {
        await adjustUsage(file.uploadedById, delta);
      }

      await prisma.file.update({
        where: { id: fileId },
        data: {
          status: FileProcessingStatus.READY,
          fileSizeBytes: BigInt(finalSize),
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
        // eslint-disable-next-line no-console
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
  },
  { connection }
);

worker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error({
    event: "media_processing_failed",
    fileId: job?.data?.fileId,
    error: err.message,
  });
});
