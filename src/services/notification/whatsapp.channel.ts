import crypto from "crypto";
import prisma from "../../config/database.config";
import { notificationRegistry } from "./notification.types";
import { Notification } from "../../generated/prisma";
import { t } from "../../shared/i18n/t";

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const ACCESS_TOKEN = process.env.WHATSAPP_CLOUD_API_TOKEN || "";
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";

async function callGraphApi(
  payload: Record<string, unknown>
): Promise<boolean> {
  const res = await fetch(`${GRAPH_API_BASE}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error({
      event: "whatsapp_graph_api_error",
      status: res.status,
      body: await res.text().catch(() => ""),
    });
  }
  return res.ok;
}

/**
 * Sends the WhatsApp channel for a notification. Only ever called for
 * users who have opted in — the dispatcher checks whatsappOptIn before
 * queuing this channel at all.
 */
export async function sendWhatsappChannel(
  notification: Notification
): Promise<boolean> {
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: notification.recipientId },
      select: {
        whatsappNumber: true,
        whatsappOptIn: true,
        preferredLanguage: true,
      },
    });

    if (!recipient?.whatsappOptIn || !recipient.whatsappNumber) return false;

    const definition = notificationRegistry[notification.type];
    const locale =
      recipient.preferredLanguage?.toLowerCase() === "fr" ? "fr" : "en";
    const vars = notification.data as Record<string, unknown> | null;
    const body = t(definition.bodyCode, "You have a new notification", {
      lng: locale,
      ...vars,
    });

    // Every notification type maps to a pre-approved Meta template name.
    // Template names follow "mentora_<type_lower>" and must exist in the
    // WhatsApp Business Manager before this will succeed.
    const templateName = `mentora_${notification.type.toLowerCase()}`;

    return await callGraphApi({
      messaging_product: "whatsapp",
      to: recipient.whatsappNumber,
      type: "template",
      template: {
        name: templateName,
        language: { code: locale === "fr" ? "fr" : "en_US" },
        components: [
          { type: "body", parameters: [{ type: "text", text: body }] },
        ],
      },
    });
  } catch (err) {
    console.error({
      event: "whatsapp_channel_send_failed",
      notificationId: notification.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Sent immediately once a user completes the opt-in flow. */
export async function sendOptInConfirmation(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { whatsappNumber: true, firstName: true },
  });
  if (!user?.whatsappNumber) return;

  await callGraphApi({
    messaging_product: "whatsapp",
    to: user.whatsappNumber,
    type: "template",
    template: {
      name: "mentora_whatsapp_optin_confirmation",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: user.firstName ?? "" }],
        },
      ],
    },
  });
}

/** Verifies Meta's webhook GET challenge on initial setup. */
export function verifyWebhookChallenge(
  mode: string,
  token: string,
  challenge: string
): string | null {
  if (mode === "subscribe" && token === VERIFY_TOKEN) return challenge;
  return null;
}

/** Validates the X-Hub-Signature-256 header Meta sends on every webhook POST. */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined
): boolean {
  if (!signatureHeader || !APP_SECRET) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(signatureHeader);
  // timingSafeEqual throws on length mismatch — a crafted header must be
  // a clean `false`, never an exception.
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Handles inbound webhook events. A "STOP" reply automatically flips
 * opt-in off — no manual handling required, per Meta policy.
 */
export async function handleInboundWebhook(body: any): Promise<void> {
  const entry = body?.entry?.[0]?.changes?.[0]?.value;
  const messages = entry?.messages;
  if (!messages || messages.length === 0) return;

  for (const message of messages) {
    const fromNumber: string | undefined = message.from;
    const text: string | undefined = message.text?.body;
    if (!fromNumber || !text) continue;

    if (text.trim().toUpperCase() === "STOP") {
      // Meta sends `from` without a leading "+" — we store numbers as
      // "+237…". Match both shapes so STOP always lands.
      const candidates = fromNumber.startsWith("+")
        ? [fromNumber, fromNumber.slice(1)]
        : [fromNumber, `+${fromNumber}`];
      const result = await prisma.user.updateMany({
        where: { whatsappNumber: { in: candidates } },
        data: { whatsappOptIn: false },
      });
      if (result.count === 0) {
        console.warn({
          event: "whatsapp_stop_unmatched",
          fromNumber,
        });
      }
    }
  }
}
