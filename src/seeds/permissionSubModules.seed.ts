import prisma from "../config/database.config";
import { PermissionModuleCode } from "./permissionModules.seed";

export const PermissionSubmoduleCode = {
  // Platform
  PLATFORM_CONFIG: "permissions.submodules.platform.config",
  PLATFORM_FEATURE_FLAGS: "permissions.submodules.platform.feature_flags",
  PLATFORM_CITIES: "permissions.submodules.platform.cities",
  PLATFORM_TAXONOMY: "permissions.submodules.platform.taxonomy",
  PLATFORM_COMMISSION: "permissions.submodules.platform.commission",

  // RBAC
  RBAC_ROLES: "permissions.submodules.rbac.roles",
  RBAC_PERMISSIONS: "permissions.submodules.rbac.permissions",
  RBAC_OVERRIDES: "permissions.submodules.rbac.overrides",

  // Users
  USERS_ACCOUNTS: "permissions.submodules.users.accounts",
  USERS_SESSIONS: "permissions.submodules.users.sessions",
  USERS_SUSPENSION: "permissions.submodules.users.suspension",

  // KYC
  KYC_APPLICATIONS: "permissions.submodules.kyc.applications",
  KYC_SUBJECTS: "permissions.submodules.kyc.subjects",
  KYC_BANS: "permissions.submodules.kyc.bans",

  // Search
  SEARCH_TUTOR: "permissions.submodules.search.tutor",
  SEARCH_RANKING: "permissions.submodules.search.ranking",

  // Bookings
  BOOKINGS_SESSIONS: "permissions.submodules.bookings.sessions",
  BOOKINGS_AVAILABILITY: "permissions.submodules.bookings.availability",
  BOOKINGS_GROUP: "permissions.submodules.bookings.group",

  // Payments
  PAYMENTS_WALLET: "permissions.submodules.payments.wallet",
  PAYMENTS_ESCROW: "permissions.submodules.payments.escrow",
  PAYMENTS_PAYOUTS: "permissions.submodules.payments.payouts",
  PAYMENTS_COMMISSION: "permissions.submodules.payments.commission",
  PAYMENTS_RECEIPTS: "permissions.submodules.payments.receipts",

  // Media
  MEDIA_FILES: "permissions.submodules.media.files",
  MEDIA_QUOTA: "permissions.submodules.media.quota",

  // Materials
  MATERIALS_COLLECTIONS: "permissions.submodules.materials.collections",
  MATERIALS_MODERATION: "permissions.submodules.materials.moderation",

  // Messaging
  MESSAGING_CONVERSATIONS: "permissions.submodules.messaging.conversations",
  MESSAGING_MODERATION: "permissions.submodules.messaging.moderation",
  MESSAGING_FILTERS: "permissions.submodules.messaging.filters",

  // Live Sessions
  LIVE_ROOMS: "permissions.submodules.live_sessions.rooms",
  LIVE_TOKENS: "permissions.submodules.live_sessions.tokens",

  // Disputes
  DISPUTES_MANAGEMENT: "permissions.submodules.disputes.management",
  DISPUTES_EVIDENCE: "permissions.submodules.disputes.evidence",

  // Reviews
  REVIEWS_MANAGEMENT: "permissions.submodules.reviews.management",
  REVIEWS_MODERATION: "permissions.submodules.reviews.moderation",
  REVIEWS_INCIDENTS: "permissions.submodules.reviews.incidents",

  // Trust & Safety
  TRUST_RISK_SCORES: "permissions.submodules.trust_safety.risk_scores",
  TRUST_SIGNALS: "permissions.submodules.trust_safety.signals",
  TRUST_IP_BLOCKS: "permissions.submodules.trust_safety.ip_blocks",

  // Notifications
  NOTIFICATIONS_SEND: "permissions.submodules.notifications.send",
  NOTIFICATIONS_PREFS: "permissions.submodules.notifications.preferences",

  // Analytics
  ANALYTICS_REVENUE: "permissions.submodules.analytics.revenue",
  ANALYTICS_USERS: "permissions.submodules.analytics.users",
  ANALYTICS_REPORTS: "permissions.submodules.analytics.reports",
  ANALYTICS_LEARNING: "permissions.submodules.analytics.learning",

  // Support
  SUPPORT_TICKETS: "permissions.submodules.support.tickets",
  SUPPORT_DEAD_LETTER: "permissions.submodules.support.dead_letter",

  // Audit
  AUDIT_LOGS: "permissions.submodules.audit.logs",
} as const;

