import "dotenv/config";
import prisma from "../src/config/database.config";
import { runSeeds } from "../src/seeds";

runSeeds()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
