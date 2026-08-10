import meilisearch from "../../config/meilisearch.config";
import prisma from "../../config/database.config";
import { TeachingMode, SubjectVerificationStatus, KycStatus } from "../../generated/prisma";
import { isNewTutorBoostEligible } from "./compositeScore";
import { SYNONYM_GROUPS } from "./searchSynonyms";

export const TUTOR_INDEX_UID = "tutors";

export interface TutorSearchDocument {
  id: string;
  firstName: string | null;
  lastNameInitial: string;
  bio: string;
  cityId: string;
  cityName: string;
  subjectIds: string[];
  subjectNames: string[];
  levelIds: string[];
  teachingMode: string;
  languages: string[];
  minRateXaf: number | null;
  maxRateXaf: number | null;
  gender: string | null;
  kycStatus: string;
  introVideoVerified: boolean;
  compositeScore: number;
  boostScore: number;
  // Only present for tutors that offer HOME sessions and whose city has
  // been geocoded, see cli/backfillCityCoordinates.ts. Geo point comes
  // from the city centroid, not per-tutor precision, per the approved
  // Phase 1 plan.
  _geo?: { lat: number; lng: number };
}

const TUTOR_SELECT_FOR_DOCUMENT = {
  id: true,
  bio: true,
  teachingMode: true,
  languages: true,
  minRateXaf: true,
  maxRateXaf: true,
  compositeScore: true,
  newTutorBoostExpiresAt: true,
  completedSessionsCount: true,
  kycStatus: true,
  introVideoVerified: true,
  deletedAt: true,
  cityId: true,
  city: {
    select: { name: true, latitude: true, longitude: true },
  },
  user: {
    select: { firstName: true, lastName: true, gender: true },
  },
  tutorSubjects: {
    where: {
      status: SubjectVerificationStatus.APPROVED,
      isOpenForBooking: true,
    },
    select: {
      subject: { select: { id: true, name: true } },
      levels: { select: { levelId: true } },
    },
  },
} as const;

type TutorForDocument = NonNullable<
  Awaited<ReturnType<typeof prisma.tutorProfile.findUnique<{ where: any; select: typeof TUTOR_SELECT_FOR_DOCUMENT }>>>
>;

/** Builds the exact document shape stored in Meilisearch from one
 * TutorProfile row. Geo point is only attached when the tutor offers
 * HOME sessions and their city has coordinates, otherwise omitted
 * entirely so it never accidentally participates in a geo sort. */
export function buildTutorDocument(tutor: TutorForDocument): TutorSearchDocument {
  const boostEligible = isNewTutorBoostEligible(
    tutor.newTutorBoostExpiresAt,
    tutor.completedSessionsCount
  );

  const offersHome = tutor.teachingMode === TeachingMode.HOME_ONLY || tutor.teachingMode === TeachingMode.BOTH;
  const hasCityCoords = tutor.city.latitude !== null && tutor.city.longitude !== null;

  return {
    id: tutor.id,
    firstName: tutor.user.firstName,
    lastNameInitial: tutor.user.lastName ? `${tutor.user.lastName.charAt(0)}.` : "",
    bio: tutor.bio,
    cityId: tutor.cityId,
    cityName: tutor.city.name,
    subjectIds: tutor.tutorSubjects.map((ts) => ts.subject.id),
    subjectNames: tutor.tutorSubjects.map((ts) => ts.subject.name),
    levelIds: tutor.tutorSubjects.flatMap((ts) => ts.levels.map((l) => l.levelId)),
    teachingMode: tutor.teachingMode,
    languages: tutor.languages,
    minRateXaf: tutor.minRateXaf,
    maxRateXaf: tutor.maxRateXaf,
    gender: tutor.user.gender,
    kycStatus: tutor.kycStatus,
    introVideoVerified: tutor.introVideoVerified,
    compositeScore: tutor.compositeScore ? Number(tutor.compositeScore) : 0,
    boostScore: boostEligible ? 1 : 0,
    ...(offersHome && hasCityCoords
      ? { _geo: { lat: Number(tutor.city.latitude), lng: Number(tutor.city.longitude) } }
      : {}),
  };
}

