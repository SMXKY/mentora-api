import { Notification } from "../../generated/prisma";

/**
 * DEAD STUB — no external SMS provider is called. SMS is disabled
 * platform-wide until a provider is funded (no free tier exists for
 * Cameroon at the time this was written). This function exists so
 * the channel interface is uniform and so it can be flipped on later
 * by implementing the body of this function only — no calling code
 * anywhere else needs to change.
 *
 * Currently `SMS: false` on every entry in the notification registry,
 * so this only runs if a caller explicitly overrides SMS: true.
 */
export async function sendSmsChannel(
  notification: Notification
): Promise<boolean> {
  // eslint-disable-next-line no-console
  console.log({
    event: "sms_stub_send",
    recipientId: notification.recipientId,
    type: notification.type,
    notificationId: notification.id,
  });
  return true;
}

/**
 * Same dead stub as sendSmsChannel above, for a raw phone number instead of
 * a Notification row — used as the last-resort fallback when alerting a
 * tutor's emergency contact (who isn't a platform User) during a home-
 * session safety event. Returns false deliberately, unlike sendSmsChannel's
 * `true`: callers here (SafetyAlert.emergencyContactNotifiedAt/Channel) need
 * to know delivery did NOT actually happen, not get a false-positive "sent".
 */
export async function sendSmsToPhoneNumber(
  phone: string,
  body: string
): Promise<boolean> {
  // eslint-disable-next-line no-console
  console.log({ event: "sms_stub_send_raw_phone", phone, body });
  return false;
}
