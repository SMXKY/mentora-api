export type RecurrenceType = "WEEKLY" | "BIWEEKLY" | "CUSTOM";

export interface RecurrenceInput {
  recurrenceType: RecurrenceType;
  startDate: string; // "YYYY-MM-DD"
  endDate?: string;
  occurrenceCount?: number;
  /** For CUSTOM only — explicit "YYYY-MM-DD" dates, used verbatim. */
  recurrenceDays?: string[];
}

const DEFAULT_MAX_OCCURRENCES = 52;

/** Pure — computes every session date ("YYYY-MM-DD") for a recurring booking request. */
export function computeOccurrenceDates(input: RecurrenceInput): string[] {
  if (input.recurrenceType === "CUSTOM") {
    return [...(input.recurrenceDays ?? [])].sort();
  }

  const stepDays = input.recurrenceType === "WEEKLY" ? 7 : 14;
  const maxCount = input.occurrenceCount ?? DEFAULT_MAX_OCCURRENCES;
  const end = input.endDate ? new Date(`${input.endDate}T00:00:00.000Z`) : null;

  const dates: string[] = [];
  let current = new Date(`${input.startDate}T00:00:00.000Z`);
  while (dates.length < maxCount) {
    if (end && current.getTime() > end.getTime()) break;
    dates.push(current.toISOString().slice(0, 10));
    current = new Date(current.getTime() + stepDays * 24 * 60 * 60 * 1000);
  }
  return dates;
}
