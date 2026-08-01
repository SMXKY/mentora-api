import prisma from "../../config/database.config";
import { ConfigCategory } from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";

const INTRO_VIDEO_MIN_DURATION_KEY = "tutor.intro_video_min_duration_seconds";
export const DEFAULT_INTRO_VIDEO_MIN_DURATION_SECONDS = 60;

/** Single-key PlatformConfig read, same pattern as materials' download
 * policy — missing row falls back to the hardcoded default. */
export async function getIntroVideoMinDurationSeconds(): Promise<number> {
  const row = await prisma.platformConfig.findUnique({
    where: { key: INTRO_VIDEO_MIN_DURATION_KEY },
  });
  return (row?.value as number) ?? DEFAULT_INTRO_VIDEO_MIN_DURATION_SECONDS;
}

export async function updateIntroVideoMinDurationSeconds(
  seconds: number,
  ctx: ServiceContext
): Promise<number> {
  await prisma.platformConfig.upsert({
    where: { key: INTRO_VIDEO_MIN_DURATION_KEY },
    create: {
      key: INTRO_VIDEO_MIN_DURATION_KEY,
      value: seconds,
      category: ConfigCategory.MEDIA,
      description:
        "Minimum required duration (seconds) for a tutor's introduction video",
      defaultValue: DEFAULT_INTRO_VIDEO_MIN_DURATION_SECONDS,
      updatedById: ctx.userId!,
    },
    update: { value: seconds, updatedById: ctx.userId! },
  });
  return seconds;
}
