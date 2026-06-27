import {
  JWT_EXPIRES_IN,
  JWT_SECRET,
} from "../../../utils/enviromentVariablesCheck.util";
import * as jwt from "jsonwebtoken";

const signToken = (userId: string) => {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables.");
  }

  const options: jwt.SignOptions = {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  };

  return jwt.sign({ id: userId }, JWT_SECRET, options);
};

export default signToken;
