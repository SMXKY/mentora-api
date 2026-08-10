/**
 * DEPRECATED. Tutor search (tutorSearch.service.ts) no longer calls
 * expandSearchTerms(), it queries Meilisearch instead, whose typo
 * tolerance and native synonyms feature replace this file's job. The
 * SYNONYM_GROUPS data itself is still the seed for Meilisearch's synonym
 * settings, see buildSynonymsSettings() in meilisearchTutorIndex.ts, so it
 * is exported and kept here rather than deleted. expandSearchTerms() has
 * no remaining callers in the app and is kept only so this file still
 * documents the original static-dictionary approach it replaced. Safe to
 * delete both once the Meilisearch-backed search has been running in
 * production long enough to be confident there is no rollback need.
 */
export const SYNONYM_GROUPS: string[][] = [
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
