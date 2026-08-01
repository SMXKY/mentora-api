// ============================================================
// Pure heuristic for the auto-resolution recommendation — kept
// dependency-free so it's directly unit-testable. Internal-only
// (never shown to parents/tutors, only feeds the admin resolution UI).
// ============================================================

export type AutoResolutionRecommendationType = "TUTOR_FAVOR" | "PARENT_FAVOR" | "ADMIN_REVIEW";

export interface SessionAttendanceInput {
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  tutorJoinedAt: Date | null;
  tutorLeftAt: Date | null;
  studentJoinedAt: Date | null;
  studentLeftAt: Date | null;
  severeConnectionEvents?: boolean;
}

export interface AutoResolutionResult {
  recommendation: AutoResolutionRecommendationType;
  overlapPercentage: number | null;
  tutorJoined: boolean;
  studentJoined: boolean;
  tutorJoinDelayMinutes: number | null;
  severeConnectionEvents: boolean;
  sessionEndedEarly: boolean;
  reasoning: string;
}

function overlapMinutes(
  aStart: Date | null,
  aEnd: Date | null,
  bStart: Date | null,
  bEnd: Date | null
): number {
  if (!aStart || !aEnd || !bStart || !bEnd) return 0;
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, end - start) / 60000;
}

export function computeAutoResolutionRecommendation(input: SessionAttendanceInput): AutoResolutionResult {
  const scheduledMinutes = Math.max(
    1,
    (input.scheduledEndAt.getTime() - input.scheduledStartAt.getTime()) / 60000
  );
  const tutorJoined = !!input.tutorJoinedAt;
  const studentJoined = !!input.studentJoinedAt;
  const severeConnectionEvents = input.severeConnectionEvents ?? false;

  const overlap = overlapMinutes(
    input.tutorJoinedAt,
    input.tutorLeftAt ?? input.scheduledEndAt,
    input.studentJoinedAt,
    input.studentLeftAt ?? input.scheduledEndAt
  );
  const overlapPercentage = tutorJoined && studentJoined ? Math.round((overlap / scheduledMinutes) * 100) : 0;

  const tutorJoinDelayMinutes = tutorJoined
    ? Math.max(0, Math.round((input.tutorJoinedAt!.getTime() - input.scheduledStartAt.getTime()) / 60000))
    : null;

  const actualDurationMinutes =
    tutorJoined && input.tutorLeftAt
      ? (input.tutorLeftAt.getTime() - input.tutorJoinedAt!.getTime()) / 60000
      : overlap;
  const sessionEndedEarly = tutorJoined && actualDurationMinutes < scheduledMinutes * 0.5;

  const bothJoinedPromptly = tutorJoined && studentJoined && (tutorJoinDelayMinutes ?? 999) <= 15;

  let recommendation: AutoResolutionRecommendationType;
  let reasoning: string;

  if (overlapPercentage > 50 && bothJoinedPromptly && !severeConnectionEvents) {
    recommendation = "TUTOR_FAVOR";
    reasoning = `Overlap ${overlapPercentage}% > 50%, both joined within 15 minutes, no severe connection issues.`;
  } else if (overlapPercentage < 20 && !tutorJoined) {
    recommendation = "PARENT_FAVOR";
    reasoning = `Overlap ${overlapPercentage}% < 20% and the tutor never joined.`;
  } else {
    recommendation = "ADMIN_REVIEW";
    reasoning = `Overlap ${overlapPercentage}%, tutorJoined=${tutorJoined}, studentJoined=${studentJoined} — doesn't clearly favour either side.`;
  }

  return {
    recommendation,
    overlapPercentage,
    tutorJoined,
    studentJoined,
    tutorJoinDelayMinutes,
    severeConnectionEvents,
    sessionEndedEarly,
    reasoning,
  };
}
