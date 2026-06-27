import { randomInt } from "crypto";

const generateOtp = (): string => {
  return randomInt(100000, 999999).toString();
};

export default generateOtp;
