import * as jwt from "jsonwebtoken";
import {
  JWT_SECRET,
  RESET_TOKEN_EXPIRY,
} from "../../../utils/enviromentVariablesCheck.util";
import { AppError } from "../../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

const DEFAULT_EXPIRY = "30m";

export type ResetTokenPayload = {
  identity: string;
  identityType: "email" | "phone";
  purpose: "password_reset";
};

export const signResetToken = (
  identity: string,
  identityType: "email" | "phone"
): string => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables.");
  }

  return jwt.sign(
    {
      identity,
      identityType,
      purpose: "password_reset",
    } satisfies ResetTokenPayload,
    JWT_SECRET,
    {
      expiresIn: (RESET_TOKEN_EXPIRY ??
        DEFAULT_EXPIRY) as jwt.SignOptions["expiresIn"],
    }
  );
};

export const verifyResetToken = (token: string): ResetTokenPayload => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables.");
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

    if (
      decoded.purpose !== "password_reset" ||
      !decoded.identity ||
      !decoded.identityType
    ) {
      throw new AppError(
        "auth/errors:invalidResetToken",
        StatusCodes.UNAUTHORIZED
      );
    }

    return {
      identity: decoded.identity,
      identityType: decoded.identityType,
      purpose: "password_reset",
    };
  } catch (err) {
    if (err instanceof AppError) throw err;

    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(
        "auth/errors:resetTokenExpired",
        StatusCodes.UNAUTHORIZED
      );
    }

    throw new AppError(
      "auth/errors:invalidResetToken",
      StatusCodes.UNAUTHORIZED
    );
  }
};
