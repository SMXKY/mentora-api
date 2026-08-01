/** Pure — decides which side of the 12h line a parent cancellation falls on. Reused by reschedule's "same financial rule" requirement. */
export type ParentCancellationOutcome = "FULL_REFUND" | "RELEASE_TO_TUTOR";

export function computeParentCancellationOutcome(
  sessionStartAt: Date,
  now: Date,
  thresholdHours: number
): ParentCancellationOutcome {
  const hoursUntilSession = (sessionStartAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  return hoursUntilSession >= thresholdHours ? "FULL_REFUND" : "RELEASE_TO_TUTOR";
}
