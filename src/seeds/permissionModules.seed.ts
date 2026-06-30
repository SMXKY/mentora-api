import prisma from "../config/database.config";

export const PermissionModuleCode = {
  PLATFORM: "permissions.modules.platform",
  RBAC: "permissions.modules.rbac",
  USERS: "permissions.modules.users",
  KYC: "permissions.modules.kyc",
  SEARCH: "permissions.modules.search",
  BOOKINGS: "permissions.modules.bookings",
  PAYMENTS: "permissions.modules.payments",
  MEDIA: "permissions.modules.media",
  MATERIALS: "permissions.modules.materials",
  MESSAGING: "permissions.modules.messaging",
  LIVE_SESSIONS: "permissions.modules.live_sessions",
  DISPUTES: "permissions.modules.disputes",
  REVIEWS: "permissions.modules.reviews",
  TRUST_SAFETY: "permissions.modules.trust_safety",
  NOTIFICATIONS: "permissions.modules.notifications",
  ANALYTICS: "permissions.modules.analytics",
  SUPPORT: "permissions.modules.support",
  AUDIT: "permissions.modules.audit",
} as const;

export type PermissionModuleCode =
  (typeof PermissionModuleCode)[keyof typeof PermissionModuleCode];

const moduleDefinitions: Array<{
  nameLocaleCode: string;
  descriptionLocaleCode: string;
}> = [
  {
    nameLocaleCode: PermissionModuleCode.PLATFORM,
    descriptionLocaleCode: "permissions.modules.platform.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.RBAC,
    descriptionLocaleCode: "permissions.modules.rbac.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.USERS,
    descriptionLocaleCode: "permissions.modules.users.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.KYC,
    descriptionLocaleCode: "permissions.modules.kyc.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.SEARCH,
    descriptionLocaleCode: "permissions.modules.search.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.BOOKINGS,
    descriptionLocaleCode: "permissions.modules.bookings.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.PAYMENTS,
    descriptionLocaleCode: "permissions.modules.payments.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.MEDIA,
    descriptionLocaleCode: "permissions.modules.media.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.MATERIALS,
    descriptionLocaleCode: "permissions.modules.materials.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.MESSAGING,
    descriptionLocaleCode: "permissions.modules.messaging.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.LIVE_SESSIONS,
    descriptionLocaleCode: "permissions.modules.live_sessions.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.DISPUTES,
    descriptionLocaleCode: "permissions.modules.disputes.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.REVIEWS,
    descriptionLocaleCode: "permissions.modules.reviews.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.TRUST_SAFETY,
    descriptionLocaleCode: "permissions.modules.trust_safety.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.NOTIFICATIONS,
    descriptionLocaleCode: "permissions.modules.notifications.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.ANALYTICS,
    descriptionLocaleCode: "permissions.modules.analytics.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.SUPPORT,
    descriptionLocaleCode: "permissions.modules.support.description",
  },
  {
    nameLocaleCode: PermissionModuleCode.AUDIT,
    descriptionLocaleCode: "permissions.modules.audit.description",
  },
];

const seedPermissionModules = async () => {
  console.log("🌱 Seeding permission modules...");

  let created = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const mod of moduleDefinitions) {
      const exists = await tx.permissionModule.findUnique({
        where: { nameLocaleCode: mod.nameLocaleCode },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await tx.permissionModule.create({ data: mod });
      created++;
    }
  });

  console.log(
    `✅ Permission modules seeded: ${created} created, ${skipped} skipped`
  );
};

export default seedPermissionModules;
