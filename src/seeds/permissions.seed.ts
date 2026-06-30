import prisma from "../config/database.config";
import {
  permissionDefinitions,
  rolePermissionAssignments,
} from "../data/permission.data";

const seedPermissions = async () => {
  console.log("🌱 Seeding permissions...");

  const user = await prisma.user.findFirst({
    where: {
      isSystem: true,
    },
  });

  if (!user) throw new Error("No system user found during permission seed.");
  const systemUserId = user.id;

  let permCreated = 0;
  let permSkipped = 0;
  let implCreated = 0;
  let implSkipped = 0;
  let rolePermCreated = 0;
  let rolePermSkipped = 0;

  for (const def of permissionDefinitions) {
    const module = await prisma.permissionModule.findUnique({
      where: { nameLocaleCode: def.moduleCode },
      select: { id: true },
    });

    if (!module) {
      throw new Error(
        `[Permissions] Module not found: ${def.moduleCode}. Run seedPermissionModules first.`
      );
    }

    const submodule = await prisma.permissionSubmodule.findUnique({
      where: { nameLocaleCode: def.submoduleCode },
      select: { id: true },
    });

    if (!submodule) {
      throw new Error(
        `[Permissions] Submodule not found: ${def.submoduleCode}. Run seedPermissionSubmodules first.`
      );
    }

    const exists = await prisma.permission.findUnique({
      where: { code: def.code },
    });

    if (exists) {
      permSkipped++;
      continue;
    }

    await prisma.permission.create({
      data: {
        code: def.code,
        nameLocaleCode: def.nameLocaleCode,
        descriptionLocaleCode: def.descriptionLocaleCode,
        permissionModuleId: module.id,
        permissionSubmoduleId: submodule.id,
        isSystem: def.isSystem,
        riskLevel: def.riskLevel,
      },
    });

    permCreated++;
  }

  console.log(
    `  ✔ Permissions: ${permCreated} created, ${permSkipped} skipped`
  );

  // ─── 2. Seed implications ──────────────────────────────────────────────────
  for (const def of permissionDefinitions) {
    if (!def.implies.length) continue;

    const source = await prisma.permission.findUnique({
      where: { code: def.code },
      select: { id: true },
    });

    if (!source) continue;

    for (const impliedCode of def.implies) {
      const target = await prisma.permission.findUnique({
        where: { code: impliedCode },
        select: { id: true },
      });

      if (!target) {
        throw new Error(
          `[Implications] Implied permission not found: "${impliedCode}" (implied by "${def.code}"). Check permissions.data.ts.`
        );
      }

      const exists = await prisma.permissionImplication.findUnique({
        where: {
          permissionId_impliedPermissionId: {
            permissionId: source.id,
            impliedPermissionId: target.id,
          },
        },
      });

      if (exists) {
        implSkipped++;
        continue;
      }

      await prisma.permissionImplication.create({
        data: {
          permissionId: source.id,
          impliedPermissionId: target.id,
        },
      });

      implCreated++;
    }
  }

  console.log(
    `  ✔ Implications: ${implCreated} created, ${implSkipped} skipped`
  );

  // ─── 3. Seed role permission assignments ───────────────────────────────────
  for (const [roleName, permissionCodes] of Object.entries(
    rolePermissionAssignments
  )) {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
      select: { id: true },
    });

    if (!role) {
      throw new Error(
        `[RolePermissions] Role not found: "${roleName}". Run seedRoles first.`
      );
    }

    for (const code of permissionCodes) {
      const permission = await prisma.permission.findUnique({
        where: { code },
        select: { id: true },
      });

      if (!permission) {
        throw new Error(
          `[RolePermissions] Permission not found: "${code}" for role "${roleName}". Check permissions.data.ts.`
        );
      }

      const exists = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
      });

      if (exists) {
        rolePermSkipped++;
        continue;
      }

      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
          createdById: systemUserId,
        },
      });

      rolePermCreated++;
    }
  }

  console.log(
    `  ✔ Role permissions: ${rolePermCreated} created, ${rolePermSkipped} skipped`
  );

  console.log("✅ Permissions seeded.");
};

export default seedPermissions;
