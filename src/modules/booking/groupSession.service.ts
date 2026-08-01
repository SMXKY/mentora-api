import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { StatusCodes } from "http-status-codes";
import {
  BookingStatus,
  GroupSessionStatus,
  ParticipantPaymentStatus,
  WalletType,
  LedgerOperation,
  LedgerStatus,
  PaymentDirection,
  NotificationType,
  NotificationResourceType,
} from "../../generated/prisma";
import { ServiceContext } from "../../base/base.types";
import { getTutorProfileOrThrow } from "../../services/tutor/tutorProfile.util";
import { NotificationService } from "../../services/notification/notification.service";
import { EscrowService } from "../../services/payment/escrow.service";
import { WalletService } from "../../services/payment/wallet.service";
import { FapshiService } from "../../services/payment/fapshi.service";
import { paymentConfig } from "../../services/payment/paymentConfig";
import { timeStringToMinutes, minutesToDbTime } from "../availability/availability.logic";
import { scheduleGroupSessionCutoffJob } from "../../services/booking/groupSessionCutoff.processor";
import { BookingService } from "./booking.service";
import { CreateGroupSessionInput } from "./groupSession.types";

async function createGroupSession(tutorUserId: string, input: CreateGroupSessionInput, ctx: ServiceContext) {
  const profile = await getTutorProfileOrThrow(tutorUserId);
  await BookingService.assertApprovedSubjectLevel(profile.id, input.subjectId, input.levelId);
  void ctx;

  const startMinutes = timeStringToMinutes(input.sessionStartTime);
  const endMinutes = startMinutes + input.durationMinutes;
  if (endMinutes > 24 * 60) {
    throw new AppError("booking/errors:sessionCrossesMidnight", StatusCodes.BAD_REQUEST);
  }

  const { booking, groupSession } = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        tutorProfileId: profile.id,
        subjectId: input.subjectId,
        levelId: input.levelId,
        sessionType: input.sessionType,
        durationMinutes: input.durationMinutes,
        sessionDate: new Date(`${input.sessionDate}T00:00:00.000Z`),
        sessionStartTime: minutesToDbTime(startMinutes),
        sessionEndTime: minutesToDbTime(endMinutes),
        status: BookingStatus.ACCEPTED,
        isGroupSession: true,
      },
    });
    const groupSession = await tx.groupSession.create({
      data: {
        tutorProfileId: profile.id,
        bookingId: booking.id,
        subjectId: input.subjectId,
        levelId: input.levelId,
        topic: input.topic,
        minStudents: input.minStudents,
        maxStudents: input.maxStudents,
        pricePerStudentXaf: input.pricePerStudentXaf,
        registrationCutoffAt: new Date(input.registrationCutoffAt),
        status: GroupSessionStatus.DRAFT,
      },
    });
    return { booking, groupSession };
  });

  return { booking: BookingService.serializeBooking(booking), groupSession };
}

async function publishGroupSession(tutorUserId: string, bookingId: string) {
  const profile = await getTutorProfileOrThrow(tutorUserId);
  const groupSession = await prisma.groupSession.findFirst({ where: { bookingId, tutorProfileId: profile.id } });
  if (!groupSession) throw new AppError("booking/errors:groupSessionNotFound", StatusCodes.NOT_FOUND);
  if (groupSession.status !== GroupSessionStatus.DRAFT) {
    throw new AppError("booking/errors:groupSessionClosed", StatusCodes.CONFLICT);
  }

  const updated = await prisma.groupSession.update({
    where: { id: groupSession.id },
    data: { status: GroupSessionStatus.PUBLISHED },
  });

  await scheduleGroupSessionCutoffJob(updated.id, updated.registrationCutoffAt);
  return updated;
}

async function getGroupSession(bookingId: string) {
  const groupSession = await prisma.groupSession.findFirst({
    where: { bookingId },
    include: { participants: false } as any,
  });
  if (!groupSession) throw new AppError("booking/errors:groupSessionNotFound", StatusCodes.NOT_FOUND);
  const participants = await prisma.groupSessionParticipant.findMany({ where: { bookingId } });
  return { groupSession, participants };
}

async function joinGroupSession(userId: string, bookingId: string, studentProfileId: string | undefined) {
  const groupSession = await prisma.groupSession.findFirst({ where: { bookingId } });
  if (!groupSession) throw new AppError("booking/errors:groupSessionNotFound", StatusCodes.NOT_FOUND);
  if (groupSession.status !== GroupSessionStatus.PUBLISHED) {
    throw new AppError("booking/errors:groupSessionClosed", StatusCodes.CONFLICT);
  }
  if (groupSession.registrationCutoffAt < new Date()) {
    throw new AppError("booking/errors:groupSessionClosed", StatusCodes.CONFLICT);
  }

  const studentProfile = await BookingService.resolveStudentProfile(userId, studentProfileId);

  const existing = await prisma.groupSessionParticipant.findUnique({
    where: { bookingId_studentId: { bookingId, studentId: userId } },
  });
  if (existing) return existing;

  const currentCount = await prisma.groupSessionParticipant.count({ where: { bookingId } });
  if (currentCount >= groupSession.maxStudents) {
    throw new AppError("booking/errors:groupSessionFull", StatusCodes.CONFLICT);
  }

  return prisma.groupSessionParticipant.create({
    data: {
      bookingId,
      studentId: userId,
      studentProfileId: studentProfile.id,
      paymentStatus: ParticipantPaymentStatus.PENDING,
      agreedRateXaf: groupSession.pricePerStudentXaf,
    },
  });
}

