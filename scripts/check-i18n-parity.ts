#!/usr/bin/env ts-node
import fs from "fs";
import path from "path";
import {
  discoverNamespaces,
  LOCALES_ROOT,
} from "../src/shared/i18n/discoverNamespaces";

type JsonObject = { [key: string]: unknown };

function flattenKeys(obj: JsonObject, prefix = ""): string[] {
  const keys: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as JsonObject, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

function loadNamespaceFile(lng: string, namespace: string): JsonObject | null {
  const filePath = path.join(LOCALES_ROOT, lng, `${namespace}.json`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as JsonObject;
}

function main(): void {
  const namespaces = discoverNamespaces();
  const errors: string[] = [];

  for (const namespace of namespaces) {
    const enFile = loadNamespaceFile("en", namespace);
    const frFile = loadNamespaceFile("fr", namespace);

    if (enFile === null) {
      errors.push(`[${namespace}] en/${namespace}.json could not be read`);
      continue;
    }

    if (frFile === null) {
      errors.push(`[${namespace}] missing fr/${namespace}.json (exists in en)`);
      continue;
    }

    const enKeys = new Set(flattenKeys(enFile));
    const frKeys = new Set(flattenKeys(frFile));

    const missingInFr = [...enKeys].filter((k) => !frKeys.has(k));
    const missingInEn = [...frKeys].filter((k) => !enKeys.has(k));

    for (const key of missingInFr) {
      errors.push(`[${namespace}] key "${key}" exists in en but missing in fr`);
    }
    for (const key of missingInEn) {
      errors.push(`[${namespace}] key "${key}" exists in fr but missing in en`);
    }
  }

  if (errors.length > 0) {
    console.error(`i18n parity check FAILED (${errors.length} issue(s)):\n`);
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `i18n parity check passed: ${namespaces.length} namespace(s), en/fr in sync.`
  );
}

main();
