import {
  NotificationType,
  NotificationChannel,
  NotificationResourceType,
} from "../../generated/prisma";

export type ChannelProfile = {
  IN_APP: boolean;
  EMAIL: boolean;
  PUSH: boolean;
  WHATSAPP: boolean;
  SMS: boolean;
};

export interface NotificationTypeDefinition {
  /** i18n key namespace used to resolve title/body per locale at send time. */
  titleCode: string;
  bodyCode: string;
  /** Transactional notifications ignore user preferences and are always sent. */
  isTransactional: boolean;
  /** Default channels attempted for this type â€” overridable per user preference, except when isTransactional. */
  defaultChannels: ChannelProfile;
}

const on: ChannelProfile = {
  IN_APP: true,
  EMAIL: true,
  PUSH: true,
  WHATSAPP: true,
  SMS: false,
};
const inAppOnly: ChannelProfile = {
  IN_APP: true,
  EMAIL: false,
  PUSH: false,
  WHATSAPP: false,
  SMS: false,
};
const inAppPush: ChannelProfile = {
  IN_APP: true,
  EMAIL: false,
  PUSH: true,
  WHATSAPP: false,
  SMS: false,
};
const inAppEmailPush: ChannelProfile = {
  IN_APP: true,
  EMAIL: true,
  PUSH: true,
  WHATSAPP: false,
  SMS: false,
};
const inAppPushWhatsapp: ChannelProfile = {
  IN_APP: true,
  EMAIL: false,
  PUSH: true,
  WHATSAPP: true,
  SMS: false,
};
const inAppEmailWhatsapp: ChannelProfile = {
  IN_APP: true,
  EMAIL: true,
  PUSH: false,
  WHATSAPP: true,
  SMS: false,
};
const inAppEmail: ChannelProfile = {
  IN_APP: true,
  EMAIL: true,
  PUSH: false,
  WHATSAPP: false,
  SMS: false,
};
const inAppEmailPushWhatsapp: ChannelProfile = {
  IN_APP: true,
  EMAIL: true,
  PUSH: true,
  WHATSAPP: true,
  SMS: false,
};

/**
 * Every NotificationType MUST have an entry here before it can be sent.
 * NotificationService.send() rejects any type missing from this registry.
 * This is what the CI "no unregistered type" check validates against.
 */
export const notificationRegistry: Record<
  NotificationType,
  NotificationTypeDefinition
