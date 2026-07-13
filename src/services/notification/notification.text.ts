import { Notification } from "../../generated/prisma";
import { notificationRegistry } from "./notification.types";
import { t } from "../../shared/i18n/t";

const DEFAULT_FALLBACK_TEXT = "You have a new notification";

/** Notification copy only ever ships in English or French — everything else falls back to English. */
export function resolveNotificationLocale(
  preferredLanguage?: string | null
): "en" | "fr" {
  return preferredLanguage?.toLowerCase() === "fr" ? "fr" : "en";
}

/**
 * Renders a notification's titleCode/bodyCode into real display text for a
 * given recipient locale, interpolating notification.data (plus any extra
 * vars a specific channel needs, e.g. the recipient's first name for email).
 */
export function resolveNotificationCopy(
  notification: Pick<Notification, "type" | "data">,
  preferredLanguage?: string | null,
  extraVars?: Record<string, unknown>
): { title: string; body: string } {
  const definition = notificationRegistry[notification.type];
  const lng = resolveNotificationLocale(preferredLanguage);
  const vars = {
    ...(notification.data as Record<string, unknown> | null),
    ...extraVars,
  };

  return {
    title: t(definition.titleCode, DEFAULT_FALLBACK_TEXT, { lng, ...vars }),
    body: t(definition.bodyCode, DEFAULT_FALLBACK_TEXT, { lng, ...vars }),
  };
}
