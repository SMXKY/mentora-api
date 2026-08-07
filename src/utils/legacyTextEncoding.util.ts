// The production Postgres database's server_encoding is WIN1252 (a Windows
// codepage gotcha from how the DB was originally created — Postgres refuses
// to change server_encoding on an existing database short of a full
// dump/recreate). WIN1252 has no representation for emoji or most non-Latin
// scripts: inserting one throws Postgres error 22P05
// ("untranslatable_character") deep inside whatever write triggered it,
// surfacing to the client as a generic failure.
//
// This is a scoped workaround, not a fix for the underlying DB encoding —
// it only protects the messaging module's text columns (Message.content,
// Conversation.lastMessagePreview, FilterBlock.attemptedContent/
// normalisedContent). Any character WIN1252 can't hold is escaped to a
// plain-ASCII numeric reference before every write, and decoded back to the
// real character on every read — round-trips losslessly, stores as valid
// ASCII regardless of DB encoding.
const ESCAPE_PATTERN = /&#(\d+);/g;

// WIN1252 is ISO-8859-1 (Latin-1) for 0x00–0x7F and 0xA0–0xFF; 0x80–0x9F is
// where the two diverge (smart quotes, em dash, etc., which ARE valid
// WIN1252 bytes but not identity-mapped from Unicode). Escaping that block
// too is deliberately conservative — it costs nothing (still round-trips
// exactly) and avoids hand-maintaining WIN1252's specific 0x80–0x9F table.
function needsEscape(codePoint: number): boolean {
  return codePoint > 0xff || (codePoint >= 0x80 && codePoint <= 0x9f);
}

export function encodeForLegacyDb(text: string): string {
  let result = "";
  for (const char of text) {
    const codePoint = char.codePointAt(0)!;
    result += needsEscape(codePoint) ? `&#${codePoint};` : char;
  }
  return result;
}

export function decodeFromLegacyDb(text: string): string;
export function decodeFromLegacyDb(text: string | null): string | null;
export function decodeFromLegacyDb(text: string | null): string | null {
  if (text == null) return text;
  return text.replace(ESCAPE_PATTERN, (_match, codePoint) =>
    String.fromCodePoint(Number(codePoint))
  );
}
