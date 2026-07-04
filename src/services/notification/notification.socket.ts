import { Socket } from "socket.io";
import prisma from "../../config/database.config";
import NotificationService from "./notification.service";

interface AuthedSocket extends Socket {
  data: { user: { id: string } };
}

// Socket event handlers run outside Express — a rejected promise here has
// no error middleware to land in, and an unhandled rejection kills the
// whole process (see the handler in index.ts). Every handler must catch.
function logSocketError(event: string, err: unknown): void {
  console.error({
    event: "notification_socket_error",
    handler: event,
    error: err instanceof Error ? err.message : String(err),
  });
}

export async function handleNotificationSync(
  socket: AuthedSocket,
  payload: { since: string }
): Promise<void> {
  try {
    const userId = socket.data.user.id;
    const sinceDate = new Date(payload?.since);
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
  } catch (err) {
    logSocketError("notification:sync", err);
  }
}

export async function handleNotificationRead(
  socket: AuthedSocket,
  payload: { id: string }
): Promise<void> {
  try {
    const userId = socket.data.user.id;
    await NotificationService.markAsRead(payload?.id, userId);
    const unreadCount = await NotificationService.getUnreadCount(userId);
    socket.emit("notification:count", { unread: unreadCount });
  } catch (err) {
    logSocketError("notification:read", err);
  }
}

export async function handleNotificationReadAll(
  socket: AuthedSocket
): Promise<void> {
  try {
    const userId = socket.data.user.id;
    await NotificationService.markAllAsRead(userId);
    socket.emit("notification:count", { unread: 0 });
  } catch (err) {
    logSocketError("notification:read_all", err);
  }
}

export async function sendInitialNotificationState(
  socket: AuthedSocket
): Promise<void> {
  try {
    const userId = socket.data.user.id;
    const unreadCount = await NotificationService.getUnreadCount(userId);
    socket.emit("notification:count", { unread: unreadCount });
  } catch (err) {
    logSocketError("initial_state", err);
  }
}

// Marks IN_APP delivery as acknowledged for observability. Scoped to the
// socket's own notifications — a client can never ack another user's rows.
export async function handleNotificationAck(
  socket: AuthedSocket,
  payload: { id: string }
): Promise<void> {
  try {
    const userId = socket.data.user.id;
    await prisma.notificationDelivery.updateMany({
      where: {
        notificationId: payload?.id,
        channel: "IN_APP",
        notification: { recipientId: userId },
      },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
  } catch (err) {
    logSocketError("notification:ack", err);
  }
}
