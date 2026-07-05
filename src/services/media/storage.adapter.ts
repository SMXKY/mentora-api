/**
 * StorageAdapter is the only thing that knows HOW bytes get from
 * temp disk to permanent storage. MediaService never touches FTP,
 * the filesystem, or any SDK directly — only this interface.
 */
export interface StorageAdapter {
  /**
   * Move a local temp file to permanent storage at `relativePath`
   * (e.g. "kyc-documents/uuid-cni-front.jpg"). Returns nothing —
   * the relativePath IS the storagePath stored in the DB.
   */
  put(tempFilePath: string, relativePath: string): Promise<void>;

  /** Remove a file from permanent storage. Never throws on missing file. */
  remove(relativePath: string): Promise<void>;

  /**
   * Resolve a relative storagePath into a fully qualified URL using
   * whatever base is currently configured. Called on-demand, never stored.
   */
  resolveUrl(relativePath: string): string;

  /** Fetch a file from permanent storage down to a local temp path for processing. */
  fetchToTemp(relativePath: string, destTempPath: string): Promise<void>;
}

/**
 * Shared guard for every adapter: a relativePath is only ever
 * `<category-folder>/<file-name>` built by MediaService. Anything with
 * traversal segments, absolute roots, or null bytes is refused outright.
 */
export function assertSafeRelativePath(relativePath: string): void {
  const hasTraversal = relativePath
    .split(/[\\/]/)
    .some((segment) => segment === ".." || segment === "");
  if (
    hasTraversal ||
    relativePath.startsWith("/") ||
    relativePath.startsWith("\\") ||
    /^[a-zA-Z]:/.test(relativePath) ||
    relativePath.includes("\0")
  ) {
    throw new Error(`Unsafe storage path: ${relativePath}`);
  }
}
