# MediaService

## Why this exists

Every module that needs to store a file — profile photos, KYC documents, lesson materials, intro videos — used to be free to touch storage however it wanted. That's how you end up with inconsistent paths, no virus scanning on some routes, and no single place to fix things when the storage provider changes. `MediaService` closes that door: it is now the *only* way any part of the codebase touches file storage. No module should import the storage adapters or the AWS/FTP client directly.

## How it's built

The service is split into four layers, each with one job.

**`media.types.ts`** is the contract layer. It exports `fileTypes`, a fixed catalogue of extension/MIME pairs (`fileTypes.image.jpg`, `fileTypes.video.mp4`, etc.) so nobody ever types a raw string like `".jpg"` into a call site. It also holds `categoryFolderMap`, which is the single place that decides which physical folder a `FileCategory` lands in. Callers never construct a path — they just say what category the file belongs to, and the service resolves it.

**`storage/`** is the actual bytes layer. `storage.adapter.ts` defines a small interface — `put`, `remove`, `resolveUrl`, `fetchToTemp` — and `dev.storage.ts` / `ftp.storage.ts` each implement it for local disk and for Interserver's FTP respectively. `storage/index.ts` picks whichever one applies based on `NODE_ENV`. This is the layer that would change if you ever switched providers, and it's the only layer that would need to change — nothing above it knows or cares whether bytes are sitting on disk or on an FTP server.

Critically, **no URL is ever stored in the database.** Only the relative `storagePath` (e.g. `kyc-documents/uuid-front.jpg`) is saved. The base URL — dev's `localhost:3000/uploads` or production's FTP base — is resolved fresh every time `getFileUrl()` is called, by whichever adapter is active. If you migrate providers next year, every existing file record keeps working with zero data migration.

**`media.quota.ts`** handles per-user storage limits. It checks an `StorageQuotaOverride` first, falls back to the `StorageQuotaDefault` tied to the user's role, and finally a hardcoded floor if neither exists. Quota is checked twice per upload: once pessimistically against the raw incoming file size before any work happens, and once again after the background pipeline finishes shrinking or transcoding the file, so the final number reflects what's actually sitting in storage rather than what was uploaded.

**`media.virusScan.ts`** wraps ClamAV via a local clamd socket. It does exactly one thing: throw if the file is infected. There's no quarantine table, no partial state — an infected file never gets a database row and never touches permanent storage.

**`media.service.ts`** is the orchestrator everyone actually calls. `upload()` runs every file through, in order: size check, extension check against the caller's allowed list, content-sniffed MIME validation (never trusting the extension or `Content-Type` header), the virus scan, the quota check, the actual write to storage, and finally the database record creation as `PENDING`. Only after all of that does it hand the file off to the background queue.

**`media.processor.ts`** is that background queue, built on BullMQ. It pulls the temp file back down from storage, does the real work — resizing images to 800×800, transcoding video into 720p and 360p variants via ffmpeg, validating PDFs and counting pages, reading audio duration — then reconciles quota against the true final size and flips the file's status to `READY` or `FAILED`.

## How to use it

To upload one or more files, call `MediaService.upload()` with an array of inputs and one options object:

```ts
const results = await MediaService.upload(
  [
    { id: "front", tempFilePath: req.files[0].path, originalFileName: req.files[0].originalname },
    { id: "back", tempFilePath: req.files[1].path, originalFileName: req.files[1].originalname },
  ],
  {
    uploadedById: user.id,
    fileCategory: "KYC_DOCUMENT",
    fileType: "IMAGE",
    allowedTypes: [fileTypes.image.jpg, fileTypes.image.png],
    maxSizeMB: 10,
  }
);
```

The result array comes back in the same order, tagged with whatever `id` you passed in (`"front"`, `"back"`), so you can match results back to their source without relying on array position. Each result gives you a `fileId` — the database record — and a `storagePath`, though in practice you'll usually just store the `fileId` and call `MediaService.getFileUrl(fileId)` whenever you actually need to render or serve it.

A single file is just an array of one — there's no separate "upload one" method, since that would just be a thin wrapper duplicating the same logic.

Replacing a file works the same way but takes the existing `fileId`:

```ts
await MediaService.replace(
  { tempFilePath: newTemp.path, originalFileName: newTemp.originalname },
  { fileId: existingFile.id, uploadedById: user.id, fileCategory: "PROFILE_PHOTO", fileType: "IMAGE", allowedTypes: [fileTypes.image.jpg], maxSizeMB: 5 }
);
```

The new file goes through the full pipeline first; the old one is only removed once the new one is confirmed in the database, so a failed replace never leaves a user with no file at all.

Deleting is just:

```ts
await MediaService.delete([fileId1, fileId2]);
```

It soft-deletes — bytes stay in storage for the 30-day retention window, and any file tied to an active dispute will throw rather than delete, unless the call explicitly opts out of that check (which only the internal `replace()` flow does, for its own old-file cleanup).

## What you don't need to worry about

You never build a file path, never touch the FTP client or the filesystem directly, and never store a URL. If Interserver ever gets swapped for something else, only the `storage/` folder changes — every caller, every database row, and every existing `getFileUrl()` call keeps working exactly as before.