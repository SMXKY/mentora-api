import { ConfigCategory } from "../../generated/prisma";
import { createConfigGroup } from "../config/configGroup.util";

export const bookingConfig = createConfigGroup({
  paymentWindowHours: {
    key: "booking.payment_window_hours",
    category: ConfigCategory.BOOKING,
    description: "Hours a parent has to pay for an accepted booking before it auto-cancels",
    default: 24,
  },
  paymentWindowReminderHours: {
    key: "booking.payment_window_reminder_hours",
    category: ConfigCategory.BOOKING,
    description: "Hours before payment-window expiry that a reminder is sent",
    default: 12,
  },
  cancellationThresholdHours: {
    key: "booking.cancellation_threshold_hours",
    category: ConfigCategory.BOOKING,
    description:
      "Hours before session start under which a parent cancellation forfeits the refund to the tutor (also reused for reschedule financial rules)",
    default: 12,
  },
  homeNoShowGraceMinutes: {
    key: "booking.home_no_show_grace_minutes",
    category: ConfigCategory.BOOKING,
    description: "Minutes after scheduled start before a home session with no check-in is flagged for admin review",
    default: 30,
  },
  groupSessionMinDefault: {
    key: "booking.group_session_min_default",
    category: ConfigCategory.BOOKING,
    description: "Default minimum student count suggested when a tutor creates a group session",
    default: 2,
  },
});

export type BookingConfig = Awaited<ReturnType<typeof bookingConfig.getAll>>;
