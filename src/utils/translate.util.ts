import path from "path";
import { readdir, readFile } from "fs/promises";

export type SupportedLanguage = "en" | "fr";

type Translations = Record<string, string>;

const translations: Record<SupportedLanguage, Translations> = {
  en: {},
  fr: {},
};

const localesDir =
  process.env.NODE_ENV === "development"
    ? path.join(__dirname, "../locales")
    : path.join(__dirname, "locales");

export const loadTranslations = async (): Promise<void> => {
  const langs: SupportedLanguage[] = ["en", "fr"];

  for (const lang of langs) {
    const langDir = path.join(localesDir, lang);

    try {
      const files = await readdir(langDir);

      for (const file of files) {
        if (path.extname(file) !== ".json") continue;

        try {
          const content = await readFile(path.join(langDir, file), "utf-8");
          const parsed = JSON.parse(content);

          // Merge all module files into one flat object per language
          // Keys are prefixed with the module name: "auth.login.success"
          const moduleName = path.basename(file, ".json");

          for (const [key, value] of Object.entries(parsed)) {
            translations[lang][`${moduleName}.${key}`] = value as string;
          }
        } catch (err) {
          console.error(`Failed to load ${lang}/${file}:`, err);
        }
      }
    } catch (err) {
      console.error(`Failed to read locales/${lang} directory:`, err);
    }
  }
};

const interpolate = (str: string, vars?: Record<string, any>): string =>
  !vars
    ? str
    : str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);

// t('auth.login.success') or t('booking.errors.not_found', 'Booking not found', lang)
export const t = (
  key: string,
  fallback: string,
  lang: SupportedLanguage = "en",
  vars?: Record<string, string>
): string => {
  const text =
    translations[lang]?.[key] ?? // requested language
    translations["en"]?.[key] ?? // fallback to English
    fallback; // hardcoded fallback — never crashes

  // Log missing keys in development so they get fixed before production
  if (process.env.NODE_ENV === "development" && !translations[lang]?.[key]) {
    console.warn(
      `[i18n] Missing translation key: "${key}" for lang: "${lang}"`
    );
  }

  return interpolate(text, vars);
};

export default t;
