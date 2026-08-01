import prisma from "../config/database.config";

/** Ensures the singleton PlatformCommission row exists so every escrow
 * release can safely `update` it instead of racing on `create`. */
export default async function seedPlatformCommission() {
  const existing = await prisma.platformCommission.findFirst();
  if (!existing) {
    await prisma.platformCommission.create({ data: { balanceXaf: 0 } });
  }
}
