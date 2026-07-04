import express, { Router, Request, Response } from "express";
import {
  verifyWebhookChallenge,
  verifyWebhookSignature,
  handleInboundWebhook,
} from "./whatsapp.channel";

const router = Router();

// Meta's one-time verification handshake when you register the webhook URL.
router.get("/webhooks/whatsapp", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"] as string;
  const token = req.query["hub.verify_token"] as string;
  const challenge = req.query["hub.challenge"] as string;

  const result = verifyWebhookChallenge(mode, token, challenge);
  if (result) {
    res.status(200).send(result);
  } else {
    res.sendStatus(403);
  }
});

// Inbound events — message delivery status, and user replies (e.g. STOP).
// This router is mounted in app.ts BEFORE the global express.json(), and
// uses express.raw here so the HMAC is computed over the exact bytes Meta
// sent — a re-serialized JSON body would never match the signature.
router.post(
  "/webhooks/whatsapp",
  express.raw({ type: "application/json", limit: "1mb" }),
  async (req: Request, res: Response) => {
    try {
      const signature = req.headers["x-hub-signature-256"] as
        | string
        | undefined;
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

      if (!verifyWebhookSignature(rawBody, signature)) {
        res.sendStatus(401);
        return;
      }

      // Respond fast — Meta expects 200 within 5 seconds; STOP-processing
      // is a single lightweight DB write so it stays inline.
      const body = JSON.parse(rawBody.toString("utf8"));
      await handleInboundWebhook(body);
      res.sendStatus(200);
    } catch (err) {
      console.error({
        event: "whatsapp_webhook_error",
        error: err instanceof Error ? err.message : String(err),
      });
      res.sendStatus(400);
    }
  }
);

export default router;
