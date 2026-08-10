import prisma from "../../config/database.config";

interface RecordSignalInput {
  userId: string;
  /** Free-text signal identifier (RiskSignal.signalType is VarChar(100), not
   * an enum) — use the exact SRS Module 18 point-table names where one
   * exists (e.g. "REVIEW_REMOVED_BY_MODERATOR"). */
  signalType: string;
  /** Short caller identifier, VarChar(10) on the column — e.g. "REVIEWS". */
  sourceModule: string;
  sourceRecordId?: string;
  sourceRecordType?: string;
  performedById?: string;
  manualReason?: string;
  /** Documented point value from SRS REQ-018-003 where one is given. Not yet
   * applied to the running score/state — see module doc comment below. */
  pointsApplied?: number;
  /** Stamps RiskScore.humanReviewDueAt (if not already set) so the account
   * surfaces in a future Trust & Safety review queue. */
  requiresHumanReview?: boolean;
}

/**
 * REQ-018-002 — the single writer to the risk-score tables. Every other
 * module records a trust signal by calling this, never by touching
 * prisma.riskScore/riskSignal directly.
 *
 * Scope note: this intentionally mirrors dispute.service.ts's existing
 * minimal pattern (recordDisputeAgainstTutor/checkParentDisputeRate) rather
 * than implementing the full Module 18 point-accumulation/state-machine —
 * nothing in the codebase does real score math yet (both existing dispute
 * call sites use pointsApplied: 0, scoreBefore === scoreAfter), and the SRS's
 * own thresholds/decay/admin-configurability (REQ-018-001/003/004) are a
 * separate, unimplemented epic. pointsApplied is still recorded so the data
 * is correct once real scoring lands — it just isn't applied to
 * currentScore/currentState here.
 */
async function recordSignal(input: RecordSignalInput) {
  let riskScore = await prisma.riskScore.findUnique({ where: { userId: input.userId } });
  if (!riskScore) riskScore = await prisma.riskScore.create({ data: { userId: input.userId } });

  const signal = await prisma.riskSignal.create({
    data: {
      userId: input.userId,
      riskScoreId: riskScore.id,
      signalType: input.signalType,
      pointsApplied: input.pointsApplied ?? 0,
      scoreBefore: riskScore.currentScore,
      scoreAfter: riskScore.currentScore,
      stateBefore: riskScore.currentState,
      stateAfter: riskScore.currentState,
      sourceModule: input.sourceModule,
      sourceRecordId: input.sourceRecordId,
      sourceRecordType: input.sourceRecordType,
      performedById: input.performedById,
      manualReason: input.manualReason,
    },
  });

  if (input.requiresHumanReview && !riskScore.humanReviewDueAt) {
    await prisma.riskScore.update({ where: { id: riskScore.id }, data: { humanReviewDueAt: new Date() } });
  }

  return signal;
}

export const TrustSafetyService = { recordSignal };
export default TrustSafetyService;
