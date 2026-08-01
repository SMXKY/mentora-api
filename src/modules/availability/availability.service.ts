import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { AvailabilitySlotType, BookingStatus } from "../../generated/prisma";
import { getTutorProfileOrThrow } from "../../services/tutor/tutorProfile.util";
import { queueScoreRecompute } from "../../services/search/searchScore.processor";
import {
  dayOfWeekFromDateString,
  timeStringToMinutes,
  minutesToTimeString,
  dbTimeToMinutes,
  minutesToDbTime,
  subtractBookedWindows,
  MinuteWindow,
} from "./availability.logic";
import { CreateAvailabilitySlotInput, UpdateAvailabilitySlotInput } from "./availability.types";

// Bookings in any of these statuses no longer occupy the tutor's calendar.
const NON_OCCUPYING_STATUSES: BookingStatus[] = [
  BookingStatus.REJECTED,
  BookingStatus.CANCELLED_UNPAID,
  BookingStatus.CANCELLED_BY_TUTOR,
  BookingStatus.CANCELLED_BY_PARENT,
];

function serializeSlot(slot: {
  id: string;
  slotType: AvailabilitySlotType;
  dayOfWeek: string | null;
  startTime: Date;
  endTime: Date;
  specificDate: Date | null;
  bufferMinutes: number;
  isActive: boolean;
}) {
  return {
    id: slot.id,
    slotType: slot.slotType,
    dayOfWeek: slot.dayOfWeek,
    startTime: minutesToTimeString(dbTimeToMinutes(slot.startTime)),
    endTime: minutesToTimeString(dbTimeToMinutes(slot.endTime)),
    specificDate: slot.specificDate ? slot.specificDate.toISOString().slice(0, 10) : null,
    bufferMinutes: slot.bufferMinutes,
    isActive: slot.isActive,
  };
}

async function listMySlots(userId: string) {
  const profile = await getTutorProfileOrThrow(userId);
  const slots = await prisma.availabilitySlot.findMany({
    where: { tutorProfileId: profile.id },
    orderBy: [{ slotType: "asc" }, { dayOfWeek: "asc" }, { specificDate: "asc" }],
  });
  return slots.map(serializeSlot);
}

async function createSlot(userId: string, input: CreateAvailabilitySlotInput) {
  const profile = await getTutorProfileOrThrow(userId);

  const startTime = minutesToDbTime(timeStringToMinutes(input.startTime));
  const endTime = minutesToDbTime(timeStringToMinutes(input.endTime));

  const duplicate = await prisma.availabilitySlot.findFirst({
    where: {
      tutorProfileId: profile.id,
      slotType: input.slotType,
      isActive: true,
      ...(input.slotType === "RECURRING"
        ? { dayOfWeek: input.dayOfWeek }
        : { specificDate: new Date(`${input.specificDate}T00:00:00.000Z`) }),
      startTime,
      endTime,
    },
  });
  if (duplicate) {
    throw new AppError("availability/errors:duplicateSlot", StatusCodes.CONFLICT);
  }

  const slot = await prisma.availabilitySlot.create({
    data: {
      tutorProfileId: profile.id,
      slotType: input.slotType,
      dayOfWeek: input.slotType === "RECURRING" ? input.dayOfWeek : null,
      specificDate:
        input.slotType === "SPECIFIC_DATE" ? new Date(`${input.specificDate}T00:00:00.000Z`) : null,
      startTime,
      endTime,
      bufferMinutes: input.bufferMinutes,
    },
  });

  await queueScoreRecompute(profile.id);
  return serializeSlot(slot);
}

async function updateSlot(userId: string, slotId: string, input: UpdateAvailabilitySlotInput) {
  const profile = await getTutorProfileOrThrow(userId);
  const existing = await prisma.availabilitySlot.findFirst({
    where: { id: slotId, tutorProfileId: profile.id },
  });
  if (!existing) {
    throw new AppError("availability/errors:slotNotFound", StatusCodes.NOT_FOUND);
  }

  const slot = await prisma.availabilitySlot.update({
    where: { id: slotId },
    data: {
      startTime: input.startTime ? minutesToDbTime(timeStringToMinutes(input.startTime)) : undefined,
      endTime: input.endTime ? minutesToDbTime(timeStringToMinutes(input.endTime)) : undefined,
      bufferMinutes: input.bufferMinutes,
      isActive: input.isActive,
    },
  });

  await queueScoreRecompute(profile.id);
  return serializeSlot(slot);
}

async function deleteSlot(userId: string, slotId: string) {
  const profile = await getTutorProfileOrThrow(userId);
  const existing = await prisma.availabilitySlot.findFirst({
    where: { id: slotId, tutorProfileId: profile.id },
  });
  if (!existing) {
    throw new AppError("availability/errors:slotNotFound", StatusCodes.NOT_FOUND);
  }
  await prisma.availabilitySlot.delete({ where: { id: slotId } });
  await queueScoreRecompute(profile.id);
}

/**
 * Open time windows (in "HH:mm") for a given tutor on a given date,
 * accounting for their declared recurring/specific-date slots minus
 * whatever's already booked (+ buffer) around each existing booking.
 */
async function getAvailableWindows(tutorProfileId: string, date: string) {
  const dayOfWeek = dayOfWeekFromDateString(date);
  const specificDate = new Date(`${date}T00:00:00.000Z`);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      tutorProfileId,
      isActive: true,
      OR: [
        { slotType: AvailabilitySlotType.RECURRING, dayOfWeek },
        { slotType: AvailabilitySlotType.SPECIFIC_DATE, specificDate },
      ],
    },
  });

  if (slots.length === 0) return [];

  const rawWindows: MinuteWindow[] = slots.map((s) => ({
    startMinutes: dbTimeToMinutes(s.startTime),
    endMinutes: dbTimeToMinutes(s.endTime),
  }));
  // Buffer isn't tied to a specific booking, so apply the tutor's own
  // widest configured buffer around every existing booking that day.
  const bufferMinutes = Math.max(...slots.map((s) => s.bufferMinutes));

  const bookings = await prisma.booking.findMany({
    where: {
      tutorProfileId,
      sessionDate: specificDate,
      status: { notIn: NON_OCCUPYING_STATUSES },
      deletedAt: null,
    },
    select: { sessionStartTime: true, sessionEndTime: true },
  });

  const booked = bookings.map((b) => ({
    startMinutes: dbTimeToMinutes(b.sessionStartTime),
    endMinutes: dbTimeToMinutes(b.sessionEndTime),
    bufferMinutes,
  }));

  const openWindows = subtractBookedWindows(rawWindows, booked);
  return openWindows.map((w) => ({
    startTime: minutesToTimeString(w.startMinutes),
    endTime: minutesToTimeString(w.endMinutes),
  }));
}

/** Used by the booking service to reject a request that doesn't fit an open window. */
async function isWindowAvailable(
  tutorProfileId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const windows = await getAvailableWindows(tutorProfileId, date);
  const requestedStart = timeStringToMinutes(startTime);
  const requestedEnd = timeStringToMinutes(endTime);
  return windows.some((w) => {
    const wStart = timeStringToMinutes(w.startTime);
    const wEnd = timeStringToMinutes(w.endTime);
    return requestedStart >= wStart && requestedEnd <= wEnd;
  });
}

export const AvailabilityService = {
  listMySlots,
  createSlot,
  updateSlot,
  deleteSlot,
  getAvailableWindows,
  isWindowAvailable,
};

export default AvailabilityService;
