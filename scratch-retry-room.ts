import "dotenv/config";
import { retryFailedRoomCreations } from "./src/services/liveSession/roomLifecycle.processor";
import prisma from "./src/config/database.config";

async function main() {
  const result = await retryFailedRoomCreations();
  console.log("retry result:", JSON.stringify(result));

  const room = await prisma.liveRoom.findUnique({ where: { bookingId: "a7c9a643-c575-40cb-801d-7027412ec17d" } });
  console.log("room now:", JSON.stringify(room, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
