import * as jwt from "jsonwebtoken";
import {
  JWT_SECRET,
  REGISTRATION_TOKEN_EXPIRY,
} from "../../../utils/enviromentVariablesCheck.util";
import { AppError } from "../../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";

export type RegistrationTokenPayload = {
  identity: string;
  identityType: "phone" | "email" | "google";
  googleAuthId?: string;
  firstName?: string;
  lastName?: string;
  purpose: "registration";
};

export const signRegistrationToken = (
  params: Omit<RegistrationTokenPayload, "purpose">
): string => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables.");
  }

  if (!REGISTRATION_TOKEN_EXPIRY) {
    throw new Error(
      "REGISTRATION_TOKEN_EXPIRY is not defined in environment variables."
    );
  }

  return jwt.sign(
    { ...params, purpose: "registration" } satisfies RegistrationTokenPayload,
    JWT_SECRET,
    { expiresIn: REGISTRATION_TOKEN_EXPIRY as jwt.SignOptions["expiresIn"] }
  );
};

export const verifyRegistrationToken = (
  token: string
): RegistrationTokenPayload => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables.");
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;

    if (
      decoded.purpose !== "registration" ||
      !decoded.identity ||
      !decoded.identityType
    ) {
      throw new AppError(
        "auth/errors:invalidRegistrationToken",
        StatusCodes.UNAUTHORIZED
      );
    }

    return {
      identity: decoded.identity,
      identityType: decoded.identityType,
      purpose: "registration",
      ...(decoded.googleAuthId && { googleAuthId: decoded.googleAuthId }),
    };
  } catch (err) {
    if (err instanceof AppError) throw err;

    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(
        "auth/errors:registrationTokenExpired",
        StatusCodes.UNAUTHORIZED
      );
    }

    throw new AppError(
      "auth/errors:invalidRegistrationToken",
      StatusCodes.UNAUTHORIZED
    );
  }
};
