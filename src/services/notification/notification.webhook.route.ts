import { Router, Request, Response } from "express";
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
// IMPORTANT: this route must receive the raw body for signature verification.
// Register with express.raw({ type: "application/json" }) ahead of express.json()
// for this specific path, or capture rawBody via a verify callback on express.json().
router.post("/webhooks/whatsapp", async (req: Request, res: Response) => {
  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.sendStatus(401);
  }

  // Respond fast — Meta expects 200 within 5 seconds, heavy work is inline
  // here only because STOP-processing is a single lightweight DB write.
  await handleInboundWebhook(req.body);
  res.sendStatus(200);
});

export default router;
