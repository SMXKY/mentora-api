import { AccessToken, RoomServiceClient, WebhookReceiver, VideoGrant } from "livekit-server-sdk";
import { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from "../utils/enviromentVariablesCheck.util";

// RoomServiceClient talks to LiveKit's HTTP twirp API — it needs http(s),
// not the ws(s) URL clients connect to for the media/signaling socket.
const roomServiceUrl = LIVEKIT_URL.replace(/^ws/, "http");

export const roomServiceClient = new RoomServiceClient(roomServiceUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

export const webhookReceiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

export interface CreateAccessTokenOptions {
  identity: string;
  name?: string;
  ttlSeconds: number;
  grant: VideoGrant;
}

export async function createAccessToken(options: CreateAccessTokenOptions): Promise<string> {
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: options.identity,
    name: options.name,
    ttl: options.ttlSeconds,
  });
  token.addGrant(options.grant);
  return token.toJwt();
}

export { VideoGrant };
