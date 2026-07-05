import { StorageAdapter } from "./storage.adapter";
import { DevStorageAdapter } from "./dev.storage";
import { FtpStorageAdapter } from "./ftp.storage";

let adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (adapter) return adapter;
  adapter =
    process.env.NODE_ENV === "production"
      ? new FtpStorageAdapter()
      : new DevStorageAdapter();
  return adapter;
}
