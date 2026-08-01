import express, { Router, Request, Response } from "express";
import redis from "../../config/redis.config";
import { webhookReceiver } from "../../config/livekit.config";
import { LiveSessionService } from "./liveSession.service";

const router = Router();

const DEDUPE_TTL_SECONDS = 24 * 60 * 60;

router.post(
  "/webhooks/livekit",
  // LiveKit posts with `Content-Type: application/webhook+json` — match any
  // content-type here so a raw Buffer is always what express.raw() gives us,
  // since WebhookReceiver.receive() verifies a JWT over the exact raw bytes.
  express.raw({ type: () => true, limit: "1mb" }),
  async (req: Request, res: Response) => {
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
      const authHeader = req.headers.authorization;
      const event = await webhookReceiver.receive(rawBody, authHeader);

      const dedupeKey = `live-session:webhook:${event.id}`;
      const alreadyProcessed = await redis.get(dedupeKey);
      if (alreadyProcessed) {
        res.sendStatus(200);
        return;
      }
      await redis.set(dedupeKey, "1", { EX: DEDUPE_TTL_SECONDS });

      const roomName = event.room?.name;
      const identity = event.participant?.identity;

      switch (event.event) {
        case "room_started":
          if (roomName) await LiveSessionService.handleRoomStarted(roomName);
          break;
        case "participant_joined":
          if (roomName && identity) await LiveSessionService.handleParticipantJoined(roomName, identity);
          break;
        case "participant_left":
          if (roomName && identity) await LiveSessionService.handleParticipantLeft(roomName, identity);
          break;
        case "room_finished":
          if (roomName) await LiveSessionService.handleRoomFinished(roomName);
          break;
        default:
          break;
      }

      res.sendStatus(200);
    } catch (err) {
      console.error({
        event: "livekit_webhook_error",
        error: err instanceof Error ? err.message : String(err),
      });
      res.sendStatus(401);
    }
  }
);

export default router;
