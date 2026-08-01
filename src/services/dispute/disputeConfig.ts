import { ConfigCategory } from "../../generated/prisma";
import { createConfigGroup } from "../config/configGroup.util";

export const disputeConfig = createConfigGroup({
  confirmationWindowHours: {
    key: "dispute.confirmation_window_hours",
    category: ConfigCategory.DISPUTE,
    description: "Hours after a session ends that a booker has to confirm the lesson before auto-release",
    default: 48,
  },
  confirmationReminderHours: {
    key: "dispute.confirmation_reminder_hours",
    category: ConfigCategory.DISPUTE,
    description: "Hours before the confirmation window closes that a reminder is sent",
    default: 24,
  },
  tutorResponseWindowHours: {
    key: "dispute.tutor_response_window_hours",
    category: ConfigCategory.DISPUTE,
    description: "Hours a tutor has to respond to an opened dispute",
    default: 24,
  },
  tutorResponseReminderHours: {
    key: "dispute.tutor_response_reminder_hours",
    category: ConfigCategory.DISPUTE,
    description: "Hours before the tutor response deadline that a reminder is sent",
    default: 12,
  },
  slaBusinessDays: {
    key: "dispute.sla_business_days",
    category: ConfigCategory.DISPUTE,
    description: "Business days an open dispute may remain unresolved before escalating to Super Admin",
    default: 5,
  },
  escalationHighlightHours: {
    key: "dispute.escalation_highlight_hours",
    category: ConfigCategory.DISPUTE,
    description: "Hours an open dispute may remain unresolved before it's highlighted in the admin queue",
    default: 48,
  },
  minDescriptionLength: {
    key: "dispute.min_description_length",
    category: ConfigCategory.DISPUTE,
    description: "Minimum character length for a dispute description",
    default: 30,
  },
  maxDescriptionLength: {
    key: "dispute.max_description_length",
    category: ConfigCategory.DISPUTE,
    description: "Maximum character length for a dispute description",
    default: 1000,
  },
  tutorPatternThresholdCount: {
    key: "dispute.tutor_pattern_threshold_count",
    category: ConfigCategory.DISPUTE,
    description: "Disputes opened against a tutor within the pattern window that trigger a KYC review flag",
    default: 3,
  },
  patternWindowDays: {
    key: "dispute.pattern_window_days",
    category: ConfigCategory.DISPUTE,
    description: "Trailing window in days used for both tutor and parent dispute pattern monitoring",
    default: 30,
  },
  parentPatternRatePercent: {
    key: "dispute.parent_pattern_rate_percent",
    category: ConfigCategory.DISPUTE,
    description: "Dispute rate (percentage of a parent's bookings disputed) within the pattern window that triggers a Trust & Safety flag",
    default: 30,
  },
});

export type DisputeConfig = Awaited<ReturnType<typeof disputeConfig.getAll>>;
