import { Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { catchAsync } from "../../utils/catchAsync.util";
import { appResponder } from "../../utils/appResponder.util";
import { buildContext } from "../../utils/buildContext.util";
import { AuthService, ClerkSessionClaims } from "./auth.service";
import { StatusCodes } from "http-status-codes";

export class AuthController {
  completeRegistration = catchAsync(
    async (req: Request, res: Response): Promise<void> => {
      const ctx = buildContext(req, res);

      const { sessionClaims } = getAuth(req);
      const claims = (sessionClaims ?? {}) as ClerkSessionClaims;

      const langHeader = req.headers["x-lang"] as string | undefined;

      const user = await AuthService.completeRegistration(
        req.body,
        ctx,
        claims,
        langHeader
      );

      appResponder(StatusCodes.CREATED, user, res);
    }
  );

  me = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const ctx = buildContext(req, res);

    const result = await AuthService.getSessionStatus(ctx);

    appResponder(StatusCodes.OK, result, res);
  });
}

export const authController = new AuthController();
