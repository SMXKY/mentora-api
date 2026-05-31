import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

export const requestId = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const incomingId =
    (req.headers["x-request-id"] as string) ||
    (req.headers["x-correlation-id"] as string);

  const id = incomingId || uuidv4();

  res.locals.requestId = id;

  res.setHeader("X-Request-ID", id);

  next();
};
