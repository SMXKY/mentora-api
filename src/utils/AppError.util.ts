import { Prisma } from "../generated/prisma";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly isOperational: boolean;
  public readonly messageKey: string;
  public readonly meta?: Record<string, any>;

  constructor(
    messageKey: string,
    statusCode: number,
    meta?: Record<string, any>,
    isOperational = true
  ) {
    super(messageKey);

    this.messageKey = messageKey;
    this.meta = meta;
    this.statusCode = statusCode;
    this.status = statusCode >= 400 && statusCode < 500 ? "fail" : "error";
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  static from(err: any): AppError {
    if (err instanceof AppError) return err;

    const message = err?.message || "";

    if (err?.code === "P2002" || message.includes("Unique constraint failed")) {
      const match =
        message.match(/fields: \(`(.+?)`\)/) ||
        message.match(/fields: `(.+?)`/) ||
        message.match(/the fields: \(`(.+?)`\)/) ||
        message.match(/the fields: `(.+?)`/);

      const fields = match
        ? match[1]
        : err?.meta?.target?.join(", ") || "field";

      return new AppError("error.db.duplicate", 409, { fields });
    }

    if (
      err?.code === "P2025" ||
      message.includes("Record to update not found") ||
      message.includes("Record to delete not found") ||
      message.includes("No record found")
    ) {
      return new AppError("error.db.not_found", 404);
    }

    if (
      err?.code === "P2003" ||
      message.includes("Foreign key constraint failed")
    ) {
      const match = message.match(/field: `(.+?)`/);
      const field = match ? match[1] : err?.meta?.field_name || "reference";
      return new AppError("error.db.invalid_reference", 400, { field });
    }

    if (
      err?.code === "P2011" ||
      message.includes("Null constraint violation")
    ) {
      const match = message.match(/column: `(.+?)`/);
      const field = match ? match[1] : err?.meta?.constraint || "field";
      return new AppError("error.db.missing_field", 400, { field });
    }

    if (
      err?.code === "P2000" ||
      message.includes("Value out of range") ||
      message.includes("too long")
    ) {
      const match = message.match(/column: `(.+?)`/);
      const field = match ? match[1] : err?.meta?.column_name || "field";
      return new AppError("error.db.value_too_long", 400, { field });
    }

    if (err?.code === "P2006" || message.includes("Invalid value")) {
      console.log(err);
      return new AppError("error.db.invalid_value", 400);
    }

    if (
      err instanceof Prisma.PrismaClientInitializationError ||
      message.includes("Can't reach database")
    ) {
      return new AppError("error.db.unavailable", 503, undefined, false);
    }

    if (
      err instanceof Prisma.PrismaClientValidationError ||
      message.includes("Invalid `") ||
      message.includes("Argument")
    ) {
      const lines = message.split("\n").filter((l: string) => l.trim());
      const lastLine = lines[lines.length - 1]?.trim() || "Invalid data";
      return new AppError("error.db.validation", 400, { details: lastLine });
    }

    if (err instanceof Prisma.PrismaClientRustPanicError) {
      return new AppError("error.db.critical", 500, undefined, false);
    }

    if (err?.name === "JsonWebTokenError") {
      return new AppError("error.auth.invalid_token", 401);
    }

    if (err?.name === "TokenExpiredError") {
      return new AppError("error.auth.token_expired", 401);
    }

    if (err instanceof SyntaxError && "body" in err) {
      return new AppError("error.request.invalid_json", 400);
    }

    if (err?.type === "entity.too.large") {
      return new AppError("error.request.payload_too_large", 413);
    }

    return new AppError(
      err?.message || "error.server.unknown",
      500,
      undefined,
      false
    );
  }
}
