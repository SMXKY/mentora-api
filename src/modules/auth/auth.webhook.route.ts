import { Router, Request, Response } from "express";
import { Webhook } from "svix";
import { StatusCodes } from "http-status-codes";
import prisma from "../../config/database.config";
import { CLERK_WEBHOOK_SECRET } from "../../utils/enviromentVariablesCheck.util";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  if (!CLERK_WEBHOOK_SECRET) {
    return res
      .status(StatusCodes.OK)
      .json({ received: true, processed: false });
  }

  const svixId = req.headers["svix-id"] as string | undefined;
  const svixTimestamp = req.headers["svix-timestamp"] as string | undefined;
  const svixSignature = req.headers["svix-signature"] as string | undefined;

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: "Missing svix headers",
    });
  }

  const wh = new Webhook(CLERK_WEBHOOK_SECRET);

  let event: any;

  try {
    // req.body is a raw Buffer here due to express.raw() in app.ts
    event = wh.verify(req.body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      error: "Invalid webhook signature",
    });
  }

  switch (event.type) {
    case "user.updated": {
      const data = event.data;
      const clerkUserId = data.id as string;

      const primaryEmail = data.email_addresses?.find(
        (e: any) => e.id === data.primary_email_address_id
      );

      if (primaryEmail) {
        const isVerified = primaryEmail.verification?.status === "verified";

        await prisma.user.updateMany({
          where: { clerkId: clerkUserId },
          data: { isEmailVerified: isVerified },
        });
      }

      break;
    }

    default:
      // No-op for event types we don't handle yet
      break;
  }

  return res.status(StatusCodes.OK).json({ received: true, processed: true });
});

export default router;