/** Removes a tutor's document entirely, used whenever a tutor no longer
 * passes the same hard-visibility bar tutor search always enforced
 * (deleted, not ACTIVE kyc, no unverified intro video, no open+approved
 * subject) rather than updating with a hidden flag, so a removed tutor can
 * never leak into results through a filter bug. */
export async function removeTutorFromIndex(tutorProfileId: string): Promise<void> {
  await meilisearch.index(TUTOR_INDEX_UID).deleteDocument(tutorProfileId);
}

function isSearchVisible(tutor: TutorForDocument): boolean {
  return (
    tutor.deletedAt === null &&
    tutor.kycStatus === KycStatus.ACTIVE &&
    tutor.introVideoVerified &&
    tutor.tutorSubjects.length > 0
  );
}

/** Pushes (creates or updates) one tutor's document, or removes it if the
 * tutor no longer passes the visibility bar, e.g. a suspend/ban/soft-delete
 * routes here through the same queueScoreRecompute() call every other
 * profile mutation already uses, no separate deletion hook needed. */
export async function indexTutor(tutorProfileId: string): Promise<void> {
  const tutor = await prisma.tutorProfile.findUnique({
    where: { id: tutorProfileId },
    select: TUTOR_SELECT_FOR_DOCUMENT,
  });
  if (!tutor || !isSearchVisible(tutor)) {
    await removeTutorFromIndex(tutorProfileId).catch(() => {
      // Meilisearch returns a 404-shaped error when the document never
      // existed, e.g. a brand new tutor who has never been ACTIVE yet,
      // that is not a failure worth surfacing.
    });
    return;
  }

  const document = buildTutorDocument(tutor);
  await meilisearch.index(TUTOR_INDEX_UID).addDocuments([document]);
}

/** Converts the existing static EN/FR synonym groups into Meilisearch's
 * synonyms settings format: one entry per term, mapped to every other term
 * in its group. This is the direct replacement for searchSynonyms.ts's
 * runtime query-expansion, the data now lives in Meilisearch itself
 * instead of app code, so it can grow past a hardcoded list later
 * (e.g. an admin-editable synonym endpoint) without a redeploy. */
function buildSynonymsSettings(): Record<string, string[]> {
  const synonyms: Record<string, string[]> = {};
  for (const group of SYNONYM_GROUPS) {
    for (const term of group) {
      synonyms[term] = group.filter((t) => t !== term);
    }
  }
  return synonyms;
}

/** Idempotent index settings configuration, safe to re-run any time
 * (e.g. after a deploy that changes ranking rules). Does not touch
 * documents. */
export async function configureTutorIndex(): Promise<void> {
  const index = meilisearch.index(TUTOR_INDEX_UID);

  await meilisearch.createIndex(TUTOR_INDEX_UID, { primaryKey: "id" }).catch(() => {
    // Index already exists, fine, settings below still apply.
  });

  await index.updateSettings({
    searchableAttributes: [
      "subjectNames",
      "firstName",
      "lastNameInitial",
      "bio",
      "cityName",
    ],
    filterableAttributes: [
      "subjectIds",
      "levelIds",
      "cityId",
      "teachingMode",
      "languages",
      "minRateXaf",
      "maxRateXaf",
      "gender",
      "kycStatus",
      "introVideoVerified",
      "_geo",
    ],
    sortableAttributes: ["compositeScore", "boostScore", "_geo"],
    rankingRules: [
      "words",
      "typo",
      "proximity",
      "attribute",
      "sort",
      "exactness",
      "compositeScore:desc",
      "boostScore:desc",
    ],
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
    synonyms: buildSynonymsSettings(),
  });
}
