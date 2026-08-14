/**
 * Cameroonian tutor name pool — deterministic, index-addressed.
 *
 * Index N always maps to the same name (mixed-radix decomposition over
 * three independently-sized pools), so no "used" bookkeeping is needed —
 * the seed script's resumability is just "start from the last index we
 * successfully created."
 */

// Traditional Cameroonian first names, split by gender and by the
// Anglophone (NW/SW, largely Grassfields/Bantu-derived) vs Francophone
// (Centre/Littoral/West, largely Bamileke/Beti/Duala-derived) regional
// naming traditions.
export const FIRST_NAMES = [
  { first: "Ndifor", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Achembong", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Tanyi", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Ashu", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Ojong", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Mbah", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Fru", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Bate", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Egbe", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Ntui", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Ayuk", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Besong", gender: "MALE", region: "ANGLOPHONE" },
  { first: "Ayamba", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Manyi", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Ojongku", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Besem", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Ebude", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Neh", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Arrey", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Tabe", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Kimjoh", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Bih", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Fondzenyuy", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Enanga", gender: "FEMALE", region: "ANGLOPHONE" },
  { first: "Fotso", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Kamdem", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Njoya", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Tchoupo", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Mbarga", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Onana", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Essomba", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Nkoulou", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Talla", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Wandji", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Biyick", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Ateba", gender: "MALE", region: "FRANCOPHONE" },
  { first: "Ngo Bisa", gender: "FEMALE", region: "FRANCOPHONE" },
  { first: "Abena", gender: "FEMALE", region: "FRANCOPHONE" },
  { first: "Manga", gender: "FEMALE", region: "FRANCOPHONE" },
  { first: "Njanga", gender: "FEMALE", region: "FRANCOPHONE" },
  { first: "Tchana", gender: "FEMALE", region: "FRANCOPHONE" },
  { first: "Belinga", gender: "FEMALE", region: "FRANCOPHONE" },
  { first: "Nguemo", gender: "FEMALE", region: "FRANCOPHONE" },
  { first: "Owona", gender: "FEMALE", region: "FRANCOPHONE" },
  { first: "Ateu", gender: "FEMALE", region: "FRANCOPHONE" },
  { first: "Feudjio", gender: "FEMALE", region: "FRANCOPHONE" },
  { first: "Mengue", gender: "FEMALE", region: "FRANCOPHONE" },
  { first: "Ngo Um", gender: "FEMALE", region: "FRANCOPHONE" },
];

// English- or French-inspired middle names, reflecting the common
// Cameroonian pattern of a traditional first name + a Western given name.
export const MIDDLE_NAMES = [
  "Emmanuel", "Patrick", "Divine", "Blessing", "Precious", "Providence",
  "Success", "Confidence", "Godlove", "Prince", "Kelvin", "Collins",
  "Boris", "Yves", "Serge", "Ghislain", "Arnold", "Rodrigue",
  "Merveille", "Christian", "Steve", "Cedric", "Marie", "Jean",
  "Pierre", "Josiane", "Aurelie", "Christelle", "Herve", "Sandrine",
  "Willy", "Yannick", "Carine", "Desire", "Nadege", "Landry",
  "Rosine", "Stephane", "Vanessa", "Elvis", "Brice", "Alvine",
];

// Traditional Cameroonian family/surnames — a distinct list from
// FIRST_NAMES so first != last within a generated name.
export const LAST_NAMES = [
  "Nkemayang", "Wirngo", "Achidi", "Ngwainmbi", "Fonyuy", "Tabenyang",
  "Ekema", "Ojong-Enow", "Nguti", "Ebot", "Enow", "Nkeng",
  "Kemadjou", "Tchinda", "Feukeu", "Djoumessi", "Kenfack", "Wafo",
  "Nzeuga", "Meka", "Abanda", "Bikoro", "Ntyam", "Zang",
  "Assembe", "Beyala", "Ekani", "Mvondo", "Ndongo", "Owoundi",
];

export const COMBINATION_COUNT = FIRST_NAMES.length * MIDDLE_NAMES.length * LAST_NAMES.length;

/** Deterministic index -> unique name. */
export function nameForIndex(index) {
  if (index < 0 || index >= COMBINATION_COUNT) {
    throw new Error(`Name index ${index} out of range (0-${COMBINATION_COUNT - 1})`);
  }

  const lastIdx = index % LAST_NAMES.length;
  const middleIdx = Math.floor(index / LAST_NAMES.length) % MIDDLE_NAMES.length;
  const firstIdx = Math.floor(index / (LAST_NAMES.length * MIDDLE_NAMES.length)) % FIRST_NAMES.length;

  const first = FIRST_NAMES[firstIdx];
  const middle = MIDDLE_NAMES[middleIdx];
  const last = LAST_NAMES[lastIdx];

  return {
    firstName: first.first,
    middleName: middle,
    lastName: last,
    fullName: `${first.first} ${middle} ${last}`,
    gender: first.gender,
    region: first.region,
  };
}
