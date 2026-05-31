// import { Request } from "express";
// import prisma from "@models/index.model";
// import { LogUserActivityInput, LogStatus } from "@appTypes/log.type";
// import UAParser from "ua-parser-js";

// const normalizeIp = (ip?: string): string | undefined => {
//   if (!ip) return;
//   if (ip === "::1") return "127.0.0.1";
//   return ip.replace(/^::ffff:/, "");
// };

// const getClientIp = (req: Request): string | undefined => {
//   const rawIp =
//     req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
//     req.socket.remoteAddress ||
//     req.ip;
//   return normalizeIp(rawIp);
// };

// const getClientInfo = (req: Request) => {
//   const ua = req.headers["user-agent"] || "Unknown";
//   const parser = new UAParser.UAParser(ua);

//   return {
//     browser: parser.getBrowser().name || "Unknown",
//     browserVersion: parser.getBrowser().version,
//     os: parser.getOS().name || "Unknown",
//     device: parser.getDevice().type || "desktop",
//   };
// };

// export const logUserActivity = (
//   req: Request,
//   log: Omit<LogUserActivityInput, "ipAddress" | "userAgent" | "status">
// ): void => {
//   const info = getClientInfo(req);

//   const data: any = {
//     userEmail: log.userEmail,
//     operation: log.operation,
//     category: log.category,
//     tableName: log.tableName,
//     recordId: log.recordId,
//     previousState: log.previousState ?? undefined,
//     newState: log.newState ?? undefined,
//     changedFields: log.changedFields ?? [],
//     requestId: log.requestId ?? undefined,
//     metadata: log.metadata ?? undefined,
//     ipAddress: getClientIp(req) || "0.0.0.0",
//     userAgent: `${info.browser} ${info.browserVersion || ""}`.trim(),
//     status: LogStatus.SUCCESS,
//   };

//   if (log.userId) {
//     data.userId = log.userId;
//   }

//   prisma.activityLog.create({ data }).catch((error) => {
//     console.error("Activity log failed", {
//       error: error instanceof Error ? error.message : String(error),
//       requestId: log.requestId,
//       userId: log.userId,
//     });
//   });
// };
