import NodeClam from "clamscan";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { MEDIA_ERROR_KEYS } from "./media.types";

let scannerPromise: Promise<any> | null = null;

function getScanner(): Promise<any> {
  if (!scannerPromise) {
    scannerPromise = new NodeClam().init({
      clamdscan: {
        socket: process.env.CLAMD_SOCKET || "/var/run/clamav/clamd.ctl",
        host: process.env.CLAMD_HOST,
        port: process.env.CLAMD_PORT
          ? Number(process.env.CLAMD_PORT)
          : undefined,
        timeout: 60000,
      },
    });
  }
  return scannerPromise!;
}

/**
 * Scans a local temp file. Throws AppError immediately if infected —
 * no quarantine flow, no partial upload. Caller must not proceed on throw.
 */
export async function scanFileOrThrow(tempFilePath: string): Promise<void> {
  const clamscan = await getScanner();
  const { isInfected, viruses } = await clamscan.isInfected(tempFilePath);

  if (isInfected) {
    throw new AppError(
      MEDIA_ERROR_KEYS.virusDetected,
      StatusCodes.BAD_REQUEST,
      {
        viruses,
      }
    );
  }
}
