import { getI18n, FALLBACK_LANGUAGE, type SupportedLanguage } from "./init";

const MISSING_PREFIX = "__MISSING__:";

export interface TranslateOptions {
  lng: SupportedLanguage;
  [interpolationKey: string]: unknown;
}

export interface MissingKeyLogger {
  warnFallbackServed(args: {
    key: string;
    requestedLng: string;
    servedLng: string;
  }): void;
  warnHardcodedFallbackServed(args: {
    key: string;
    requestedLng: string;
  }): void;
}

const defaultLogger: MissingKeyLogger = {
  warnFallbackServed: ({ key, requestedLng, servedLng }) => {
    console.warn(
      `[i18n] missing key "${key}" for locale "${requestedLng}" - served from "${servedLng}"`
    );
  },
  warnHardcodedFallbackServed: ({ key, requestedLng }) => {
    console.warn(
      `[i18n] missing key "${key}" for locale "${requestedLng}" and fallback locale - served hardcoded fallback text`
    );
  },
};

let logger: MissingKeyLogger = defaultLogger;

export function setMissingKeyLogger(customLogger: MissingKeyLogger): void {
  logger = customLogger;
}

export function t(
  key: string,
  fallbackText: string,
  options: TranslateOptions
): string {
  const i18n = getI18n();
  const { lng, ...interpolationValues } = options;

  const inRequestedLocale = i18n.t(key, {
    ...interpolationValues,
    lng,
    fallbackLng: false,
  });

  if (!isMissing(inRequestedLocale)) {
    return inRequestedLocale;
  }

  if (lng !== FALLBACK_LANGUAGE) {
    const inFallbackLocale = i18n.t(key, {
      ...interpolationValues,
      lng: FALLBACK_LANGUAGE,
      fallbackLng: false,
    });

    if (!isMissing(inFallbackLocale)) {
      logger.warnFallbackServed({
        key,
        requestedLng: lng,
        servedLng: FALLBACK_LANGUAGE,
      });
      return inFallbackLocale;
    }
  }

  logger.warnHardcodedFallbackServed({ key, requestedLng: lng });
  return interpolate(fallbackText, interpolationValues);
}

function isMissing(value: string): boolean {
  return value.startsWith(MISSING_PREFIX);
}

function interpolate(text: string, values: Record<string, unknown>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
    return varName in values ? String(values[varName]) : match;
  });
}
