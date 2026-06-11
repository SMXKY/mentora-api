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
