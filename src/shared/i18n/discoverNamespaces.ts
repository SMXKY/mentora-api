import fs from "fs";
import path from "path";

const LOCALES_ROOT = path.resolve(__dirname, "../../locales");
const SOURCE_LOCALE = "en";

export function discoverNamespaces(
  localesRoot: string = LOCALES_ROOT
): string[] {
  const sourceDir = path.join(localesRoot, SOURCE_LOCALE);

  if (!fs.existsSync(sourceDir)) {
    throw new Error(
      `i18n: source locale directory not found at ${sourceDir}. ` +
        `Expected structure: src/locales/${SOURCE_LOCALE}/{module}/{category}.json`
    );
  }

  const namespaces: string[] = [];
  const moduleDirs = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  for (const moduleDir of moduleDirs) {
    const modulePath = path.join(sourceDir, moduleDir.name);
    const categoryFiles = fs
      .readdirSync(modulePath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"));

    for (const categoryFile of categoryFiles) {
      const category = path.basename(categoryFile.name, ".json");
      namespaces.push(`${moduleDir.name}/${category}`);
    }
  }

  if (namespaces.length === 0) {
    throw new Error(
      `i18n: no namespace files found under ${sourceDir}. ` +
        `Expected at least one {module}/{category}.json file.`
    );
  }

  return namespaces;
}

export { LOCALES_ROOT };
