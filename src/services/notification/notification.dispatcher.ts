import prisma from "../../config/database.config";
import {
  NotificationChannel,
  Notification,
  NotificationDeliveryStatus,
} from "../../generated/prisma";
import { notificationRegistry, ChannelProfile } from "./notification.types";
import { sendEmailChannel } from "./email.channel";
import { sendWhatsappChannel } from "./whatsapp.channel";
import { sendPushChannel } from "./push.channel";
import { sendSmsChannel } from "./sms.channel";
import { isUserOnline, emitToUser } from "../../socket";

const CHANNEL_SENDERS: Record<
  Exclude<NotificationChannel, "IN_APP">,
  (n: Notification) => Promise<boolean>
> = {
  EMAIL: sendEmailChannel,
  WHATSAPP: sendWhatsappChannel,
  PUSH: sendPushChannel,
  SMS: sendSmsChannel,
};

/**
 * Determines which channels actually fire for this notification+user,
 * combining: type default profile, isTransactional (bypasses prefs),
 * per-user per-type-per-channel preference, and WhatsApp opt-in status.
 * Mentora fires EVERY applicable channel — this is not a single
 * best-channel pick like an online/offline fallback.
 */
async function resolveActiveChannels(
  notification: Notification
): Promise<NotificationChannel[]> {
  const definition = notificationRegistry[notification.type];
  const active: NotificationChannel[] = [];

  if (definition.defaultChannels.IN_APP) active.push("IN_APP");

  if (definition.isTransactional) {
    // Transactional notifications always go out on every default channel —
    // preferences cannot disable them.
    if (definition.defaultChannels.EMAIL) active.push("EMAIL");
    if (definition.defaultChannels.PUSH) active.push("PUSH");
    if (definition.defaultChannels.WHATSAPP) active.push("WHATSAPP");
    if (definition.defaultChannels.SMS) active.push("SMS");
  } else {
    const prefs = await prisma.notificationPreference.findMany({
      where: {
        userId: notification.recipientId,
        notificationType: notification.type,
      },
      select: { channel: true, isEnabled: true },
    });
    const prefMap = new Map(prefs.map((p) => [p.channel, p.isEnabled]));
    const user = await prisma.user.findUnique({
      where: { id: notification.recipientId },
      select: { notificationsMuted: true, whatsappOptIn: true },
    });

    const channelDefaults: [keyof ChannelProfile, NotificationChannel][] = [
      ["EMAIL", "EMAIL"],
      ["PUSH", "PUSH"],
      ["WHATSAPP", "WHATSAPP"],
      ["SMS", "SMS"],
    ];

    for (const [profileKey, channel] of channelDefaults) {
      if (!definition.defaultChannels[profileKey]) continue;
      if (channel === "WHATSAPP" && !user?.whatsappOptIn) continue;
      if (user?.notificationsMuted) continue;

      const explicitPref = prefMap.get(channel);
      const enabled = explicitPref ?? true; // sensible default: on unless the user turned it off
      if (enabled) active.push(channel);
    }
  }

  return active;
}

async function recordDelivery(
  notificationId: string,
  channel: NotificationChannel,
  status: NotificationDeliveryStatus,
  attemptNumber: number,
  failureReason?: string
): Promise<void> {
  await prisma.notificationDelivery.create({
    data: {
      notificationId,
      channel,
      status,
      attemptNumber,
      failureReason,
      deliveredAt: status === "DELIVERED" ? new Date() : undefined,
    },
  });
}

async function dispatchInApp(notification: Notification): Promise<void> {
  const online = await isUserOnline(notification.recipientId);
  await recordDelivery(notification.id, "IN_APP", "DELIVERED", 1);

  if (online) {
    emitToUser(notification.recipientId, "notification:new", {
      id: notification.id,
      type: notification.type,
      data: notification.data,
      resourceType: notification.resourceType,
      resourceId: notification.resourceId,
      createdAt: notification.createdAt.toISOString(),
    });
    const unreadCount = await prisma.notification.count({
      where: {
        recipientId: notification.recipientId,
        readAt: null,
        deletedAt: null,
      },
    });
    emitToUser(notification.recipientId, "notification:count", {
      unread: unreadCount,
    });
  }
}

/**
 * Fires every applicable channel for a single notification, in parallel.
 * Each channel's success/failure is recorded independently — a failed
 * email never affects whether the push or WhatsApp attempt happens.
 */
export async function dispatchAllChannels(
  notificationId: string,
  attemptNumber = 1
): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });
  if (!notification) return;

  const channels = await resolveActiveChannels(notification);

  await Promise.all(
    channels.map(async (channel) => {
      if (channel === "IN_APP") {
        return dispatchInApp(notification);
      }

      const sender =
        CHANNEL_SENDERS[channel as Exclude<NotificationChannel, "IN_APP">];
      try {
        const success = await sender(notification);
        await recordDelivery(
          notification.id,
          channel,
          success ? "DELIVERED" : "FAILED",
          attemptNumber,
          success ? undefined : "Channel send returned failure"
        );
        if (!success) throw new Error(`${channel} delivery failed`);
      } catch (err) {
        await recordDelivery(
          notification.id,
          channel,
          "FAILED",
          attemptNumber,
          err instanceof Error ? err.message : String(err)
        );
        throw err; // surfaces to the queue worker so BullMQ can retry this job
      }
    })
  );
}
