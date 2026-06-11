import { Request, Response } from "express";
import { ServiceContext } from "../base/base.types";
import { Languages } from "../generated/prisma";

export const buildContext = (req: Request, res: Response): ServiceContext => ({
  // Clerk attaches the authenticated user to req.auth
  userId: (req as any).auth?.userId,

  // Set by the protect middleware after Clerk verification
  userEmail: res.locals.user?.email,

  // Set by requestId middleware — UUID per request
  // Used to trace all logs for a single request in Grafana
  requestId: res.locals.requestId,

  // Client IP — handles proxies via x-forwarded-for
  ipAddress:
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    req.ip,

  // Raw user agent string
  userAgent: req.headers["user-agent"],

  // Locale resolved by getUserLanguage middleware
  // Defaults to English if middleware has not run
  lang: (res.locals.lang as Languages) || "en",
});
