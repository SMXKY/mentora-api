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

/**
 * Resolves the language for this request from the Accept-Language header
 * (or the X-Lang override header, e.g. for clients that can't set
 * Accept-Language directly), falling back to FALLBACK_LANGUAGE.
 *
 * Runs as global middleware, before `protect`, so it never has access to
 * an authenticated user — this is deliberate: server-generated content
 * (API error messages, emails, SMS) is localized from what the client
 * told us it wants for *this request*, not a stored profile preference.
 */
export function resolveLocale() {
  return (req: Request, res: Response, next: NextFunction) => {
    const xLangHeader = req.headers["x-lang"];
    const xLang = Array.isArray(xLangHeader) ? xLangHeader[0] : xLangHeader;

    const headerLanguage =
      (isSupportedLanguage(xLang) ? xLang : null) ??
      parseAcceptLanguage(req.headers["accept-language"]);

    res.locals.lang = headerLanguage ?? FALLBACK_LANGUAGE;

    next();
  };
}
