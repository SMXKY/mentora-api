/**
 * Static EN/FR subject-name synonym table plus common Cameroonian spelling
 * variants — resolved before the query ever hits the DB rather than via
 * full-text-search infra. Each key maps to every term that should be
 * treated as an equivalent match; lookups are case/accent-insensitive.
 */
const SYNONYM_GROUPS: string[][] = [
  ["mathematics", "maths", "math", "mathematiques", "mathématiques"],
  ["physics", "physique"],
  ["chemistry", "chimie"],
  ["biology", "biologie"],
  ["english language", "anglais", "english"],
  ["french language", "francais", "français", "french"],
  ["computer science", "informatique"],
  ["geography", "geographie", "géographie"],
  ["history", "histoire"],
  ["economics", "economie", "économie"],
  ["literature in english", "litterature", "littérature"],
  ["accounting", "comptabilite", "comptabilité"],
  ["philosophy", "philosophie"],
];

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalize(value: string): string {
  return stripAccents(value.trim().toLowerCase());
}

const SYNONYM_INDEX: Map<string, Set<string>> = (() => {
  const index = new Map<string, Set<string>>();
  for (const group of SYNONYM_GROUPS) {
    const normalizedGroup = new Set(group.map(normalize));
    for (const term of normalizedGroup) {
      index.set(term, normalizedGroup);
    }
  }
  return index;
})();

/**
 * Expands a free-text query into every term that should be OR'd together
 * when matching subject names — "Maths" and "Mathematics" return the same
 * results, "Physique" and "Physics" return the same results, per spec.
 * Always includes the original (normalized) query so a literal substring
 * match against non-subject fields (name, city, bio) still works.
 */
export function expandSearchTerms(query: string): string[] {
  const normalized = normalize(query);
  const terms = new Set<string>([normalized]);

  const group = SYNONYM_INDEX.get(normalized);
  if (group) {
    for (const term of group) terms.add(term);
  } else {
    // Partial match against synonym keys — "Phy" should still resolve to
    // the Physics/Physique group per the "partial matches" requirement.
    for (const [term, groupSet] of SYNONYM_INDEX) {
      if (term.startsWith(normalized) || normalized.startsWith(term)) {
        for (const t of groupSet) terms.add(t);
      }
    }
  }

  return Array.from(terms);
}
