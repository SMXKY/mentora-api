import prisma from "../../config/database.config";
import { sendEmail } from "../../utils/sendEmail.util";
import { Notification } from "../../generated/prisma";
import { buildNotificationEmailTemplate } from "../../emailTemplates/notification.template";
import { resolveNotificationCopy } from "./notification.text";

/**
 * Sends the email channel for a notification. Returns true on success.
 * Never throws — caller (dispatcher) handles retry/backoff on false.
 */
export async function sendEmailChannel(
  notification: Notification
): Promise<boolean> {
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: notification.recipientId },
      select: { email: true, preferredLanguage: true, firstName: true },
    });

    if (!recipient?.email) return false;

    const { title: subject, body: bodyText } = resolveNotificationCopy(
      notification,
      recipient.preferredLanguage,
      { firstName: recipient.firstName ?? "" }
    );

    await sendEmail(
      recipient.email,
      subject,
      bodyText,
      buildNotificationEmailTemplate(subject, bodyText)
    );
    return true;
  } catch (err) {
    console.error({
      event: "email_channel_send_failed",
      notificationId: notification.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
