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
