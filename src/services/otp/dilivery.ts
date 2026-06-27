import { smsClient, whatsappClient } from "../../utils/at.util";

type DeliveryResult =
  | { success: true; channel: "whatsapp" | "sms" }
  | { success: false; reason: string };

const OTP_SENDER_ID = "MENTORA";

const buildOtpMessage = (code: string): string =>
  `Your Mentora verification code is ${code}. It expires in 10 minutes. Do not share it with anyone.`;

const trySms = async (phone: string, message: string): Promise<boolean> => {
  try {
    const response = await smsClient.send({
      to: [phone],
      message,
      from: OTP_SENDER_ID,
    });

    const recipient = response.SMSMessageData?.Recipients?.[0];
    if (!recipient || recipient.status !== "Success") {
      console.error(
        `[OTP Delivery] SMS failed for ${phone}: ${
          recipient?.status ?? "unknown status"
        }`
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error(
      `[OTP Delivery] SMS exception for ${phone}:`,
      err instanceof Error ? err.message : err
    );
    return false;
  }
};

export const deliverOtp = async (
  phone: string,
  code: string
): Promise<DeliveryResult> => {
  const message = buildOtpMessage(code);

  const smsSent = await trySms(phone, message);
  if (smsSent) {
    return { success: true, channel: "sms" };
  }

  const reason = "Both WhatsApp and SMS delivery failed";
  console.error(`[OTP Delivery] ${reason} for ${phone}`);
  return { success: false, reason };
};