export type PermissionSubmoduleCode =
  (typeof PermissionSubmoduleCode)[keyof typeof PermissionSubmoduleCode];

const submoduleDefinitions: Array<{
  nameLocaleCode: string;
  descriptionLocaleCode: string;
  moduleCode: PermissionModuleCode;
}> = [
  // Platform
  {
    nameLocaleCode: PermissionSubmoduleCode.PLATFORM_CONFIG,
    descriptionLocaleCode: "permissions.submodules.platform.config.description",
    moduleCode: PermissionModuleCode.PLATFORM,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.PLATFORM_FEATURE_FLAGS,
    descriptionLocaleCode:
      "permissions.submodules.platform.feature_flags.description",
    moduleCode: PermissionModuleCode.PLATFORM,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.PLATFORM_CITIES,
    descriptionLocaleCode: "permissions.submodules.platform.cities.description",
    moduleCode: PermissionModuleCode.PLATFORM,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.PLATFORM_TAXONOMY,
    descriptionLocaleCode:
      "permissions.submodules.platform.taxonomy.description",
    moduleCode: PermissionModuleCode.PLATFORM,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.PLATFORM_COMMISSION,
    descriptionLocaleCode:
      "permissions.submodules.platform.commission.description",
    moduleCode: PermissionModuleCode.PLATFORM,
  },

  // RBAC
  {
    nameLocaleCode: PermissionSubmoduleCode.RBAC_ROLES,
    descriptionLocaleCode: "permissions.submodules.rbac.roles.description",
    moduleCode: PermissionModuleCode.RBAC,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.RBAC_PERMISSIONS,
    descriptionLocaleCode:
      "permissions.submodules.rbac.permissions.description",
    moduleCode: PermissionModuleCode.RBAC,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.RBAC_OVERRIDES,
    descriptionLocaleCode: "permissions.submodules.rbac.overrides.description",
    moduleCode: PermissionModuleCode.RBAC,
  },

  // Users
  {
    nameLocaleCode: PermissionSubmoduleCode.USERS_ACCOUNTS,
    descriptionLocaleCode: "permissions.submodules.users.accounts.description",
    moduleCode: PermissionModuleCode.USERS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.USERS_SESSIONS,
    descriptionLocaleCode: "permissions.submodules.users.sessions.description",
    moduleCode: PermissionModuleCode.USERS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.USERS_SUSPENSION,
    descriptionLocaleCode:
      "permissions.submodules.users.suspension.description",
    moduleCode: PermissionModuleCode.USERS,
  },

  // KYC
  {
    nameLocaleCode: PermissionSubmoduleCode.KYC_APPLICATIONS,
    descriptionLocaleCode:
      "permissions.submodules.kyc.applications.description",
    moduleCode: PermissionModuleCode.KYC,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.KYC_SUBJECTS,
    descriptionLocaleCode: "permissions.submodules.kyc.subjects.description",
    moduleCode: PermissionModuleCode.KYC,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.KYC_BANS,
    descriptionLocaleCode: "permissions.submodules.kyc.bans.description",
    moduleCode: PermissionModuleCode.KYC,
  },

  // Search
  {
    nameLocaleCode: PermissionSubmoduleCode.SEARCH_TUTOR,
    descriptionLocaleCode: "permissions.submodules.search.tutor.description",
    moduleCode: PermissionModuleCode.SEARCH,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.SEARCH_RANKING,
    descriptionLocaleCode: "permissions.submodules.search.ranking.description",
    moduleCode: PermissionModuleCode.SEARCH,
  },

  // Bookings
  {
    nameLocaleCode: PermissionSubmoduleCode.BOOKINGS_SESSIONS,
    descriptionLocaleCode:
      "permissions.submodules.bookings.sessions.description",
    moduleCode: PermissionModuleCode.BOOKINGS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.BOOKINGS_AVAILABILITY,
    descriptionLocaleCode:
      "permissions.submodules.bookings.availability.description",
    moduleCode: PermissionModuleCode.BOOKINGS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.BOOKINGS_GROUP,
    descriptionLocaleCode: "permissions.submodules.bookings.group.description",
    moduleCode: PermissionModuleCode.BOOKINGS,
  },

  // Payments
  {
    nameLocaleCode: PermissionSubmoduleCode.PAYMENTS_WALLET,
    descriptionLocaleCode: "permissions.submodules.payments.wallet.description",
    moduleCode: PermissionModuleCode.PAYMENTS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.PAYMENTS_ESCROW,
    descriptionLocaleCode: "permissions.submodules.payments.escrow.description",
    moduleCode: PermissionModuleCode.PAYMENTS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.PAYMENTS_PAYOUTS,
    descriptionLocaleCode:
      "permissions.submodules.payments.payouts.description",
    moduleCode: PermissionModuleCode.PAYMENTS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.PAYMENTS_COMMISSION,
    descriptionLocaleCode:
      "permissions.submodules.payments.commission.description",
    moduleCode: PermissionModuleCode.PAYMENTS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.PAYMENTS_RECEIPTS,
    descriptionLocaleCode:
      "permissions.submodules.payments.receipts.description",
    moduleCode: PermissionModuleCode.PAYMENTS,
  },

  // Media
  {
    nameLocaleCode: PermissionSubmoduleCode.MEDIA_FILES,
    descriptionLocaleCode: "permissions.submodules.media.files.description",
    moduleCode: PermissionModuleCode.MEDIA,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.MEDIA_QUOTA,
    descriptionLocaleCode: "permissions.submodules.media.quota.description",
    moduleCode: PermissionModuleCode.MEDIA,
  },

  // Materials
  {
    nameLocaleCode: PermissionSubmoduleCode.MATERIALS_COLLECTIONS,
    descriptionLocaleCode:
      "permissions.submodules.materials.collections.description",
    moduleCode: PermissionModuleCode.MATERIALS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.MATERIALS_MODERATION,
    descriptionLocaleCode:
      "permissions.submodules.materials.moderation.description",
    moduleCode: PermissionModuleCode.MATERIALS,
  },

  // Messaging
  {
    nameLocaleCode: PermissionSubmoduleCode.MESSAGING_CONVERSATIONS,
    descriptionLocaleCode:
      "permissions.submodules.messaging.conversations.description",
    moduleCode: PermissionModuleCode.MESSAGING,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.MESSAGING_MODERATION,
    descriptionLocaleCode:
      "permissions.submodules.messaging.moderation.description",
    moduleCode: PermissionModuleCode.MESSAGING,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.MESSAGING_FILTERS,
    descriptionLocaleCode:
      "permissions.submodules.messaging.filters.description",
    moduleCode: PermissionModuleCode.MESSAGING,
  },

  // Live Sessions
  {
    nameLocaleCode: PermissionSubmoduleCode.LIVE_ROOMS,
    descriptionLocaleCode:
      "permissions.submodules.live_sessions.rooms.description",
    moduleCode: PermissionModuleCode.LIVE_SESSIONS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.LIVE_TOKENS,
    descriptionLocaleCode:
      "permissions.submodules.live_sessions.tokens.description",
    moduleCode: PermissionModuleCode.LIVE_SESSIONS,
  },

  // Disputes
  {
    nameLocaleCode: PermissionSubmoduleCode.DISPUTES_MANAGEMENT,
    descriptionLocaleCode:
      "permissions.submodules.disputes.management.description",
    moduleCode: PermissionModuleCode.DISPUTES,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.DISPUTES_EVIDENCE,
    descriptionLocaleCode:
      "permissions.submodules.disputes.evidence.description",
    moduleCode: PermissionModuleCode.DISPUTES,
  },

  // Reviews
  {
    nameLocaleCode: PermissionSubmoduleCode.REVIEWS_MANAGEMENT,
    descriptionLocaleCode:
      "permissions.submodules.reviews.management.description",
    moduleCode: PermissionModuleCode.REVIEWS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.REVIEWS_MODERATION,
    descriptionLocaleCode:
      "permissions.submodules.reviews.moderation.description",
    moduleCode: PermissionModuleCode.REVIEWS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.REVIEWS_INCIDENTS,
    descriptionLocaleCode:
      "permissions.submodules.reviews.incidents.description",
    moduleCode: PermissionModuleCode.REVIEWS,
  },

  // Trust & Safety
  {
    nameLocaleCode: PermissionSubmoduleCode.TRUST_RISK_SCORES,
    descriptionLocaleCode:
      "permissions.submodules.trust_safety.risk_scores.description",
    moduleCode: PermissionModuleCode.TRUST_SAFETY,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.TRUST_SIGNALS,
    descriptionLocaleCode:
      "permissions.submodules.trust_safety.signals.description",
    moduleCode: PermissionModuleCode.TRUST_SAFETY,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.TRUST_IP_BLOCKS,
    descriptionLocaleCode:
      "permissions.submodules.trust_safety.ip_blocks.description",
    moduleCode: PermissionModuleCode.TRUST_SAFETY,
  },

  // Notifications
  {
    nameLocaleCode: PermissionSubmoduleCode.NOTIFICATIONS_SEND,
    descriptionLocaleCode:
      "permissions.submodules.notifications.send.description",
    moduleCode: PermissionModuleCode.NOTIFICATIONS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.NOTIFICATIONS_PREFS,
    descriptionLocaleCode:
      "permissions.submodules.notifications.prefs.description",
    moduleCode: PermissionModuleCode.NOTIFICATIONS,
  },

  // Analytics
  {
    nameLocaleCode: PermissionSubmoduleCode.ANALYTICS_REVENUE,
    descriptionLocaleCode:
      "permissions.submodules.analytics.revenue.description",
    moduleCode: PermissionModuleCode.ANALYTICS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.ANALYTICS_USERS,
    descriptionLocaleCode: "permissions.submodules.analytics.users.description",
    moduleCode: PermissionModuleCode.ANALYTICS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.ANALYTICS_REPORTS,
    descriptionLocaleCode:
      "permissions.submodules.analytics.reports.description",
    moduleCode: PermissionModuleCode.ANALYTICS,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.ANALYTICS_LEARNING,
    descriptionLocaleCode:
      "permissions.submodules.analytics.learning.description",
    moduleCode: PermissionModuleCode.ANALYTICS,
  },

  // Support
  {
    nameLocaleCode: PermissionSubmoduleCode.SUPPORT_TICKETS,
    descriptionLocaleCode: "permissions.submodules.support.tickets.description",
    moduleCode: PermissionModuleCode.SUPPORT,
  },
  {
    nameLocaleCode: PermissionSubmoduleCode.SUPPORT_DEAD_LETTER,
    descriptionLocaleCode:
      "permissions.submodules.support.dead_letter.description",
    moduleCode: PermissionModuleCode.SUPPORT,
  },

  // Audit
  {
    nameLocaleCode: PermissionSubmoduleCode.AUDIT_LOGS,
    descriptionLocaleCode: "permissions.submodules.audit.logs.description",
    moduleCode: PermissionModuleCode.AUDIT,
  },
];

const seedPermissionSubmodules = async () => {
  console.log("🌱 Seeding permission submodules...");

  let created = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const sub of submoduleDefinitions) {
      const module = await tx.permissionModule.findUnique({
        where: { nameLocaleCode: sub.moduleCode },
        select: { id: true },
      });

      if (!module) {
        throw new Error(
          `[PermissionSubmodules] Module not found: ${sub.moduleCode}. Run seedPermissionModules first.`
        );
      }

      const exists = await tx.permissionSubmodule.findUnique({
        where: { nameLocaleCode: sub.nameLocaleCode },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await tx.permissionSubmodule.create({
        data: {
          nameLocaleCode: sub.nameLocaleCode,
          descriptionLocaleCode: sub.descriptionLocaleCode,
          permissionModuleId: module.id,
        },
      });

      created++;
    }
  });

  console.log(
    `✅ Permission submodules seeded: ${created} created, ${skipped} skipped`
  );
};

export default seedPermissionSubmodules;
