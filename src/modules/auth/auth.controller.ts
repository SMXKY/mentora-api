import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { appResponder } from "../../utils/appResponder.util";
import { buildContext } from "../../utils/buildContext.util";
import { AuthService } from "./auth.service";
import { StatusCodes } from "http-status-codes";

export class AuthController {
  requestPhoneOtp = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { phone } = req.body;
      await AuthService.requestPhoneOtp(phone);
      appResponder(StatusCodes.OK, {}, res);
    }
  );

  verifyPhoneOtp = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { phone, code } = req.body;
      const result = await AuthService.verifyPhoneOtp(phone, code);
      appResponder(StatusCodes.OK, result, res);
    }
  );

  requestEmailOtp = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { email } = req.body;
      await AuthService.requestEmailOtp(email);
      appResponder(StatusCodes.OK, {}, res);
    }
  );

  verifyEmailOtp = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { email, code } = req.body;
      const result = await AuthService.verifyEmailOtp(email, code);
      appResponder(StatusCodes.OK, result, res);
    }
  );

  googleAuth = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { idToken } = req.body;
      const result = await AuthService.googleAuth(idToken);
      appResponder(StatusCodes.OK, result, res);
    }
  );

  completeRegistration = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const result = await AuthService.completeRegistration(req.body);
      appResponder(StatusCodes.CREATED, result, res);
    }
  );

  createAdminUser = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const result = await AuthService.createAdminUser(req.body, ctx);
      appResponder(StatusCodes.CREATED, result, res);
    }
  );

  me = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);
    const result = await AuthService.getSessionStatus(ctx);
    appResponder(StatusCodes.OK, result, res);
  });
}

export const authController = new AuthController();
