import { Response } from "express";

export const appResponder = (
  statusCode: number,
  data: object,
  res: Response,
  meta?: Record<string, any>
) => {
  res.status(statusCode).json({ success: true, data, meta });
};
