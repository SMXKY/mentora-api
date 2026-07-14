import { StorageAdapter } from "./storage.adapter";
import { DevStorageAdapter } from "./dev.storage";
import { FtpStorageAdapter } from "./ftp.storage";
import { CloudflareR2StorageAdapter } from "./cloudflare.sotrage";

let adapter: StorageAdapter | null = null;

function createAdapter(): StorageAdapter {
  switch (process.env.STORAGE_PROVIDER) {
    case "r2":
      return new CloudflareR2StorageAdapter();
    case "ftp":
      return new FtpStorageAdapter();
    case "dev":
      return new DevStorageAdapter();
  }

  return process.env.NODE_ENV === "production"
    ? new FtpStorageAdapter()
    : new DevStorageAdapter();
}

export function getStorageAdapter(): StorageAdapter {
  if (adapter) return adapter;
  adapter = createAdapter();
  return adapter;
}

/**
 * Resolves a stored relative path (e.g. "profile-photos/uuid.jpg") into a
 * fully qualified, fetchable URL through whichever adapter is currently
 * active (STORAGE_PROVIDER) — never hardcode a provider's base URL at a
 * call site, or the link breaks silently the moment the provider changes.
 */
export function resolveStorageUrl(
  relativePath: string | null | undefined
): string | null {
  if (!relativePath) return null;
  return getStorageAdapter().resolveUrl(relativePath);
}
