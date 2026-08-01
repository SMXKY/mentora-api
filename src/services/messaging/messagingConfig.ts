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
});

export type MessagingConfig = Awaited<ReturnType<typeof messagingConfig.getAll>>;
