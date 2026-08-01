import "dotenv/config";
import prisma from "./src/config/database.config";
import { sessionStartAt, sessionEndAt, watCalendarDate } from "./src/modules/availability/availability.logic";

async function main() {
  const today = watCalendarDate();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const bookings = await prisma.booking.findMany({
    where: {
      sessionType: "ONLINE",
      sessionDate: { gte: today, lt: tomorrow },
      status: { in: ["PAID", "IN_PROGRESS", "AWAITING_CONFIRMATION"] },
      deletedAt: null,
    },
    include: { liveRoom: true, tutorProfile: { select: { userId: true } } },
  });

  const now = new Date();
  console.log("now:", now.toISOString());
  console.log("today (WAT calendar marker):", today.toISOString());
  console.log("found bookings:", bookings.length);

  for (const b of bookings) {
    const start = sessionStartAt(b);
    const end = sessionEndAt(b);
    console.log(JSON.stringify({
      id: b.id,
      status: b.status,
      sessionDate: b.sessionDate.toISOString().slice(0, 10),
      sessionStartTime: b.sessionStartTime.toISOString().slice(11, 16),
      sessionEndTime: b.sessionEndTime.toISOString().slice(11, 16),
      computedStartAtUTC: start.toISOString(),
      computedEndAtUTC: end.toISOString(),
      minutesUntilStart: Math.round((start.getTime() - now.getTime()) / 60000),
      liveRoom: b.liveRoom
        ? {
            status: b.liveRoom.status,
            roomName: b.liveRoom.roomName,
            creationFailureReason: b.liveRoom.creationFailureReason,
            creationAttempts: b.liveRoom.creationAttempts,
            roomCreatedAt: b.liveRoom.roomCreatedAt,
          }
        : null,
    }, null, 2));
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
