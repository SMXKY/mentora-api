import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import * as jwt from "jsonwebtoken";
import prisma from "../config/database.config";
import { JWT_SECRET } from "../utils/enviromentVariablesCheck.util";
import {
  handleNotificationAck,
  handleNotificationSync,
  handleNotificationRead,
  handleNotificationReadAll,
  sendInitialNotificationState,
} from "../services/notification/notification.socket";
import { MessagingService } from "../modules/messaging/messaging.service";
import { LiveSessionService } from "../modules/liveSession/liveSession.service";
import { AppError } from "../utils/AppError.util";
import { t } from "../shared/i18n/t";
import { parseAcceptLanguage } from "../shared/i18n/resolveLocale";
import { FALLBACK_LANGUAGE, type SupportedLanguage } from "../shared/i18n/init";

interface AuthedSocket extends Socket {
  data: { user: { id: string; roleId?: string } };
}

let ioInstance: Server | null = null;

// Typing indicators are transient — never persisted. A start auto-clears
// after 5s if no matching stop arrives (e.g. the sender's app crashed or
// lost connection mid-type), keyed per conversation+user so it can't leak
// across conversations or users.
const typingTimers = new Map<string, NodeJS.Timeout>();
const typingKey = (conversationId: string, userId: string) => `${conversationId}:${userId}`;

// ────────────────────────────────────────────────────────────
// Room naming — the ONLY place a room name is ever constructed.
// Every room is derived from trusted, server-side data. Nothing
// here ever accepts a raw room name from the client.
// ────────────────────────────────────────────────────────────
const userRoom = (userId: string) => `user:${userId}`;
const bookingRoom = (bookingId: string) => `booking:${bookingId}`;
const conversationRoom = (conversationId: string) =>
  `conversation:${conversationId}`;

// Mirrors resolveLocale()'s header-based resolution (REST) since a socket
// handshake is still an HTTP request under the hood — deliberately not a
// stored user preference, same reasoning as the REST middleware.
function resolveSocketLang(socket: Socket): SupportedLanguage {
  const headers = socket.handshake.headers;
  const xLangHeader = headers["x-lang"];
  const xLang = Array.isArray(xLangHeader) ? xLangHeader[0] : xLangHeader;
  const acceptLanguageHeader = headers["accept-language"];
  const acceptLanguage = Array.isArray(acceptLanguageHeader) ? acceptLanguageHeader[0] : acceptLanguageHeader;

  return (
    parseAcceptLanguage(xLang) ??
    parseAcceptLanguage(acceptLanguage) ??
    FALLBACK_LANGUAGE
  );
}

