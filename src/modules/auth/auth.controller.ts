import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { appResponder } from "../../utils/appResponder.util";
import { buildContext } from "../../utils/buildContext.util";
import { AuthService } from "./auth.service";
import { StatusCodes } from "http-status-codes";
import { OtpService } from "../../services/otp";
import { AppError } from "../../utils/AppError.util";

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
      const userAgent = req.headers["user-agent"];
      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip;

      const result = await AuthService.googleAuth(idToken, userAgent, ip);
      appResponder(StatusCodes.OK, result, res);
    }
  );

  completeRegistration = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const result = await AuthService.completeRegistration(req.body, ctx);
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

  getCompletion = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const result = await AuthService.getCompletion(ctx);
      appResponder(StatusCodes.OK, result, res);
    }
  );

  login = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { identifier, password } = req.body;
    const userAgent = req.headers["user-agent"];
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      req.ip;

    const result = await AuthService.login(identifier, password, userAgent, ip);
    appResponder(StatusCodes.OK, result, res);
  });

  loginAdmin = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { identifier, password } = req.body;
      const userAgent = req.headers["user-agent"];
      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip;

      const result = await AuthService.loginAdmin(
        identifier,
        password,
        userAgent,
        ip
      );
      appResponder(StatusCodes.OK, result, res);
    }
  );

  changePassword = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const { currentPassword, newPassword } = req.body;
      const result = await AuthService.changePassword(
        ctx,
        currentPassword,
        newPassword
      );
      appResponder(StatusCodes.OK, result, res);
    }
  );

  forgotPassword = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { identity } = req.body;
      await AuthService.forgotPassword(identity);
      appResponder(StatusCodes.OK, {}, res);
    }
  );

  verifyResetOtp = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { identity, code } = req.body;
      const result = await AuthService.verifyResetOtp(identity, code);
      appResponder(StatusCodes.OK, result, res);
    }
  );

  resetPassword = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const { resetToken, newPassword, confirmPassword } = req.body;
      const ctx = buildContext(req, res);
      const result = await AuthService.resetPassword(
        resetToken,
        newPassword,
        confirmPassword,
        ctx
      );
      appResponder(StatusCodes.OK, result, res);
    }
  );

  requestDeactivationOtp = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      await AuthService.requestDeactivationOtp(ctx);
      appResponder(StatusCodes.OK, {}, res);
    }
  );

  deactivateMe = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);
      const result = await AuthService.deactivateAccount(ctx, req.body);
      appResponder(StatusCodes.OK, result, res);
    }
  );

  reactivateMe = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const userAgent = req.headers["user-agent"];
      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        req.ip;
      const result = await AuthService.reactivateAccount(
        req.body,
        ip,
        userAgent
      );
      appResponder(StatusCodes.OK, result, res);
    }
  );

  // ============================================================
  // DEV-ONLY: read back a pending email/phone OTP without needing
  // a real inbox/SMS. Disabled entirely in production. Exists so
  // automated tooling (k6 load tests) can exercise the OTP-verify
  // paths end to end against local/staging environments.
  // ============================================================
  devPeekOtp = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      if (process.env.NODE_ENV === "production") {
        throw new AppError("common/errors:notFound", StatusCodes.NOT_FOUND);
      }
      const identity = req.query.identity as string;
      const code = await OtpService.peekOtp(identity);
      appResponder(StatusCodes.OK, { code }, res);
    }
  );
}

export const authController = new AuthController();