async function loadPayableParticipant(bookingId: string, userId: string) {
  const participant = await prisma.groupSessionParticipant.findUnique({
    where: { bookingId_studentId: { bookingId, studentId: userId } },
  });
  if (!participant) throw new AppError("booking/errors:groupSessionNotFound", StatusCodes.NOT_FOUND);
  if (participant.paymentStatus !== ParticipantPaymentStatus.PENDING) {
    throw new AppError("payment/errors:escrowNotHeld", StatusCodes.CONFLICT);
  }
  const groupSession = await prisma.groupSession.findFirst({ where: { bookingId } });
  if (!groupSession) throw new AppError("booking/errors:groupSessionNotFound", StatusCodes.NOT_FOUND);
  const tutorProfile = await prisma.tutorProfile.findUnique({ where: { id: groupSession.tutorProfileId } });
  return { participant, groupSession, tutorProfile: tutorProfile! };
}

async function finalizeParticipantPayment(
  bookingId: string,
  userId: string,
  opts: { providerTransactionId?: string; momoPhone?: string; momoProvider?: string; ledgerOperation: LedgerOperation }
) {
  const { participant, tutorProfile } = await loadPayableParticipant(bookingId, userId);
  const { commissionRatePercent } = await paymentConfig.getAll();

  const { updatedParticipant, escrowHold } = await prisma.$transaction(async (tx) => {
    const escrowHold = await EscrowService.createEscrowHold(
      {
        bookingId,
        payerId: userId,
        tutorId: tutorProfile.userId,
        grossAmountXaf: participant.agreedRateXaf!,
        commissionRatePercent,
        groupParticipantId: participant.id,
      },
      tx
    );

    const updatedParticipant = await tx.groupSessionParticipant.update({
      where: { id: participant.id },
      data: {
        paymentStatus: ParticipantPaymentStatus.PAID,
        commissionAmountXaf: escrowHold.commissionAmountXaf,
        netTutorAmountXaf: escrowHold.netTutorAmountXaf,
        totalAmountXaf: participant.agreedRateXaf,
      },
    });

    await tx.transactionLedger.create({
      data: {
        fromUserId: userId,
        toUserId: tutorProfile.userId,
        operation: opts.ledgerOperation,
        direction: PaymentDirection.USER_TO_PLATFORM,
        status: LedgerStatus.SUCCESS,
        amountXaf: participant.agreedRateXaf!,
        providerTransactionId: opts.providerTransactionId,
        providerService: opts.providerTransactionId ? "fapshi" : undefined,
        momoPhone: opts.momoPhone,
        momoProvider: opts.momoProvider,
        bookingId,
        escrowHoldId: escrowHold.id,
        isPlatformReceiver: true,
      },
    });

    return { updatedParticipant, escrowHold };
  });

  await NotificationService.send({
    type: NotificationType.PAYMENT_CONFIRMED,
    target: { kind: "user", userId },
    resourceType: NotificationResourceType.PAYMENT,
    resourceId: updatedParticipant.id,
  });

  return { participant: updatedParticipant, escrowHold };
}

async function walletCheckoutParticipant(userId: string, bookingId: string) {
  const { participant } = await loadPayableParticipant(bookingId, userId);
  const wallet = await WalletService.getOrCreateWallet(userId, WalletType.STUDENT);
  if (wallet.balanceXaf < participant.agreedRateXaf!) {
    throw new AppError("payment/errors:insufficientBalance", StatusCodes.BAD_REQUEST);
  }
  await prisma.wallet.update({
    where: { userId },
    data: { balanceXaf: { decrement: participant.agreedRateXaf! } },
  });
  return finalizeParticipantPayment(bookingId, userId, { ledgerOperation: LedgerOperation.BOOKING_PAYMENT });
}

async function directMomoCheckoutParticipant(userId: string, bookingId: string, phone: string) {
  const { participant } = await loadPayableParticipant(bookingId, userId);
  const initiated = await FapshiService.directPay({
    amount: participant.agreedRateXaf!,
    phone,
    userId,
    externalId: `${bookingId}-${userId}`,
    message: "Mentora group session payment",
  });
  const status = await FapshiService.paymentStatus(initiated.transId);
  if (status.status !== "SUCCESSFUL") {
    throw new AppError("payment/errors:directPayFailed", StatusCodes.BAD_GATEWAY, { status: status.status });
  }
  return finalizeParticipantPayment(bookingId, userId, {
    providerTransactionId: initiated.transId,
    momoPhone: phone,
    momoProvider: FapshiService.detectMedium(phone),
    ledgerOperation: LedgerOperation.BOOKING_PAYMENT_MOMO,
  });
}

export const GroupSessionService = {
  createGroupSession,
  publishGroupSession,
  getGroupSession,
  joinGroupSession,
  walletCheckoutParticipant,
  directMomoCheckoutParticipant,
};

export default GroupSessionService;