export function initializeSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin:
        process.env.CORS_ORIGINS?.split(",")
          .map((o) => o.trim())
          .filter(Boolean) ?? [],
      credentials: true,
    },
  });

  // ── Auth middleware: runs before any connection is accepted ──
  // A socket is never "connected" without a verified identity attached.
  io.use((socket: Socket, next) => {
    try {
      const rawToken =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization;
      // Clients send `Bearer <token>` (auth.token and the Authorization
      // header alike) — strip the scheme so jwt.verify gets the raw JWT.
      const token = rawToken?.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;

      if (!token) return next(new Error("No token provided"));

      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      if (!decoded.id) return next(new Error("Invalid token"));

      (socket as AuthedSocket).data.user = { id: decoded.id };
      next();
    } catch {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const authed = socket as AuthedSocket;
    const userId = authed.data.user.id;
    const lang = resolveSocketLang(socket);

    // Every socket auto-joins its own personal room the moment it connects.
    // This is the room `emitToUser` sends to — there is no code path where
    // a client chooses or overrides this.
    socket.join(userRoom(userId));

    sendInitialNotificationState(authed);

    // ── Notification events ──
    socket.on("notification:sync", (payload) =>
      handleNotificationSync(authed, payload)
    );
    socket.on("notification:read", (payload) =>
      handleNotificationRead(authed, payload)
    );
    socket.on("notification:read_all", () => handleNotificationReadAll(authed));
    socket.on("notification:ack", (payload) =>
      handleNotificationAck(authed, payload)
    );

    // ── Resource-scoped rooms — permission checked before joining ──
    // The client only ever sends an ID. The server decides whether that
    // ID's room is one this user is allowed into.
    socket.on("booking:join", async (payload: { bookingId: string }) => {
      try {
        const allowed = await userCanAccessBooking(userId, payload?.bookingId);
        if (!allowed) return; // silently ignore — no error leaks whether the booking exists
        socket.join(bookingRoom(payload.bookingId));
      } catch (err) {
        console.error({ event: "socket_join_error", room: "booking", error: err instanceof Error ? err.message : String(err) });
      }
    });

    socket.on("booking:leave", (payload: { bookingId: string }) => {
      socket.leave(bookingRoom(payload.bookingId));
    });

    socket.on(
      "conversation:join",
      async (payload: { conversationId: string }) => {
        try {
          const allowed = await userCanAccessConversation(
            userId,
            payload?.conversationId
          );
          if (!allowed) return;
          socket.join(conversationRoom(payload.conversationId));
        } catch (err) {
          console.error({ event: "socket_join_error", room: "conversation", error: err instanceof Error ? err.message : String(err) });
        }
      }
    );

    socket.on("conversation:leave", (payload: { conversationId: string }) => {
      socket.leave(conversationRoom(payload.conversationId));
    });

    // ── Messaging events ──
    // The DB write is always the source of truth: message:send funnels into
    // the exact same MessagingService.sendMessage() used by the REST POST
    // endpoint (filter pipeline, persistence, notification) rather than
    // re-implementing any of that here.
    socket.on(
      "message:send",
      async (payload: { conversationId: string; content?: string; tempId?: string; replyToId?: string; attachmentFileId?: string }) => {
        try {
          const message = await MessagingService.sendMessage(
            userId,
            payload?.conversationId,
            payload?.content,
            { userId },
            payload?.replyToId,
            payload?.attachmentFileId
          );
          socket.emit("message:send:ack", { tempId: payload?.tempId, message });
        } catch (err) {
          const appError = err instanceof AppError ? err : new AppError("messaging/errors:sendFailed", 500);
          socket.emit("message:send:error", {
            tempId: payload?.tempId,
            error: t(appError.messageKey, appError.messageKey, { lng: lang, ...appError.meta }),
          });
        }
      }
    );

    socket.on(
      "message:read",
      async (payload: { conversationId: string; messageIds: string[] }) => {
        try {
          await MessagingService.markAsRead(payload?.conversationId, userId, payload?.messageIds ?? []);
        } catch (err) {
          console.error({ event: "socket_mark_read_error", error: err instanceof Error ? err.message : String(err) });
        }
      }
    );

    socket.on("typing:start", async (payload: { conversationId: string }) => {
      try {
        const allowed = await userCanAccessConversation(userId, payload?.conversationId);
        if (!allowed) return;

        const key = typingKey(payload.conversationId, userId);
        const existing = typingTimers.get(key);
        if (existing) clearTimeout(existing);

        socket.to(conversationRoom(payload.conversationId)).emit("typing:start", { conversationId: payload.conversationId, userId });

        typingTimers.set(
          key,
          setTimeout(() => {
            typingTimers.delete(key);
            socket.to(conversationRoom(payload.conversationId)).emit("typing:stop", { conversationId: payload.conversationId, userId });
          }, 5000)
        );
      } catch (err) {
        console.error({ event: "socket_typing_start_error", error: err instanceof Error ? err.message : String(err) });
      }
    });

    socket.on("typing:stop", (payload: { conversationId: string }) => {
      const key = typingKey(payload?.conversationId, userId);
      const existing = typingTimers.get(key);
      if (existing) {
        clearTimeout(existing);
        typingTimers.delete(key);
      }
      socket.to(conversationRoom(payload.conversationId)).emit("typing:stop", { conversationId: payload.conversationId, userId });
    });

    // ── Live Sessions (Module 14) — WhatsApp-style call signaling ──
    // One-on-one only. Booking/payment access is re-checked server-side on
    // every initiate — a client can never make the server ring someone for
    // a booking it isn't actually a paid party to.
    socket.on("session:call:initiate", async (payload: { bookingId: string }) => {
      try {
        await LiveSessionService.initiateCall(userId, payload?.bookingId);
      } catch (err) {
        console.error({ event: "socket_call_initiate_error", error: err instanceof Error ? err.message : String(err) });
      }
    });

    socket.on("session:call:accept", (payload: { bookingId: string; callerId: string }) => {
      LiveSessionService.respondToCall(userId, payload?.bookingId, payload?.callerId, true);
    });

    socket.on("session:call:reject", (payload: { bookingId: string; callerId: string }) => {
      LiveSessionService.respondToCall(userId, payload?.bookingId, payload?.callerId, false);
    });

    socket.on("disconnect", () => {
      // Rooms are cleaned up automatically by Socket.IO on disconnect.
      // Any typing indicator this socket had in flight must still be
      // cleared for the other party rather than silently expiring 5s late.
      for (const [key, timer] of typingTimers) {
        if (key.endsWith(`:${userId}`)) {
          clearTimeout(timer);
          typingTimers.delete(key);
          const conversationId = key.slice(0, -(`:${userId}`.length));
          socket.to(conversationRoom(conversationId)).emit("typing:stop", { conversationId, userId });
        }
      }
    });
  });

  ioInstance = io;
  return io;
}

// ────────────────────────────────────────────────────────────
// Permission checks — resource rooms are only joinable if the
// requesting user actually has a relationship to that resource.
// ────────────────────────────────────────────────────────────
async function userCanAccessBooking(
  userId: string,
  bookingId: string
): Promise<boolean> {
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      OR: [{ bookerId: userId }, { tutorProfile: { userId } }],
    },
    select: { id: true },
  });
  return !!booking;
}

async function userCanAccessConversation(
  userId: string,
  conversationId: string
): Promise<boolean> {
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId, removedAt: null },
    select: { id: true },
  });
  return !!participant;
}

// ────────────────────────────────────────────────────────────
// Emit helpers — every other module in the codebase should emit
// through these, never by constructing a room string themselves.
// ────────────────────────────────────────────────────────────
export function emitToUser(
  userId: string,
  event: string,
  payload: unknown
): void {
  ioInstance?.to(userRoom(userId)).emit(event, payload);
}

export function emitToBooking(
  bookingId: string,
  event: string,
  payload: unknown
): void {
  ioInstance?.to(bookingRoom(bookingId)).emit(event, payload);
}

export function emitToConversation(
  conversationId: string,
  event: string,
  payload: unknown
): void {
  ioInstance?.to(conversationRoom(conversationId)).emit(event, payload);
}

export async function isUserOnline(userId: string): Promise<boolean> {
  if (!ioInstance) return false;
  const sockets = await ioInstance.in(userRoom(userId)).fetchSockets();
  return sockets.length > 0;
}
