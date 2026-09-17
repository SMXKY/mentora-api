import { sendWhatsappToPhoneNumber } from "./whatsapp.channel";
import { sendSmsToPhoneNumber } from "./sms.channel";

const SAFETY_ALERT_TEMPLATE = "mentora_safety_alert";

export interface EmergencyContactNotifyResult {
  notified: boolean;
  channel: "WHATSAPP" | "SMS" | null;
}

/**
 * Reaches a tutor's emergency contact directly — they're a name and phone
 * number on TutorProfile, never a platform User, so none of the User-keyed
 * channels (NotificationService.send, push, email) apply. Tries WhatsApp
 * first, falls back to SMS.
 *
 * Both legs currently have a real-world catch: WhatsApp needs
 * "mentora_safety_alert" approved in WhatsApp Business Manager before this
 * will send anything (see whatsapp.channel.ts's template convention), and
 * SMS is a documented dead stub platform-wide (see sms.channel.ts) until a
 * provider is funded for Cameroon. Callers must persist the returned
 * `channel: null` case visibly (SafetyAlert.emergencyContactNotifiedAt
 * stays null) rather than assume the contact was reached.
 */
export async function notifyEmergencyContact(input: {
  phone: string;
  bodyText: string;
  locale?: "en" | "fr";
}): Promise<EmergencyContactNotifyResult> {
  const whatsappSent = await sendWhatsappToPhoneNumber(
    input.phone,
    SAFETY_ALERT_TEMPLATE,
    input.bodyText,
    input.locale ?? "en"
  );
  if (whatsappSent) return { notified: true, channel: "WHATSAPP" };

  const smsSent = await sendSmsToPhoneNumber(input.phone, input.bodyText);
  if (smsSent) return { notified: true, channel: "SMS" };

  return { notified: false, channel: null };
}

export default { notifyEmergencyContact };
