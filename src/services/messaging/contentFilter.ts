// ============================================================
// Module 15 — three-layer content filter. Pure, dependency-free
// (the active keyword list is passed in, not fetched here) so
// every pattern — including obfuscation variants — is directly
// unit-testable without touching Prisma.
// ============================================================

export type FilterResult =
  | "CLEAN"
  | "BLOCKED_PHONE"
  | "BLOCKED_URL"
  | "BLOCKED_SOCIAL"
  | "BLOCKED_OBFUSCATED"
  | "BLOCKED_INTENT_KEYWORD";

export interface FilterOutcome {
  result: FilterResult;
  layer: 1 | 2 | 3 | null;
  matchedPattern: string | null;
  normalisedContent: string | null;
}

const CLEAN: FilterOutcome = { result: "CLEAN", layer: null, matchedPattern: null, normalisedContent: null };

// ── Layer 1 — explicit patterns ─────────────────────────────
const PHONE_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "cm_phone_plus237", re: /\+237\d{9}\b/ },
  { name: "cm_phone_237", re: /(?<!\d)237\d{9}(?!\d)/ },
  { name: "cm_phone_6x", re: /(?<!\d)6\d{8}(?!\d)/ },
  { name: "cm_phone_2x", re: /(?<!\d)2\d{8}(?!\d)/ },
  { name: "intl_phone", re: /\+\d{7,15}\b/ },
];

const SOCIAL_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "whatsapp_link", re: /(wa\.me\/|chat\.whatsapp\.com\/)/i },
  { name: "social_domain", re: /(facebook|instagram|twitter|x|linkedin|tiktok|snapchat)\.com/i },
];

const URL_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "email", re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  { name: "telegram_link", re: /t\.me\/\S+/i },
  { name: "http_url", re: /https?:\/\/\S+/i },
  { name: "bare_domain", re: /\b[a-z0-9-]+\.(com|net|org|cm)\b/i },
];

function runLayer1(text: string): { result: FilterResult; matchedPattern: string } | null {
  // Social/URL patterns are checked before bare phone patterns: a link like
  // wa.me/237671234567 legitimately embeds a phone-shaped digit run, but the
  // link itself is the more specific, higher-signal violation.
  for (const p of SOCIAL_PATTERNS) {
    if (p.re.test(text)) return { result: "BLOCKED_SOCIAL", matchedPattern: p.name };
  }
  for (const p of URL_PATTERNS) {
    if (p.re.test(text)) return { result: "BLOCKED_URL", matchedPattern: p.name };
  }
  for (const p of PHONE_PATTERNS) {
    if (p.re.test(text)) return { result: "BLOCKED_PHONE", matchedPattern: p.name };
  }
  return null;
}

// ── Layer 2 — obfuscation ───────────────────────────────────
// Reverses common character substitutions, then strips the
// separators someone would use to break up a phone number
// (spaces, dots, dashes, underscores) before re-running every
// Layer 1 pattern — this alone catches spaced-digit and
// mixed-separator obfuscation without a separate algorithm.
function reverseSubstitutions(text: string): string {
  return text.replace(/O/g, "0").replace(/l/g, "1").replace(/³/g, "3").replace(/@/g, "a");
}

function compactForPhoneMatch(text: string): string {
  return reverseSubstitutions(text).replace(/[\s.\-_]/g, "");
}

// ── Layer 3 — intent keywords ────────────────────────────────
function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Keeps spaces (unlike the Layer 2 compaction) so multi-word phrases like
 * "call me on" still match as substrings. Case-insensitivity alone must NOT
 * go through reverseSubstitutions first: it blindly turns every "O"/"l" into
 * "0"/"1" (e.g. "CALL ME ON" -> "call me 0n"), which would break the plain
 * case-insensitive match for ordinary uppercase text. So substitution-reversal
 * is applied as a separate, additional variant (see filterMessage) rather
 * than folded into this one.
 */
function normaliseForKeywordMatch(text: string): string {
  return stripAccents(text).toLowerCase();
}

function normaliseForKeywordMatchSubstituted(text: string): string {
  return stripAccents(reverseSubstitutions(text)).toLowerCase();
}

export function filterMessage(content: string, activeKeywords: string[]): FilterOutcome {
  // Layer 1
  const layer1 = runLayer1(content);
  if (layer1) return { ...layer1, layer: 1, normalisedContent: null };

  // Layer 2
  const compact = compactForPhoneMatch(content);
  const layer2 = runLayer1(compact);
  if (layer2) return { result: "BLOCKED_OBFUSCATED", layer: 2, matchedPattern: layer2.matchedPattern, normalisedContent: compact };

  // Layer 3 — checked against a plain (case/accent-insensitive) variant and,
  // separately, a character-substitution-reversed variant so that both
  // "CALL ME ON ..." and "c@ll me on ..." are caught without either variant
  // corrupting the other's matching.
  const keywordPlain = normaliseForKeywordMatch(content);
  const keywordSubstituted = normaliseForKeywordMatchSubstituted(content);
  for (const keyword of activeKeywords) {
    const needlePlain = normaliseForKeywordMatch(keyword);
    const needleSubstituted = normaliseForKeywordMatchSubstituted(keyword);
    if (needlePlain && (keywordPlain.includes(needlePlain) || keywordSubstituted.includes(needleSubstituted))) {
      return { result: "BLOCKED_INTENT_KEYWORD", layer: 3, matchedPattern: keyword, normalisedContent: keywordPlain };
    }
  }

  return CLEAN;
}

/** Default seed list — EN + FR — loaded into the FilterKeyword table so it's admin-editable from day one without a code change. */
export const DEFAULT_INTENT_KEYWORDS: { keyword: string; language: "EN" | "FR" }[] = [
  { keyword: "my number is", language: "EN" },
  { keyword: "call me on", language: "EN" },
  { keyword: "text me at", language: "EN" },
  { keyword: "whatsapp me", language: "EN" },
  { keyword: "reach me on", language: "EN" },
  { keyword: "find me on", language: "EN" },
  { keyword: "contact me outside", language: "EN" },
  { keyword: "my email is", language: "EN" },
  { keyword: "let's continue on", language: "EN" },
  { keyword: "add me on", language: "EN" },
  { keyword: "dm me", language: "EN" },
  { keyword: "message me on", language: "EN" },
  { keyword: "mon numero", language: "FR" },
  { keyword: "appelle-moi", language: "FR" },
  { keyword: "contacte-moi sur", language: "FR" },
  { keyword: "ecris-moi sur", language: "FR" },
  { keyword: "mon email", language: "FR" },
  { keyword: "trouve-moi sur", language: "FR" },
  { keyword: "ajoute-moi sur", language: "FR" },
  { keyword: "envoie-moi un message sur", language: "FR" },
];
