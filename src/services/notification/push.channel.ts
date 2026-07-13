import * as admin from "firebase-admin";
import prisma from "../../config/database.config";
import { Notification } from "../../generated/prisma";
import { resolveNotificationCopy } from "./notification.text";

let firebaseApp: admin.app.App | null = null;

function getFirebaseApp(): admin.app.App | null {
  if (firebaseApp) return firebaseApp;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return null;

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    ),
  });
  return firebaseApp;
}

export async function sendPushChannel(
  notification: Notification
): Promise<boolean> {
  const app = getFirebaseApp();
  if (!app) return false;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: notification.recipientId, isActive: true },
    select: { id: true, fcmToken: true },
  });
  if (tokens.length === 0) return false;

  const recipient = await prisma.user.findUnique({
    where: { id: notification.recipientId },
    select: { preferredLanguage: true },
  });

  const resolved = resolveNotificationCopy(
    notification,
    recipient?.preferredLanguage
  );
  const title = resolved.title.slice(0, 50);
  const body = resolved.body.slice(0, 100);

  const results = await Promise.allSettled(
    tokens.map((t) =>
      app.messaging().send({
        token: t.fcmToken,
        notification: { title, body },
        data: {
          type: notification.type,
          notificationId: notification.id,
          resourceType: notification.resourceType ?? "",
          resourceId: notification.resourceId ?? "",
        },
      })
    )
  );

  let anySuccess = false;
  await Promise.all(
    results.map(async (result, i) => {
      if (result.status === "fulfilled") {
        anySuccess = true;
        return;
      }
      const code = (result.reason as any)?.errorInfo?.code;
      if (code === "messaging/registration-token-not-registered") {
        await prisma.pushToken.update({
          where: { id: tokens[i].id },
          data: {
            isActive: false,
            invalidatedAt: new Date(),
            invalidationReason: "not_registered",
          },
        });
      }
    })
  );

  return anySuccess;
}
