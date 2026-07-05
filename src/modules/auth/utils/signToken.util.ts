import {
  JWT_EXPIRES_IN,
  JWT_SECRET,
} from "../../../utils/enviromentVariablesCheck.util";
import * as jwt from "jsonwebtoken";

/**
 * `sessionId` becomes the token's `jti` claim. It must be a UserSession.id
 * so protect.middleware can check it against the Redis session-blocklist
 * for immediate pre-expiry invalidation (suspend/deactivate/unsuspend).
 * Tokens that don't carry a session (none currently) simply can't be
 * revoked before they expire.
 */
const signToken = (userId: string, sessionId?: string) => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables.");
  }

  const options: jwt.SignOptions = {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    ...(sessionId && { jwtid: sessionId }),
  };

  return jwt.sign({ id: userId }, JWT_SECRET, options);
};

export default signToken;
