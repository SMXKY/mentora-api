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
  checkoutEscalationGraceMinutes: {
    key: "booking.checkout_escalation_grace_minutes",
    category: ConfigCategory.BOOKING,
    description: "Minutes after the checkout nudge before an unresolved home session escalates to admin as a safety alert",
    default: 30,
  },
  locationMismatchThresholdMeters: {
    key: "booking.location_mismatch_threshold_meters",
    category: ConfigCategory.BOOKING,
    description: "Distance between a HOME session's booked address and a check-in/out location before it's flagged as a mismatch",
    default: 500,
  },
});

export type BookingConfig = Awaited<ReturnType<typeof bookingConfig.getAll>>;
