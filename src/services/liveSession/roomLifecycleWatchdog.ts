import prisma from "../../config/database.config";
import redis from "../../config/redis.config";
import { NotificationService } from "../notification/notification.service";
import { permissions } from "../../data/permission.data";
import { NotificationType } from "../../generated/prisma";

// Dead-man's switch for the room-lifecycle sweep (roomLifecycle.processor.ts)
// — a separate, independently-scheduled check so a broken/crash-looping
// sweep (which would never reach its own writeHeartbeat() call) still gets
// caught. If this job ever silently dies, zero rooms get created for every
// paid booking going forward with nobody notified — this is the "the
// observability system must catch this before users do" requirement.
const HEARTBEAT_KEY = "live_sessions.room_lifecycle_job_heartbeat";
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // sweep runs every 1 min — 5 missed runs is unambiguous
const ALERT_DEDUPE_KEY = "live-session:room_lifecycle_watchdog_alerted";
const ALERT_DEDUPE_TTL_SECONDS = 30 * 60;

let interval: NodeJS.Timeout | null = null;

async function checkHeartbeat(): Promise<void> {
  try {
    const row = await prisma.platformConfig.findUnique({ where: { key: HEARTBEAT_KEY } });
    const lastRunAt = typeof row?.value === "string" ? new Date(row.value) : null;
    const staleForMs = lastRunAt ? Date.now() - lastRunAt.getTime() : Infinity;

    if (staleForMs <= STALE_THRESHOLD_MS) {
      await redis.del(ALERT_DEDUPE_KEY); // recovered — allow a future stale period to alert again
      return;
    }

    const alreadyAlerted = await redis.get(ALERT_DEDUPE_KEY);
    if (alreadyAlerted) return;
    await redis.set(ALERT_DEDUPE_KEY, "1", { EX: ALERT_DEDUPE_TTL_SECONDS });

    console.error({
      event: "live_session_room_lifecycle_heartbeat_stale",
      lastRunAt: lastRunAt?.toISOString() ?? null,
      staleForMinutes: Math.round(staleForMs / 60000),
    });

    await NotificationService.send({
      type: NotificationType.ADMIN_REVIEW_REQUIRED,
      target: { kind: "permission", permissionCode: permissions.liveSessions.manage },
      data: {
        reviewReason: "room_lifecycle_job_heartbeat_stale",
        lastRunAt: lastRunAt?.toISOString() ?? null,
      },
    }).catch((err) =>
      console.error({ event: "live_session_watchdog_notify_failed", error: err instanceof Error ? err.message : String(err) })
    );
  } catch (err) {
    console.error({
      event: "live_session_room_lifecycle_watchdog_error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function startRoomLifecycleWatchdog(): void {
  if (interval) return;
  interval = setInterval(checkHeartbeat, CHECK_INTERVAL_MS);
  checkHeartbeat(); // also check immediately on boot rather than waiting a full interval
}

export function stopRoomLifecycleWatchdog(): void {
  if (interval) clearInterval(interval);
  interval = null;
}
