import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const id = randomUUID();
  req.headers["x-request-id"] = id;
  res.setHeader("X-Request-ID", id);
  next();
};
