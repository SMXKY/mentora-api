import i18next, { type i18n as I18nInstance } from "i18next";
import Backend from "i18next-fs-backend";
import { discoverNamespaces, LOCALES_ROOT } from "./discoverNamespaces";

export const SUPPORTED_LANGUAGES = ["en", "fr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const FALLBACK_LANGUAGE: SupportedLanguage = "en";

let initPromise: Promise<I18nInstance> | null = null;

export function initI18n(): Promise<I18nInstance> {
  if (initPromise) {
    return initPromise;
  }

  const namespaces = discoverNamespaces();

  const instance = i18next.use(Backend);

  initPromise = instance
    .init({
      preload: SUPPORTED_LANGUAGES as unknown as string[],
      fallbackLng: FALLBACK_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],

      ns: namespaces,
      defaultNS: false,
      fallbackNS: false,

      backend: {
        loadPath: `${LOCALES_ROOT}/{{lng}}/{{ns}}.json`,
      },

      parseMissingKeyHandler: (key: string) => `__MISSING__:${key}`,

      debug: false,

      interpolation: {
        escapeValue: false,
      },

      partialBundledLanguages: false,
    })
    .then(() => instance);

  return initPromise;
}

export function getI18n(): I18nInstance {
  if (!initPromise) {
    throw new Error(
      "i18n: initI18n() must be called and awaited before getI18n() is used. " +
        "Call initI18n() during application startup."
    );
  }
  return i18next;
}

export function __resetI18nForTests(): void {
  initPromise = null;
}
