/**
 * MediaService integration test — runs against the REAL storage adapter
 * chosen by NODE_ENV:
 *
 *   NODE_ENV=development → DevStorageAdapter (local filesystem)
 *   NODE_ENV=production  → FtpStorageAdapter (real FTP credentials from .env)
 *
 * Both runs must pass independently:
 *   npm run test:integration:media:dev
 *   npm run test:integration:media:prod
 *
 * Requires: Postgres (DATABASE_URL) and Redis (REDIS_HOST/PORT or local
 * default) to be reachable. Virus scanning is skipped automatically in dev
 * when clamd is absent; the prod script sets CLAMAV_ENABLED=false explicitly.
 */
import "dotenv/config";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import prisma from "../src/config/database.config";
import { MediaService } from "../src/services/media/media.service";
import { getStorageAdapter } from "../src/services/media";
import {
  fileTypes,
  MEDIA_ERROR_KEYS,
  UploadOptions,
} from "../src/services/media/media.types";
import { FileCategory, FileType } from "../src/generated/prisma";
import { AppError } from "../src/utils/AppError.util";

jest.setTimeout(120000);

// 1x1 red-pixel PNG — a genuine PNG that passes magic-byte sniffing.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const TEMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "media-int-test-"));

function writeTemp(name: string, content: Buffer): string {
  const p = path.join(TEMP_DIR, `${randomUUID()}-${name}`);
  fs.writeFileSync(p, content);
  return p;
}

function baseOptions(userId: string): UploadOptions {
  return {
    uploadedById: userId,
    fileCategory: FileCategory.PROFILE_PHOTO,
    fileType: FileType.IMAGE,
    allowedTypes: [fileTypes.image.png, fileTypes.image.jpg],
    maxSizeMB: 1,
  };
}

async function expectAppError(
  promise: Promise<unknown>,
  messageKey: string
): Promise<void> {
  await expect(promise).rejects.toMatchObject({ messageKey });
  await promise.catch((err) => expect(err).toBeInstanceOf(AppError));
}

