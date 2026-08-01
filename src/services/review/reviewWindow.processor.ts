import prisma from "../../config/database.config";
import { ConfigCategory } from "../../generated/prisma";
import { sweepExpiredReviewWindows } from "./reviewWindow.service";

const HEARTBEAT_KEY = "review.window_sweep_heartbeat";
let sweepInterval: NodeJS.Timeout | null = null;

async function runSweep() {
  await sweepExpiredReviewWindows();

  const systemActor = await prisma.user.findFirst({
    where: { email: process.env.SUPER_ADMIN_EMAIL },
    select: { id: true },
  });
  if (systemActor) {
    await prisma.platformConfig.upsert({
      where: { key: HEARTBEAT_KEY },
      create: {
        key: HEARTBEAT_KEY,
        value: new Date().toISOString(),
        category: ConfigCategory.BOOKING,
        description: "Last successful run of the review-window reveal sweep (dead-man's-switch)",
        defaultValue: "",
        updatedById: systemActor.id,
      },
      update: { value: new Date().toISOString(), updatedById: systemActor.id },
    });
  }
}

export function startReviewWindowSweep(): void {
  if (sweepInterval) return;
  sweepInterval = setInterval(() => {
    runSweep().catch((err) => console.error({ event: "review_window_sweep_failed", error: err.message }));
  }, 60 * 60 * 1000);
}

export function stopReviewWindowSweep(): void {
  if (sweepInterval) clearInterval(sweepInterval);
  sweepInterval = null;
}
