import NodeClam from "clamscan";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { MEDIA_ERROR_KEYS } from "./media.types";

let scannerPromise: Promise<any> | null = null;

function getScanner(): Promise<any> {
  const existing = scannerPromise;
  if (!existing) {
    const initPromise = new NodeClam().init({
      clamdscan: {
        socket: process.env.CLAMD_SOCKET || "/var/run/clamav/clamd.ctl",
        host: process.env.CLAMD_HOST,
        port: process.env.CLAMD_PORT
          ? Number(process.env.CLAMD_PORT)
          : undefined,
        timeout: 60000,
      },
    });
    // Never cache a rejected init — clamd being down at boot must not
    // disable scanning for the life of the process.
    initPromise.catch(() => {
      if (scannerPromise === initPromise) scannerPromise = null;
    });
    scannerPromise = initPromise;
    return initPromise;
  }
  return existing;
}

function scanningDisabled(): boolean {
  return process.env.CLAMAV_ENABLED === "false";
}

function handleScannerUnavailable(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (process.env.NODE_ENV === "production") {
    // Fail closed in production — an unscannable file is a rejected file.
    throw new AppError(
      MEDIA_ERROR_KEYS.scanUnavailable,
      StatusCodes.SERVICE_UNAVAILABLE,
      { reason: message }
    );
  }
  console.warn({
    event: "virus_scan_skipped",
    reason: `ClamAV unavailable outside production: ${message}`,
  });
}

/**
 * Scans a local temp file. Throws AppError immediately if infected —
 * no quarantine flow, no partial upload. Caller must not proceed on throw.
 *
 * Availability policy: CLAMAV_ENABLED=false skips scanning entirely
 * (explicit opt-out, e.g. CI). Otherwise, if clamd is unreachable the
 * scan fails CLOSED in production and is skipped with a warning in dev.
 */
export async function scanFileOrThrow(tempFilePath: string): Promise<void> {
  if (scanningDisabled()) return;

  let result: { isInfected: boolean; viruses: string[] };
  try {
    const clamscan = await getScanner();
    result = await clamscan.isInfected(tempFilePath);
  } catch (err) {
    handleScannerUnavailable(err);
    return;
  }

  if (result.isInfected) {
    throw new AppError(
      MEDIA_ERROR_KEYS.virusDetected,
      StatusCodes.BAD_REQUEST,
      {
        viruses: result.viruses,
      }
    );
  }
}
