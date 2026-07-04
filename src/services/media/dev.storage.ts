import fs from "fs";
import path from "path";
import { StorageAdapter } from "./storage.adapter";

const DEV_UPLOAD_DIR =
  process.env.DEV_UPLOAD_DIR || path.join(__dirname, "../../../local_uploads");
const DEV_BASE_URL = process.env.DEV_BASE_URL || "http://localhost:3000/uploads";

fs.mkdirSync(DEV_UPLOAD_DIR, { recursive: true });

export class DevStorageAdapter implements StorageAdapter {
  async put(tempFilePath: string, relativePath: string): Promise<void> {
    const destPath = path.join(DEV_UPLOAD_DIR, relativePath);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    await fs.promises.copyFile(tempFilePath, destPath);
  }

  async remove(relativePath: string): Promise<void> {
    const destPath = path.join(DEV_UPLOAD_DIR, relativePath);
    try {
      await fs.promises.unlink(destPath);
    } catch {
      // Already gone — not an error for our purposes.
    }
  }

  resolveUrl(relativePath: string): string {
    return `${DEV_BASE_URL}/${relativePath.replace(/\\/g, "/")}`;
  }

  async fetchToTemp(relativePath: string, destTempPath: string): Promise<void> {
    const srcPath = path.join(DEV_UPLOAD_DIR, relativePath);
    fs.mkdirSync(path.dirname(destTempPath), { recursive: true });
    await fs.promises.copyFile(srcPath, destTempPath);
  }
}
