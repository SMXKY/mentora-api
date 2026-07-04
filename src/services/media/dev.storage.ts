import fs from "fs";
import path from "path";
import { StorageAdapter } from "./storage.adapter";
import { assertSafeRelativePath } from "./storage.adapter";

const DEV_UPLOAD_DIR =
  process.env.DEV_UPLOAD_DIR || path.join(__dirname, "../../../local_uploads");
const DEV_BASE_URL = process.env.DEV_BASE_URL || "http://localhost:3000/uploads";

fs.mkdirSync(DEV_UPLOAD_DIR, { recursive: true });

function resolveWithinUploadDir(relativePath: string): string {
  assertSafeRelativePath(relativePath);
  const destPath = path.resolve(DEV_UPLOAD_DIR, relativePath);
  // Defense in depth: even a path that slipped past the segment check
  // must still land inside the upload root.
  if (!destPath.startsWith(path.resolve(DEV_UPLOAD_DIR) + path.sep)) {
    throw new Error(`Unsafe storage path: ${relativePath}`);
  }
  return destPath;
}

export class DevStorageAdapter implements StorageAdapter {
  async put(tempFilePath: string, relativePath: string): Promise<void> {
    const destPath = resolveWithinUploadDir(relativePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    await fs.promises.copyFile(tempFilePath, destPath);
  }

  async remove(relativePath: string): Promise<void> {
    const destPath = resolveWithinUploadDir(relativePath);
    try {
      await fs.promises.unlink(destPath);
    } catch (err: any) {
      // Missing file is fine; anything else is worth knowing about.
      if (err?.code !== "ENOENT") {
        console.error({
          event: "dev_storage_remove_failed",
          relativePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  resolveUrl(relativePath: string): string {
    return `${DEV_BASE_URL}/${relativePath.replace(/\\/g, "/")}`;
  }

  async fetchToTemp(relativePath: string, destTempPath: string): Promise<void> {
    const srcPath = resolveWithinUploadDir(relativePath);
    fs.mkdirSync(path.dirname(destTempPath), { recursive: true });
    await fs.promises.copyFile(srcPath, destTempPath);
  }
}
