import { ConfigCategory } from "../../generated/prisma";
import { createConfigGroup } from "../config/configGroup.util";

export const messagingConfig = createConfigGroup({
  inquiryMessageLimit: {
    key: "messaging.inquiry_message_limit",
    category: ConfigCategory.SECURITY,
    description: "Total combined messages allowed in an Inquiry conversation before a booking is required to continue",
    default: 10,
  },
  blockEscalationThreshold: {
    key: "messaging.block_escalation_threshold",
    category: ConfigCategory.SECURITY,
    description: "Blocked-message attempts in a single conversation that trigger a Moderator review flag",
    default: 3,
  },
  patternFlagThreshold: {
    key: "messaging.pattern_flag_threshold",
    category: ConfigCategory.SECURITY,
    description: "Blocked-message attempts across all of a user's conversations within 24h that trigger a Trust & Safety flag",
    default: 5,
  },
  contactFilterWindowMessages: {
    key: "messaging.contact_filter_window_messages",
    category: ConfigCategory.SECURITY,
    description: "Number of a sender's own recent messages (including the one just sent) concatenated together to catch contact info deliberately split across several short messages",
    default: 6,
  },
  contactFilterWindowSeconds: {
    key: "messaging.contact_filter_window_seconds",
    category: ConfigCategory.SECURITY,
    description: "How far back (in seconds) the split-message contact filter looks for a sender's own prior messages to combine with the new one",
    default: 180,
  },
});

export type MessagingConfig = Awaited<ReturnType<typeof messagingConfig.getAll>>;
