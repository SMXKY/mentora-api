// Shared redaction for any public-facing profile (tutor, student, parent):
// full last name is never exposed publicly, only the first initial
// (e.g. "Ngu" -> "N."). Only ever apply this on a path returning someone's
// profile to another user — never on a path returning a profile to itself.
export function toPublicLastNameInitial(
  lastName: string | null | undefined
): string | null {
  if (!lastName) return null;
  const trimmed = lastName.trim();
  return trimmed ? `${trimmed[0].toUpperCase()}.` : null;
}
