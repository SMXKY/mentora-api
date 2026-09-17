import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { buildContext } from "../../utils/buildContext.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import { BookingService } from "./booking.service";
import { BookingSeriesService } from "./bookingSeries.service";
import { CheckinService } from "./checkin.service";
import { RescheduleService } from "./reschedule.service";
import { LessonConfirmationService } from "../../services/dispute/lessonConfirmation.service";

export const bookingController = {
  create: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const booking = await BookingService.createBookingRequest(ctx.userId!, req.body, ctx);
    appResponder(StatusCodes.CREATED, { booking }, res);
  }),

  accept: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const booking = await BookingService.acceptBooking(ctx.userId!, req.params.id, ctx);
    appResponder(StatusCodes.OK, { booking }, res);
  }),

  reject: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const booking = await BookingService.rejectBooking(ctx.userId!, req.params.id, req.body.reason, ctx);
    appResponder(StatusCodes.OK, { booking }, res);
  }),

  withdraw: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const booking = await BookingService.withdrawBooking(ctx.userId!, req.params.id, ctx);
    appResponder(StatusCodes.OK, { booking }, res);
  }),

  cancelByTutor: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const booking = await BookingService.cancelByTutor(ctx.userId!, req.params.id, req.body.reason, ctx);
    appResponder(StatusCodes.OK, { booking }, res);
  }),

  cancelByParent: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const booking = await BookingService.cancelByParent(ctx.userId!, req.params.id, req.body.reason, ctx);
    appResponder(StatusCodes.OK, { booking }, res);
  }),

  getOne: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const { booking } = await BookingService.getBookingForUser(req.params.id, ctx.userId!);
    appResponder(StatusCodes.OK, { booking: BookingService.serializeBooking(booking) }, res);
  }),

  listAsBooker: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await BookingService.listMyBookings(ctx.userId!, "BOOKER", req.query as any);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  listAsTutor: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await BookingService.listMyBookings(ctx.userId!, "TUTOR", req.query as any);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  createRecurring: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await BookingSeriesService.createRecurringBookingRequest(ctx.userId!, req.body, ctx);
    appResponder(StatusCodes.CREATED, result, res);
  }),

  getSeries: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await BookingSeriesService.listSeriesBookings(ctx.userId!, req.params.seriesId);
    appResponder(StatusCodes.OK, result, res);
  }),

  checkIn: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const booking = await CheckinService.checkIn(ctx.userId!, req.params.id, req.body);
    appResponder(StatusCodes.OK, { booking }, res);
  }),

  checkOut: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const booking = await CheckinService.checkOut(ctx.userId!, req.params.id, req.body);
    appResponder(StatusCodes.OK, { booking }, res);
  }),

  triggerSos: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const alert = await CheckinService.triggerSos(ctx.userId!, req.params.id, req.body);
    appResponder(StatusCodes.CREATED, { alert }, res);
  }),

  requestReschedule: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const request = await RescheduleService.requestReschedule(ctx.userId!, req.params.id, req.body, ctx);
    appResponder(StatusCodes.CREATED, { request }, res);
  }),

  getPendingReschedule: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const request = await RescheduleService.getPendingRescheduleForBooking(ctx.userId!, req.params.id);
    appResponder(StatusCodes.OK, { request }, res);
  }),

  confirm: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const booking = await LessonConfirmationService.confirmLesson(ctx.userId!, req.params.id);
    appResponder(StatusCodes.OK, { booking }, res);
  }),

  listAdmin: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await BookingService.listAdminBookings(req.query as any);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  getAdminOne: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const booking = await BookingService.getAdminBooking(req.params.id);
    appResponder(StatusCodes.OK, { booking }, res);
  }),

  listLiveHomeSessions: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const sessions = await BookingService.listLiveHomeSessions();
    appResponder(StatusCodes.OK, { sessions }, res);
  }),

  getDossier: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const dossier = await BookingService.getBookingDossier(req.params.id);
    appResponder(StatusCodes.OK, { dossier }, res);
  }),

  listSafetyAlerts: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const result = await CheckinService.listSafetyAlerts(req.query as any);
    appResponder(StatusCodes.OK, result.data, res, result.meta);
  }),

  resolveSafetyAlert: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const alert = await CheckinService.resolveSafetyAlert(ctx.userId!, req.params.alertId, req.body.resolutionNote);
    appResponder(StatusCodes.OK, { alert }, res);
  }),

  respondToReschedule: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const request = await RescheduleService.respondToReschedule(
      ctx.userId!,
      req.params.requestId,
      req.body.accept,
      req.body.rejectionReason,
      ctx
    );
    appResponder(StatusCodes.OK, { request }, res);
  }),
};

export default bookingController;
