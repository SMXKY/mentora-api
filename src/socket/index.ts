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

interface AuthedSocket extends Socket {
  data: { user: { id: string; roleId?: string } };
}

let ioInstance: Server | null = null;

// ────────────────────────────────────────────────────────────
// Room naming — the ONLY place a room name is ever constructed.
// Every room is derived from trusted, server-side data. Nothing
// here ever accepts a raw room name from the client.
// ────────────────────────────────────────────────────────────
const userRoom = (userId: string) => `user:${userId}`;
const bookingRoom = (bookingId: string) => `booking:${bookingId}`;
const conversationRoom = (conversationId: string) =>
  `conversation:${conversationId}`;

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
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.split(" ")[1];

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

    socket.on("disconnect", () => {
      // Rooms are cleaned up automatically by Socket.IO on disconnect —
      // nothing to do here.
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
