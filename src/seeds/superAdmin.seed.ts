import * as dotenv from "dotenv";
import prisma from "../config/database.config";
import argon2 from "argon2";
dotenv.config();

export const seedSuperAdmin = async (): Promise<void> => {
  const {
    SUPER_ADMIN_EMAIL,
    SUPER_ADMIN_PASSWORD,
    SUPER_ADMIN_FIRST_NAME,
    SUPER_ADMIN_LAST_NAME,
    SUPER_ADMIN_USERNAME,
  } = process.env;

  if (
    !SUPER_ADMIN_EMAIL ||
    !SUPER_ADMIN_PASSWORD ||
    !SUPER_ADMIN_FIRST_NAME ||
    !SUPER_ADMIN_LAST_NAME ||
    !SUPER_ADMIN_USERNAME
  ) {
    console.warn("⚠️  Super Admin env vars missing. Skipping.");
    return;
  }

  const exists = await prisma.user.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
  });

  if (exists) {
    console.log("ℹ️  Super Admin already exists, skipping.");
    return;
  }

  const superAdminRole = await prisma.role.findUnique({
    where: { name: "Super Admin" },
  });

  if (!superAdminRole) {
    console.error("❌ 'Super Admin' role not found. Seed roles first.");
    return;
  }

  const hashedPassword = await argon2.hash(SUPER_ADMIN_PASSWORD);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        password: hashedPassword,
        firstName: SUPER_ADMIN_FIRST_NAME,
        lastName: SUPER_ADMIN_LAST_NAME,
        username: SUPER_ADMIN_USERNAME,
        isEmailVerified: true,
        isSystem: true,
        passwordChangedAt: new Date(),
      },
      select: { id: true, email: true },
    });

    await tx.userRole.create({
      data: {
        userId: newUser.id,
        roleId: superAdminRole.id,
        createdById: newUser.id,
      },
    });

    await tx.wallet.create({
      data: {
        userId: newUser.id,
        walletType: "PARENT",
        balanceXaf: 0,
      },
    });

    return newUser;
  });

  console.log(`✅ Super Admin created: ${user.email}`);
};

export default seedSuperAdmin;
