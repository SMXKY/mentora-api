import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "./AppError.util";
import { t } from "../shared/i18n/t";
import { StatusCodes } from "http-status-codes";

const developmentResponse = (err: AppError, req: Request, res: Response) => {
  const lang = res.locals.lang || "en";

  res.status(err.statusCode).json({
    ok: false,
    status: err.status,
    message: t(err.messageKey, err.messageKey, { lng: lang, ...err.meta }),
    ...(err.meta?.redirect && { redirect: err.meta.redirect }),
    error: err,
    stack: err.stack || "No stack trace available",
    path: req.originalUrl,
    method: req.method,
  });
};

const productionResponse = (err: AppError, req: Request, res: Response) => {
  const lang = res.locals.lang || "en";

  if (err.isOperational) {
    res.status(err.statusCode).json({
      ok: false,
      status: err.status,
      message: t(err.messageKey, err.messageKey, { lng: lang, ...err.meta }),
      ...(err.meta?.redirect && { redirect: err.meta.redirect }),
    });
  } else {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      ok: false,
      status: "error",
      message: t("common/errors:server.unknown", "Something went wrong", {
        lng: lang,
      }),
    });
  }
};

export const globalErrorController = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (res.headersSent) {
    return next(err);
  }

  // Multer throws its own error type for multipart problems — map the
  // hard size cap to 413 and everything else it raises to 400.
  if (err instanceof multer.MulterError) {
    err = new AppError(
      err.code === "LIMIT_FILE_SIZE"
        ? "media/errors:fileTooLarge"
        : "common/errors:validation.invalidFormat",
      err.code === "LIMIT_FILE_SIZE"
        ? StatusCodes.REQUEST_TOO_LONG
        : StatusCodes.BAD_REQUEST,
      { multerCode: err.code }
    );
  }

  const error = AppError.from(err);

  console.error({
    event: "unhandled_error",
    method: req.method,
    path: req.originalUrl,
    statusCode: error.statusCode,
    messageKey: error.messageKey,
    meta: error.meta,
    userId: (req as any).auth?.userId || "unauthenticated",
    ip: req.ip,
    requestId: res.locals.requestId,
    stack: error.stack,
  });

  if (process.env.NODE_ENV === "production") {
    productionResponse(error, req, res);
  } else {
    developmentResponse(error, req, res);
  }
};
