import { Socket } from "socket.io";
import prisma from "../../config/database.config";
import NotificationService from "./notification.service";

interface AuthedSocket extends Socket {
  data: { user: { id: string } };
}

export async function handleNotificationSync(
  socket: AuthedSocket,
  payload: { since: string }
): Promise<void> {
  const userId = socket.data.user.id;
  const sinceDate = new Date(payload.since);
  if (isNaN(sinceDate.getTime())) return;

  const missed = await NotificationService.getSince(userId, sinceDate);
  for (const notification of missed) {
    socket.emit("notification:new", {
      id: notification.id,
      type: notification.type,
      data: notification.data,
      createdAt: notification.createdAt.toISOString(),
    });
  }

  const unreadCount = await NotificationService.getUnreadCount(userId);
  socket.emit("notification:count", { unread: unreadCount });
}

export async function handleNotificationRead(
  socket: AuthedSocket,
  payload: { id: string }
): Promise<void> {
  const userId = socket.data.user.id;
  await NotificationService.markAsRead(payload.id, userId);
  const unreadCount = await NotificationService.getUnreadCount(userId);
  socket.emit("notification:count", { unread: unreadCount });
}

export async function handleNotificationReadAll(
  socket: AuthedSocket
): Promise<void> {
  const userId = socket.data.user.id;
  await NotificationService.markAllAsRead(userId);
  socket.emit("notification:count", { unread: 0 });
}

export async function sendInitialNotificationState(
  socket: AuthedSocket
): Promise<void> {
  const userId = socket.data.user.id;
  const unreadCount = await NotificationService.getUnreadCount(userId);
  socket.emit("notification:count", { unread: unreadCount });
}

// Marks IN_APP delivery as acknowledged for observability, mirrors old
// handleNotificationAck. Optional — safe to omit if not needed.
export async function handleNotificationAck(
  socket: AuthedSocket,
  payload: { id: string }
): Promise<void> {
  await prisma.notificationDelivery.updateMany({
    where: { notificationId: payload.id, channel: "IN_APP" },
    data: { status: "DELIVERED", deliveredAt: new Date() },
  });
}
