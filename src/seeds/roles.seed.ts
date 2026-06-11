import prisma from "../config/database.config";

const defaultRoles = [
  {
    name: "Super Admin",
    description:
      "Full system access - Platform configuration, roles, permissions, and all administrative functions",
    isSystem: true,
  },
  {
    name: "Admin",
    description:
      "Platform administration - User management, content oversight, and operational configuration",
    isSystem: true,
  },
  {
    name: "Moderator",
    description:
      "Content and conduct moderation - Reviews flagged content, handles disputes between tutors and students",
    isSystem: true,
  },
  {
    name: "Tutor",
    description:
      "Tutoring service provider - Manages profile, availability, bookings, and learning materials",
    isSystem: true,
  },
  {
    name: "Parent",
    description:
      "Guardian account - Manages child accounts, bookings, payments, and progress tracking",
    isSystem: true,
  },
  {
    name: "Student",
    description:
      "Learner account - Books sessions, accesses learning materials, and communicates with tutors",
    isSystem: true,
  },
  {
    name: "Support Agent",
    description:
      "Customer support - Handles tickets and assists users with account and platform issues",
    isSystem: true,
  },
];

const seedRoles = async () => {
  console.log("🌱 Seeding roles...");

  let created = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const role of defaultRoles) {
      const exists = await tx.role.findUnique({
        where: { name: role.name },
      });

      if (exists) {
        skipped++;
        continue;
      }

      await tx.role.create({ data: role });
      created++;
    }
  });

  console.log(`✅ Roles seeded: ${created} created, ${skipped} skipped`);
};

export default seedRoles;
