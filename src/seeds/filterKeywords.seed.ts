import prisma from "../config/database.config";
import { DEFAULT_INTENT_KEYWORDS } from "../services/messaging/contentFilter";

/** Seeds Module 15's Layer-3 intent-keyword list — admin-editable afterwards, this just gives it a real starting point. */
export default async function seedFilterKeywords() {
  const systemActor = await prisma.user.findFirst({
    where: { email: process.env.SUPER_ADMIN_EMAIL },
    select: { id: true },
  });
  if (!systemActor) {
    console.log("⚠️  Skipping filter-keyword seed — no Super Admin user found yet.");
    return;
  }

  for (const { keyword, language } of DEFAULT_INTENT_KEYWORDS) {
    await prisma.filterKeyword.upsert({
      where: { keyword_language: { keyword, language } },
      create: { keyword, language, addedById: systemActor.id },
      update: {},
    });
  }
}
