import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import { BookingStatus, NotificationType, NotificationResourceType } from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import { NotificationService } from "../../services/notification/notification.service";
import { AvailabilityService } from "../availability/availability.service";
import { timeStringToMinutes, minutesToTimeString, minutesToDbTime } from "../availability/availability.logic";
import { computeOccurrenceDates, RecurrenceType } from "../../services/booking/recurrence.util";
import { BookingService } from "./booking.service";

export interface CreateRecurringBookingInput {
  tutorProfileId: string;
  studentProfileId?: string;
  subjectId: string;
  levelId: string;
  sessionType: "ONLINE" | "HOME";
  sessionStartTime: string;
  durationMinutes: number;
  recurrenceType: RecurrenceType;
  startDate: string;
  endDate?: string;
  occurrenceCount?: number;
  recurrenceDays?: string[];
  messageToTutor?: string;
}

async function createRecurringBookingRequest(userId: string, input: CreateRecurringBookingInput, ctx: ServiceContext) {
  const [tutor, studentProfile] = await Promise.all([
    BookingService.assertBookableTutor(input.tutorProfileId),
    BookingService.resolveStudentProfile(userId, input.studentProfileId),
  ]);
  BookingService.assertSessionTypeAllowed(tutor.teachingMode, input.sessionType);
  const tutorSubject = await BookingService.assertApprovedSubjectLevel(input.tutorProfileId, input.subjectId, input.levelId);
  const agreedRateXaf = BookingService.computeAgreedRateXaf(tutorSubject, input.sessionType, input.durationMinutes);
  if (!agreedRateXaf) {
    throw new AppError("booking/errors:tutorRateNotSet", StatusCodes.BAD_REQUEST);
  }

  const dates = computeOccurrenceDates(input);
  if (dates.length === 0) {
    throw new AppError("booking/errors:noOccurrencesGenerated", StatusCodes.BAD_REQUEST);
  }

  const series = await prisma.bookingSeries.create({
    data: {
      parentId: userId,
      tutorProfileId: input.tutorProfileId,
      subjectId: input.subjectId,
      levelId: input.levelId,
      sessionType: input.sessionType,
      recurrenceType: input.recurrenceType,
      recurrenceDays: input.recurrenceType === "CUSTOM" ? dates : [],
      startDate: new Date(`${dates[0]}T00:00:00.000Z`),
      endDate: input.endDate ? new Date(`${input.endDate}T00:00:00.000Z`) : null,
      occurrenceCount: dates.length,
      durationMinutes: input.durationMinutes,
    },
  });

  const startMinutes = timeStringToMinutes(input.sessionStartTime);
  const endMinutes = startMinutes + input.durationMinutes;
  if (endMinutes > 24 * 60) {
    throw new AppError("booking/errors:sessionCrossesMidnight", StatusCodes.BAD_REQUEST);
  }
  const sessionEndTimeStr = minutesToTimeString(endMinutes);

  const created: any[] = [];
  const skipped: string[] = [];

  for (const date of dates) {
    const available = await AvailabilityService.isWindowAvailable(
      input.tutorProfileId,
      date,
      input.sessionStartTime,
      sessionEndTimeStr
    );
    if (!available) {
      skipped.push(date);
      continue;
    }

    const booking = await prisma.booking.create({
      data: {
        bookerId: userId,
        studentProfileId: studentProfile.id,
        tutorProfileId: input.tutorProfileId,
        subjectId: input.subjectId,
        levelId: input.levelId,
        sessionType: input.sessionType,
        durationMinutes: input.durationMinutes,
        messageToTutor: input.messageToTutor,
        sessionDate: new Date(`${date}T00:00:00.000Z`),
        sessionStartTime: minutesToDbTime(startMinutes),
        sessionEndTime: minutesToDbTime(endMinutes),
        agreedRateXaf,
        status: BookingStatus.REQUESTED,
        seriesId: series.id,
      },
    });
    created.push(BookingService.serializeBooking(booking));
  }

  if (created.length > 0) {
    await NotificationService.send({
      type: NotificationType.BOOKING_REQUESTED,
      target: { kind: "user", userId: tutor.userId },
      resourceType: NotificationResourceType.BOOKING,
      resourceId: series.id,
    });
  }

  return { seriesId: series.id, created, skipped };
}

async function listSeriesBookings(userId: string, seriesId: string) {
  const series = await prisma.bookingSeries.findFirst({ where: { id: seriesId } });
  if (!series) throw new AppError("booking/errors:seriesNotFound", StatusCodes.NOT_FOUND);

  const tutorProfile = await prisma.tutorProfile.findUnique({ where: { id: series.tutorProfileId } });
  if (series.parentId !== userId && tutorProfile?.userId !== userId) {
    throw new AppError("booking/errors:notYourBooking", StatusCodes.FORBIDDEN);
  }

  const bookings = await prisma.booking.findMany({
    where: { seriesId, deletedAt: null },
    orderBy: { sessionDate: "asc" },
  });
  return { series, bookings: bookings.map(BookingService.serializeBooking) };
}

export const BookingSeriesService = { createRecurringBookingRequest, listSeriesBookings };
export default BookingSeriesService;
