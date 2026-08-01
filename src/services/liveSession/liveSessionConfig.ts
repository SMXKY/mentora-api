import { ConfigCategory } from "../../generated/prisma";
import { createConfigGroup } from "../config/configGroup.util";

export const liveSessionConfig = createConfigGroup({
  recordingsEnabled: {
    key: "live_sessions.recordings",
    category: ConfigCategory.LIVE_SESSIONS,
    description: "Surface session recordings to Tutors/Students in the booking detail view (recording infra itself is not wired up yet)",
    default: false,
  },
  groupSessionsEnabled: {
    key: "live_sessions.group_sessions",
    category: ConfigCategory.LIVE_SESSIONS,
    description: "Enable group session live rooms — when off, group session endpoints return 404",
    default: false,
  },
  adminObserveEnabled: {
    key: "live_sessions.admin_observe",
    category: ConfigCategory.LIVE_SESSIONS,
    description: "Allow Admin/Super Admin to generate invisible observer tokens for dispute investigation",
    default: false,
  },
  overlapThresholdPercent: {
    key: "live_sessions.overlap_threshold_percent",
    category: ConfigCategory.LIVE_SESSIONS,
    description: "Minimum Tutor/Student overlap percentage of scheduled duration below which a session is auto-flagged for Admin review before escrow release",
    default: 50,
  },
});

export type LiveSessionConfig = Awaited<ReturnType<typeof liveSessionConfig.getAll>>;
