import { FileCategory, FileType } from "../../generated/prisma";

// ────────────────────────────────────────────────────────────
// fileTypes — the only place extension/MIME pairs are defined.
// Callers pass these instead of typing strings.
// ────────────────────────────────────────────────────────────
export const fileTypes = {
  image: {
    jpg: { ext: ".jpg", mime: "image/jpeg" },
    jpeg: { ext: ".jpeg", mime: "image/jpeg" },
    png: { ext: ".png", mime: "image/png" },
    webp: { ext: ".webp", mime: "image/webp" },
  },
  document: {
    pdf: { ext: ".pdf", mime: "application/pdf" },
  },
  audio: {
    mp3: { ext: ".mp3", mime: "audio/mpeg" },
    m4a: { ext: ".m4a", mime: "audio/mp4" },
    wav: { ext: ".wav", mime: "audio/wav" },
  },
  video: {
    mp4: { ext: ".mp4", mime: "video/mp4" },
    mov: { ext: ".mov", mime: "video/quicktime" },
  },
} as const;

export interface FileTypeSpec {
  ext: string;
  mime: string;
}

// ────────────────────────────────────────────────────────────
// Category → subfolder mapping. This is the ONLY place a
// physical folder name is decided. No caller ever builds a path.
// ────────────────────────────────────────────────────────────
export const categoryFolderMap: Record<FileCategory, string> = {
  PROFILE_PHOTO: "profile-photos",
  INTRO_VIDEO: "intro-videos",
  KYC_DOCUMENT: "kyc-documents",
  LESSON_NOTE: "lesson-notes",
  LESSON_AUDIO: "lesson-audio",
  LESSON_VIDEO: "lesson-videos",
  SESSION_RECORDING: "session-recordings",
  WHITEBOARD_EXPORT: "whiteboard-exports",
  RECEIPT: "receipts",
  DISPUTE_EVIDENCE: "dispute-evidence",
  MESSAGE_ATTACHMENT: "message-attachments",
};

export interface UploadInput {
  /** Optional caller-supplied id to correlate input/output order. Defaults to array index. */
  id?: string;
  /** Raw buffer or path to a temp file already on disk (e.g. from multer). */
  tempFilePath: string;
  /** Original filename as provided by the uploader, used to infer name/extension if not given. */
  originalFileName: string;
  /** Explicit filename override. If omitted, inferred from originalFileName. */
  fileName?: string;
}

export interface UploadOptions {
  uploadedById: string;
  fileCategory: FileCategory;
  fileType: FileType;
  allowedTypes: FileTypeSpec[];
  maxSizeMB: number;
  refTable?: string;
  refRecordId?: string;
}

export interface UploadResult {
  id: string; // caller-supplied id or index-based fallback
  fileId: string; // DB record id
  storagePath: string; // relative path, no base URL
}

export interface ReplaceOptions extends UploadOptions {
  fileId: string; // existing File record to replace
}

export const MEDIA_ERROR_KEYS = {
  noFileProvided: "media/errors:noFileProvided",
  invalidFileName: "media/errors:invalidFileName",
  invalidExtension: "media/errors:invalidExtension",
  invalidMimeType: "media/errors:invalidMimeType",
  fileTooLarge: "media/errors:fileTooLarge",
  virusDetected: "media/errors:virusDetected",
  scanUnavailable: "media/errors:scanUnavailable",
  quotaExceeded: "media/errors:quotaExceeded",
  fileNotFound: "media/errors:fileNotFound",
  disputeLocked: "media/errors:disputeLocked",
  processingFailed: "media/errors:processingFailed",
} as const;
