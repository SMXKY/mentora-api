import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { sendOptInConfirmation } from "./whatsapp.channel";

const CAMEROON_PHONE_REGEX = /^\+237[26]\d{8}$/;

/**
 * Called when a user toggles on "Receive booking updates and payment
 * alerts on WhatsApp" during account completion. Confirms the number
 * format, saves it, flips opt-in on, timestamps consent, and fires the
 * immediate confirmation message which doubles as proof the number is live.
 */
export async function optInToWhatsapp(
  userId: string,
  whatsappNumber: string
): Promise<void> {
  if (!CAMEROON_PHONE_REGEX.test(whatsappNumber)) {
    throw new AppError(
      "notifications/errors:invalidWhatsappNumber",
      StatusCodes.BAD_REQUEST
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      whatsappNumber,
      whatsappOptIn: true,
      whatsappOptInAt: new Date(),
    },
  });

  await sendOptInConfirmation(userId);
}

/** Manual opt-out from account settings, separate from the STOP-reply webhook path. */
export async function optOutOfWhatsapp(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { whatsappOptIn: false },
  });
}
