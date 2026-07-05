/**
 * Confidence scoring for a Tutor's claimed subject, based on how well
 * their credentials have historically predicted approval for that
 * subject. Every rule here is a pure function over plain data so it can
 * be unit tested without touching the database — see kycScoring.test.ts.
 */

export const HIGH_CONFIDENCE_THRESHOLD = 80;
export const REVIEW_CONFIDENCE_THRESHOLD = 40;

export type QueueSection =
  | "RECOMMEND_APPROVE"
  | "RECOMMEND_REVIEW"
  | "NEW_DOCUMENTATION_REQUIRED";

export interface CandidateCredential {
  qualificationType: string;
  fieldOfStudy: string;
}

export interface RelationshipWeightLookup {
  qualificationType: string;
  fieldOfStudy: string;
  confidenceWeight: number;
}

export interface ConfidenceResult {
  score: number;
  explanation: string;
  section: QueueSection;
  matchedCredential: CandidateCredential | null;
}

function findWeight(
  credential: CandidateCredential,
  weights: RelationshipWeightLookup[]
): number | null {
  const match = weights.find(
    (w) =>
      w.qualificationType === credential.qualificationType &&
      w.fieldOfStudy.trim().toLowerCase() ===
        credential.fieldOfStudy.trim().toLowerCase()
  );
  return match ? match.confidenceWeight : null;
}

function sectionFor(score: number): QueueSection {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return "RECOMMEND_APPROVE";
  if (score >= REVIEW_CONFIDENCE_THRESHOLD) return "RECOMMEND_REVIEW";
  return "NEW_DOCUMENTATION_REQUIRED";
}

/**
 * Scores a subject claim against every credential the tutor submitted for
 * it, taking the strongest match — one good credential is enough evidence
 * even if the tutor also attached weaker ones. Returns 0 / no match when
 * this exact (qualificationType, fieldOfStudy) pairing has never been
 * trained against this subject before — a genuinely new combination
 * always requires full manual review, never an optimistic guess.
 */
export function scoreSubjectClaim(
  candidateCredentials: CandidateCredential[],
  relationshipWeights: RelationshipWeightLookup[]
): ConfidenceResult {
  if (candidateCredentials.length === 0) {
    return {
      score: 0,
      explanation:
        "No credential was submitted for this subject — full manual review required.",
      section: "NEW_DOCUMENTATION_REQUIRED",
      matchedCredential: null,
    };
  }

  let best: { credential: CandidateCredential; weight: number } | null = null;

  for (const credential of candidateCredentials) {
    const weight = findWeight(credential, relationshipWeights);
    if (weight !== null && (best === null || weight > best.weight)) {
      best = { credential, weight };
    }
  }

  if (!best) {
    return {
      score: 0,
      explanation:
        "No prior approvals link this credential type to this subject — full manual review required.",
      section: "NEW_DOCUMENTATION_REQUIRED",
      matchedCredential: null,
    };
  }

  const score = Math.max(0, Math.min(100, best.weight));
  const section = sectionFor(score);

  const explanation =
    section === "RECOMMEND_APPROVE"
      ? `This credential type has a strong track record of approval for this subject (${score}% confidence).`
      : section === "RECOMMEND_REVIEW"
      ? `This credential type has been approved for this subject before, but the match is not certain (${score}% confidence) — please review.`
      : `This credential type has a weak history with this subject (${score}% confidence) — treat as new documentation.`;

  return { score, explanation, section, matchedCredential: best.credential };
}
