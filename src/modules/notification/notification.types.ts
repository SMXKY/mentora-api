import { z } from "zod";
import {
  CreateNotificationSchema,
  UpdateNotificationSchema,
  NotificationResponseSchema,
} from "./notification.schema";

export type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>;
export type UpdateNotificationInput = z.infer<typeof UpdateNotificationSchema>;
export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;
