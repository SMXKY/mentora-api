import crypto from "crypto";
import { UAParser } from "ua-parser-js";

export type DeviceInfo = {
  fingerprintHash: string;
  ipAddress: string;
  os: string | undefined;
  browser: string | undefined;
  browserVersion: string | undefined;
  deviceType: string | undefined;
};

export const getDeviceInfo = (
  userAgent: string | undefined,
  ip: string | undefined
): DeviceInfo => {
  const ua = userAgent ?? "";
  const ipAddress = ip ?? "unknown";

  // Use first 3 octets of IP for subnet-level matching
  const ipSubnet = ipAddress.split(".").slice(0, 3).join(".");

  const fingerprintHash = crypto
    .createHash("sha256")
    .update(`${ua}|${ipSubnet}`)
    .digest("hex");

  const parser = new UAParser(ua);
  const result = parser.getResult();

  return {
    fingerprintHash,
    ipAddress,
    os: result.os.name,
    browser: result.browser.name,
    browserVersion: result.browser.version,
    deviceType: result.device.type ?? "desktop",
  };
};