async function waitForStatus(
  fileId: string,
  status: "READY" | "FAILED",
  timeoutMs = 60000
): Promise<void> {
  const start = Date.now();
  for (;;) {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: { status: true, processingError: true },
    });
    if (file?.status === status) return;
    if (file?.status === "FAILED" && status !== "FAILED") {
      throw new Error(`Processing failed: ${file.processingError}`);
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timed out waiting for file ${fileId} to reach ${status} (now: ${file?.status})`
      );
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function usedBytes(userId: string): Promise<bigint> {
  const usage = await prisma.storageUsage.findUnique({ where: { userId } });
  return usage?.usedBytes ?? BigInt(0);
}

describe(`MediaService integration (${process.env.NODE_ENV} adapter)`, () => {
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `media-int-${Date.now()}@mentora.test` },
      select: { id: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Best-effort cleanup of storage bytes, then all DB rows for this user.
    const files = await prisma.file.findMany({
      where: { uploadedById: userId },
      select: { storagePath: true, variants: { select: { storagePath: true } } },
    });
    const storage = getStorageAdapter();
    for (const f of files) {
      await storage.remove(f.storagePath).catch(() => undefined);
      for (const v of f.variants) {
        await storage.remove(v.storagePath).catch(() => undefined);
      }
    }
    await prisma.fileVariant.deleteMany({
      where: { file: { uploadedById: userId } },
    });
    await prisma.file.deleteMany({ where: { uploadedById: userId } });
    await prisma.storageUsage.deleteMany({ where: { userId } });
    await prisma.storageQuotaOverride.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it("uploads a valid file, stores retrievable bytes, and processes to READY", async () => {
    const tempPath = writeTemp("avatar.png", TINY_PNG);
    const [result] = await MediaService.upload(
      [{ tempFilePath: tempPath, originalFileName: "avatar.png" }],
      baseOptions(userId)
    );

    expect(result.fileId).toBeTruthy();
    expect(result.storagePath).toMatch(/^profile-photos\//);

    // Bytes must be genuinely retrievable from the active adapter —
    // this is what differs between the dev and FTP code paths.
    const roundTrip = path.join(TEMP_DIR, `${randomUUID()}-roundtrip.png`);
    await getStorageAdapter().fetchToTemp(result.storagePath, roundTrip);
    expect(fs.statSync(roundTrip).size).toBe(TINY_PNG.length);

    await waitForStatus(result.fileId, "READY");
    const record = await prisma.file.findUnique({
      where: { id: result.fileId },
    });
    expect(record?.status).toBe("READY");
    expect(record?.mimeType).toBe("image/png");
  });

  it("uploads multiple files preserving order and correlation ids", async () => {
    const results = await MediaService.upload(
      [
        {
          id: "first",
          tempFilePath: writeTemp("a.png", TINY_PNG),
          originalFileName: "a.png",
        },
        {
          id: "second",
          tempFilePath: writeTemp("b.png", TINY_PNG),
          originalFileName: "b.png",
        },
      ],
      baseOptions(userId)
    );
    expect(results.map((r) => r.id)).toEqual(["first", "second"]);
    expect(new Set(results.map((r) => r.fileId)).size).toBe(2);
  });

  it("rejects a disallowed extension", async () => {
    await expectAppError(
      MediaService.upload(
        [
          {
            tempFilePath: writeTemp("notes.txt", Buffer.from("hello")),
            originalFileName: "notes.txt",
          },
        ],
        baseOptions(userId)
      ),
      MEDIA_ERROR_KEYS.invalidExtension
    );
  });

  it("rejects a file whose real content does not match its extension", async () => {
    await expectAppError(
      MediaService.upload(
        [
          {
            tempFilePath: writeTemp(
              "fake.png",
              Buffer.from("this is not an image at all")
            ),
            originalFileName: "fake.png",
          },
        ],
        baseOptions(userId)
      ),
      MEDIA_ERROR_KEYS.invalidMimeType
    );
  });

  it("rejects a file over the declared size cap", async () => {
    const oversized = Buffer.concat([TINY_PNG, Buffer.alloc(2 * 1024 * 1024)]);
    await expectAppError(
      MediaService.upload(
        [
          {
            tempFilePath: writeTemp("big.png", oversized),
            originalFileName: "big.png",
          },
        ],
        baseOptions(userId)
      ),
      MEDIA_ERROR_KEYS.fileTooLarge
    );
  });

  it("rejects a caller-supplied fileName containing path traversal", async () => {
    await expectAppError(
      MediaService.upload(
        [
          {
            tempFilePath: writeTemp("evil.png", TINY_PNG),
            originalFileName: "evil.png",
            fileName: "../../outside.png",
          },
        ],
        baseOptions(userId)
      ),
      MEDIA_ERROR_KEYS.invalidFileName
    );
  });

  it("enforces the storage quota atomically and releases nothing on rejection", async () => {
    // Dedicated user so reconciliation noise from other tests can't interfere.
    const quotaUser = await prisma.user.create({
      data: { email: `media-quota-${Date.now()}@mentora.test` },
      select: { id: true },
    });
    try {
      await prisma.storageQuotaOverride.create({
        data: {
          userId: quotaUser.id,
          quotaLimitBytes: BigInt(10), // smaller than any real file
          grantedById: quotaUser.id,
          reason: "integration test",
        },
      });

      await expectAppError(
        MediaService.upload(
          [
            {
              tempFilePath: writeTemp("q.png", TINY_PNG),
              originalFileName: "q.png",
            },
          ],
          baseOptions(quotaUser.id)
        ),
        MEDIA_ERROR_KEYS.quotaExceeded
      );

      // The failed reservation must not leave phantom usage behind.
      expect(await usedBytes(quotaUser.id)).toBe(BigInt(0));
    } finally {
      await prisma.storageQuotaOverride.deleteMany({
        where: { userId: quotaUser.id },
      });
      await prisma.storageUsage.deleteMany({ where: { userId: quotaUser.id } });
      await prisma.user.delete({ where: { id: quotaUser.id } });
    }
  });

  it("replaces a file: new record live, old record soft-deleted", async () => {
    const [original] = await MediaService.upload(
      [
        {
          tempFilePath: writeTemp("orig.png", TINY_PNG),
          originalFileName: "orig.png",
        },
      ],
      baseOptions(userId)
    );
    await waitForStatus(original.fileId, "READY");

    const replacement = await MediaService.replace(
      {
        tempFilePath: writeTemp("new.png", TINY_PNG),
        originalFileName: "new.png",
      },
      { ...baseOptions(userId), fileId: original.fileId }
    );

    expect(replacement.fileId).not.toBe(original.fileId);
    const oldRecord = await prisma.file.findUnique({
      where: { id: original.fileId },
      select: { deletedAt: true },
    });
    expect(oldRecord?.deletedAt).not.toBeNull();
    const newRecord = await prisma.file.findUnique({
      where: { id: replacement.fileId },
      select: { deletedAt: true },
    });
    expect(newRecord?.deletedAt).toBeNull();
  });

  it("refuses to replace a file owned by someone else", async () => {
    const [mine] = await MediaService.upload(
      [
        {
          tempFilePath: writeTemp("mine.png", TINY_PNG),
          originalFileName: "mine.png",
        },
      ],
      baseOptions(userId)
    );
    const stranger = await prisma.user.create({
      data: { email: `media-stranger-${Date.now()}@mentora.test` },
      select: { id: true },
    });
    try {
      await expectAppError(
        MediaService.replace(
          {
            tempFilePath: writeTemp("theirs.png", TINY_PNG),
            originalFileName: "theirs.png",
          },
          { ...baseOptions(stranger.id), fileId: mine.fileId }
        ),
        MEDIA_ERROR_KEYS.fileNotFound
      );
    } finally {
      await prisma.storageUsage.deleteMany({ where: { userId: stranger.id } });
      await prisma.user.delete({ where: { id: stranger.id } });
    }
  });

  it("soft-deletes a file, frees its quota, and refuses cross-owner deletes", async () => {
    const [victim] = await MediaService.upload(
      [
        {
          tempFilePath: writeTemp("del.png", TINY_PNG),
          originalFileName: "del.png",
        },
      ],
      baseOptions(userId)
    );
    await waitForStatus(victim.fileId, "READY");

    const before = await usedBytes(userId);
    await expectAppError(
      MediaService.delete([victim.fileId], { ownerId: randomUUID() }),
      MEDIA_ERROR_KEYS.fileNotFound
    );

    await MediaService.delete([victim.fileId], { ownerId: userId });
    const record = await prisma.file.findUnique({
      where: { id: victim.fileId },
      select: { deletedAt: true },
    });
    expect(record?.deletedAt).not.toBeNull();
    expect(await usedBytes(userId)).toBeLessThan(before);
  });

  it("resolves a live file to a URL and 404s a deleted one", async () => {
    const [live] = await MediaService.upload(
      [
        {
          tempFilePath: writeTemp("url.png", TINY_PNG),
          originalFileName: "url.png",
        },
      ],
      baseOptions(userId)
    );

    const url = await MediaService.getFileUrl(live.fileId);
    expect(url).toContain(live.storagePath.replace(/\\/g, "/"));
    expect(url).toMatch(/^https?:\/\//);

    await MediaService.delete([live.fileId], { ownerId: userId });
    await expectAppError(
      MediaService.getFileUrl(live.fileId),
      MEDIA_ERROR_KEYS.fileNotFound
    );
  });
});
