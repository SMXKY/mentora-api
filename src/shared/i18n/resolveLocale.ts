import type { Request, Response, NextFunction } from "express";
import {
  SUPPORTED_LANGUAGES,
  FALLBACK_LANGUAGE,
  type SupportedLanguage,
} from "./init";

function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return (
    typeof value === "string" &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

export function parseAcceptLanguage(
  header: string | undefined
): SupportedLanguage | null {
  if (!header) return null;

  const candidates = header
    .split(",")
    .map((part) => part.trim().split(";")[0] ?? "")
    .map((tag) => tag.split("-")[0]?.toLowerCase() ?? "");

  for (const candidate of candidates) {
    if (isSupportedLanguage(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveLocale() {
  return (req: Request, res: Response, next: NextFunction) => {
    const userPreference = (
      req as Request & { user?: { preferredLanguage?: unknown } }
    ).user?.preferredLanguage;

    if (isSupportedLanguage(userPreference)) {
      res.locals.lang = userPreference;
      return next();
    }

    const headerLanguage = parseAcceptLanguage(req.headers["accept-language"]);
    res.locals.lang = headerLanguage ?? FALLBACK_LANGUAGE;

    next();
  };
}