> = {
  ACCOUNT_CREATED: {
    titleCode: "notifications/messages:account_created.title",
    bodyCode: "notifications/messages:account_created.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  EMAIL_VERIFICATION: {
    titleCode: "notifications/messages:email_verification.title",
    bodyCode: "notifications/messages:email_verification.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  PASSWORD_RESET: {
    titleCode: "notifications/messages:password_reset.title",
    bodyCode: "notifications/messages:password_reset.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  NEW_DEVICE_LOGIN: {
    titleCode: "notifications/messages:new_device_login.title",
    bodyCode: "notifications/messages:new_device_login.body",
    isTransactional: true,
    defaultChannels: inAppEmailPush,
  },
  ACCOUNT_SUSPENDED: {
    titleCode: "notifications/messages:account_suspended.title",
    bodyCode: "notifications/messages:account_suspended.body",
    isTransactional: true,
    defaultChannels: on,
  },
  ACCOUNT_UNSUSPENDED: {
    titleCode: "notifications/messages:account_unsuspended.title",
    bodyCode: "notifications/messages:account_unsuspended.body",
    isTransactional: true,
    defaultChannels: on,
  },
  TWO_FACTOR_LOCKED: {
    titleCode: "notifications/messages:two_factor_locked.title",
    bodyCode: "notifications/messages:two_factor_locked.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },

  KYC_SUBMITTED: {
    titleCode: "notifications/messages:kyc_submitted.title",
    bodyCode: "notifications/messages:kyc_submitted.body",
    isTransactional: true,
    defaultChannels: on,
  },
  KYC_IDENTITY_APPROVED: {
    titleCode: "notifications/messages:kyc_identity_approved.title",
    bodyCode: "notifications/messages:kyc_identity_approved.body",
    isTransactional: true,
    defaultChannels: on,
  },
  KYC_APPROVED: {
    titleCode: "notifications/messages:kyc_approved.title",
    bodyCode: "notifications/messages:kyc_approved.body",
    isTransactional: true,
    defaultChannels: on,
  },
  KYC_REJECTED: {
    titleCode: "notifications/messages:kyc_rejected.title",
    bodyCode: "notifications/messages:kyc_rejected.body",
    isTransactional: true,
    defaultChannels: on,
  },
  KYC_SLA_BREACH: {
    titleCode: "notifications/messages:kyc_sla_breach.title",
    bodyCode: "notifications/messages:kyc_sla_breach.body",
    isTransactional: false,
    defaultChannels: inAppEmail,
  },
  KYC_BANNED: {
    titleCode: "notifications/messages:kyc_banned.title",
    bodyCode: "notifications/messages:kyc_banned.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  KYC_REVERIFICATION_REQUIRED: {
    titleCode: "notifications/messages:kyc_reverification_required.title",
    bodyCode: "notifications/messages:kyc_reverification_required.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },

  BOOKING_REQUESTED: {
    titleCode: "notifications/messages:booking_requested.title",
    bodyCode: "notifications/messages:booking_requested.body",
    isTransactional: false,
    defaultChannels: inAppPushWhatsapp,
  },
  BOOKING_ACCEPTED: {
    titleCode: "notifications/messages:booking_accepted.title",
    bodyCode: "notifications/messages:booking_accepted.body",
    isTransactional: false,
    defaultChannels: on,
  },
  BOOKING_REJECTED: {
    titleCode: "notifications/messages:booking_rejected.title",
    bodyCode: "notifications/messages:booking_rejected.body",
    isTransactional: false,
    defaultChannels: on,
  },
  BOOKING_CANCELLED_BY_TUTOR: {
    titleCode: "notifications/messages:booking_cancelled_by_tutor.title",
    bodyCode: "notifications/messages:booking_cancelled_by_tutor.body",
    isTransactional: false,
    defaultChannels: on,
  },
  BOOKING_CANCELLED_BY_PARENT: {
    titleCode: "notifications/messages:booking_cancelled_by_parent.title",
    bodyCode: "notifications/messages:booking_cancelled_by_parent.body",
    isTransactional: false,
    defaultChannels: on,
  },
  BOOKING_CANCELLED_UNPAID: {
    titleCode: "notifications/messages:booking_cancelled_unpaid.title",
    bodyCode: "notifications/messages:booking_cancelled_unpaid.body",
    isTransactional: false,
    defaultChannels: inAppPushWhatsapp,
  },
  PAYMENT_WINDOW_REMINDER: {
    titleCode: "notifications/messages:payment_window_reminder.title",
    bodyCode: "notifications/messages:payment_window_reminder.body",
    isTransactional: false,
    defaultChannels: inAppPushWhatsapp,
  },
  RESCHEDULE_REQUESTED: {
    titleCode: "notifications/messages:reschedule_requested.title",
    bodyCode: "notifications/messages:reschedule_requested.body",
    isTransactional: false,
    defaultChannels: inAppPushWhatsapp,
  },
  RESCHEDULE_ACCEPTED: {
    titleCode: "notifications/messages:reschedule_accepted.title",
    bodyCode: "notifications/messages:reschedule_accepted.body",
    isTransactional: false,
    defaultChannels: inAppPushWhatsapp,
  },
  RESCHEDULE_REJECTED: {
    titleCode: "notifications/messages:reschedule_rejected.title",
    bodyCode: "notifications/messages:reschedule_rejected.body",
    isTransactional: false,
    defaultChannels: inAppPushWhatsapp,
  },

  SESSION_REMINDER_24HR: {
    titleCode: "notifications/messages:session_reminder_24hr.title",
    bodyCode: "notifications/messages:session_reminder_24hr.body",
    isTransactional: false,
    defaultChannels: inAppPushWhatsapp,
  },
  SESSION_REMINDER_1HR: {
    titleCode: "notifications/messages:session_reminder_1hr.title",
    bodyCode: "notifications/messages:session_reminder_1hr.body",
    isTransactional: false,
    defaultChannels: inAppPushWhatsapp,
  },
  SESSION_CHECKIN_REMINDER: {
    titleCode: "notifications/messages:session_checkin_reminder.title",
    bodyCode: "notifications/messages:session_checkin_reminder.body",
    isTransactional: false,
    defaultChannels: inAppPushWhatsapp,
  },
  SESSION_CHECKIN_OVERDUE: {
    titleCode: "notifications/messages:session_checkin_overdue.title",
    bodyCode: "notifications/messages:session_checkin_overdue.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },
  SESSION_TUTOR_DISCONNECTED: {
    titleCode: "notifications/messages:session_tutor_disconnected.title",
    bodyCode: "notifications/messages:session_tutor_disconnected.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },
  SESSION_NO_SHOW: {
    titleCode: "notifications/messages:session_no_show.title",
    bodyCode: "notifications/messages:session_no_show.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },

  PAYMENT_CONFIRMED: {
    titleCode: "notifications/messages:payment_confirmed.title",
    bodyCode: "notifications/messages:payment_confirmed.body",
    isTransactional: true,
    defaultChannels: on,
  },
  WALLET_TOPPED_UP: {
    titleCode: "notifications/messages:wallet_topped_up.title",
    bodyCode: "notifications/messages:wallet_topped_up.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  WALLET_WITHDRAWAL_INITIATED: {
    titleCode: "notifications/messages:wallet_withdrawal_initiated.title",
    bodyCode: "notifications/messages:wallet_withdrawal_initiated.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  WITHDRAWAL_FAILED: {
    titleCode: "notifications/messages:withdrawal_failed.title",
    bodyCode: "notifications/messages:withdrawal_failed.body",
    isTransactional: true,
    defaultChannels: on,
  },
  ESCROW_RELEASED: {
    titleCode: "notifications/messages:escrow_released.title",
    bodyCode: "notifications/messages:escrow_released.body",
    isTransactional: true,
    defaultChannels: on,
  },
  REFUND_ISSUED: {
    titleCode: "notifications/messages:refund_issued.title",
    bodyCode: "notifications/messages:refund_issued.body",
    isTransactional: true,
    defaultChannels: on,
  },
  PAYOUT_ACCOUNT_ADDED: {
    titleCode: "notifications/messages:payout_account_added.title",
    bodyCode: "notifications/messages:payout_account_added.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  MONTHLY_FEE_DEDUCTED: {
    titleCode: "notifications/messages:monthly_fee_deducted.title",
    bodyCode: "notifications/messages:monthly_fee_deducted.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  MONTHLY_FEE_FAILED: {
    titleCode: "notifications/messages:monthly_fee_failed.title",
    bodyCode: "notifications/messages:monthly_fee_failed.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  PAYMENT_RECONCILIATION_PENDING: {
    titleCode: "notifications/messages:payment_reconciliation_pending.title",
    bodyCode: "notifications/messages:payment_reconciliation_pending.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },

  LESSON_AWAITING_CONFIRMATION: {
    titleCode: "notifications/messages:lesson_awaiting_confirmation.title",
    bodyCode: "notifications/messages:lesson_awaiting_confirmation.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },
  LESSON_CONFIRMED: {
    titleCode: "notifications/messages:lesson_confirmed.title",
    bodyCode: "notifications/messages:lesson_confirmed.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },
  LESSON_AUTO_CONFIRMED: {
    titleCode: "notifications/messages:lesson_auto_confirmed.title",
    bodyCode: "notifications/messages:lesson_auto_confirmed.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },
  DISPUTE_OPENED: {
    titleCode: "notifications/messages:dispute_opened.title",
    bodyCode: "notifications/messages:dispute_opened.body",
    isTransactional: false,
    defaultChannels: on,
  },
  DISPUTE_TUTOR_RESPONSE_REMINDER: {
    titleCode: "notifications/messages:dispute_tutor_response_reminder.title",
    bodyCode: "notifications/messages:dispute_tutor_response_reminder.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },
  DISPUTE_RESOLVED: {
    titleCode: "notifications/messages:dispute_resolved.title",
    bodyCode: "notifications/messages:dispute_resolved.body",
    isTransactional: false,
    defaultChannels: on,
  },
  DISPUTE_ESCALATED: {
    titleCode: "notifications/messages:dispute_escalated.title",
    bodyCode: "notifications/messages:dispute_escalated.body",
    isTransactional: false,
    defaultChannels: inAppEmailPush,
  },

  REVIEW_WINDOW_OPENED: {
    titleCode: "notifications/messages:review_window_opened.title",
    bodyCode: "notifications/messages:review_window_opened.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },
  REVIEW_RECEIVED: {
    titleCode: "notifications/messages:review_received.title",
    bodyCode: "notifications/messages:review_received.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },
  REVIEW_RESPONSE_SUBMITTED: {
    titleCode: "notifications/messages:review_response_submitted.title",
    bodyCode: "notifications/messages:review_response_submitted.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },

  ACCOUNT_FLAGGED: {
    titleCode: "notifications/messages:account_flagged.title",
    bodyCode: "notifications/messages:account_flagged.body",
    isTransactional: false,
    defaultChannels: inAppEmail,
  },
  REAUTH_REQUIRED: {
    titleCode: "notifications/messages:reauth_required.title",
    bodyCode: "notifications/messages:reauth_required.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },

  SUPPORT_TICKET_OPENED: {
    titleCode: "notifications/messages:support_ticket_opened.title",
    bodyCode: "notifications/messages:support_ticket_opened.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  SUPPORT_TICKET_RESPONSE: {
    titleCode: "notifications/messages:support_ticket_response.title",
    bodyCode: "notifications/messages:support_ticket_response.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  SUPPORT_TICKET_RESOLVED: {
    titleCode: "notifications/messages:support_ticket_resolved.title",
    bodyCode: "notifications/messages:support_ticket_resolved.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },

  MATERIAL_REMOVED: {
    titleCode: "notifications/messages:material_removed.title",
    bodyCode: "notifications/messages:material_removed.body",
    isTransactional: false,
    defaultChannels: inAppEmailPush,
  },
  MATERIAL_ACCESS_GRANTED: {
    titleCode: "notifications/messages:material_access_granted.title",
    bodyCode: "notifications/messages:material_access_granted.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },

  PLATFORM_OUTAGE_REFUND: {
    titleCode: "notifications/messages:platform_outage_refund.title",
    bodyCode: "notifications/messages:platform_outage_refund.body",
    isTransactional: true,
    defaultChannels: inAppEmail,
  },
  SCHEDULED_MAINTENANCE: {
    titleCode: "notifications/messages:scheduled_maintenance.title",
    bodyCode: "notifications/messages:scheduled_maintenance.body",
    isTransactional: false,
    defaultChannels: inAppEmail,
  },
  NEW_MESSAGE_RECEIVED: {
    titleCode: "notifications/messages:new_message_received.title",
    bodyCode: "notifications/messages:new_message_received.body",
    isTransactional: false,
    defaultChannels: inAppPush,
  },
  OTHER: {
    titleCode: "notifications/messages:other.title",
    bodyCode: "notifications/messages:other.body",
    isTransactional: false,
    defaultChannels: inAppOnly,
  },
};

export type NotificationTarget =
  | { kind: "user"; userId: string }
  | { kind: "users"; userIds: string[] }
  | { kind: "role"; roleId: string }
  | { kind: "permission"; permissionCode: string }
  | { kind: "all" };

export interface CreateNotificationInput {
  type: NotificationType;
  target: NotificationTarget;
  data?: Record<string, unknown>;
  resourceType?: NotificationResourceType;
  resourceId?: string;
  channels?: Partial<ChannelProfile>;
}

export const NOTIFICATION_ERROR_KEYS = {
  unregisteredType: "notifications/errors:unregisteredType",
  notFound: "notifications/errors:notFound",
};
