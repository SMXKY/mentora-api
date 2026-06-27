import AfricasTalking from "africastalking";
import {
  AT_API_KEY,
  AT_USERNAME,
  AT_SANDBOX,
} from "../utils/enviromentVariablesCheck.util";

if (!AT_API_KEY || !AT_USERNAME) {
  throw new Error(
    "[AfricasTalking] AT_API_KEY and AT_USERNAME must be defined in environment variables."
  );
}

const at = AfricasTalking({
  apiKey: AT_API_KEY,
  username: AT_SANDBOX === "true" ? "sandbox" : AT_USERNAME,
});

export const smsClient = at.SMS;
export const whatsappClient = at.WHATSAPP;

export default at;
