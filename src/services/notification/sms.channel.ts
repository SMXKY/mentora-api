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
