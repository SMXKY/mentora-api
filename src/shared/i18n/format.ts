import type { SupportedLanguage } from "./init";

const DATE_LOCALE_MAP: Record<SupportedLanguage, string> = {
  en: "en-US",
  fr: "fr-FR",
};

const CURRENCY_LOCALE_MAP: Record<SupportedLanguage, string> = {
  en: "en-US",
  fr: "fr-FR",
};

export function formatDate(
  date: Date | string | number,
  lng: SupportedLanguage
): string {
  const d = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(d.getTime())) {
    throw new Error(`formatDate: invalid date input: ${String(date)}`);
  }

  return new Intl.DateTimeFormat(DATE_LOCALE_MAP[lng], {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Date + time, locale-formatted (e.g. transactional email timestamps).
 * en -> "July 2, 2026, 9:56 AM" / fr -> "2 juillet 2026, 09:56"
 */
export function formatDateTime(
  date: Date | string | number,
  lng: SupportedLanguage
): string {
  const d = date instanceof Date ? date : new Date(date);

  if (Number.isNaN(d.getTime())) {
    throw new Error(`formatDateTime: invalid date input: ${String(date)}`);
  }

  return new Intl.DateTimeFormat(DATE_LOCALE_MAP[lng], {
    dateStyle: "long",
    timeStyle: "short",
  }).format(d);
}

export function formatCurrencyXAF(
  amount: number,
  lng: SupportedLanguage
): string {
  const wholeAmount = Math.round(amount);

  const formattedNumber = new Intl.NumberFormat(CURRENCY_LOCALE_MAP[lng], {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(wholeAmount);

  return `${formattedNumber} XAF`;
}
