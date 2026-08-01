// ============================================================
// Pure, dependency-free helpers for availability window math —
// kept separate from availability.service.ts so they're directly
// unit-testable without mocking Prisma.
// ============================================================

export interface MinuteWindow {
  startMinutes: number;
  endMinutes: number;
}

export interface BookedWindow extends MinuteWindow {
  bufferMinutes: number;
}

const DAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

/** `date` must be a plain "YYYY-MM-DD" string — parsed as UTC to avoid local-timezone day-shift. */
export function dayOfWeekFromDateString(date: string): (typeof DAY_NAMES)[number] {
  const [y, m, d] = date.split("-").map(Number);
  const utcDate = new Date(Date.UTC(y, m - 1, d));
  return DAY_NAMES[utcDate.getUTCDay()];
}

export function timeStringToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** DB Time() columns round-trip as Date objects at epoch day — read the UTC time-of-day back out. */
export function dbTimeToMinutes(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function minutesToDbTime(minutes: number): Date {
  return new Date(Date.UTC(1970, 0, 1, Math.floor(minutes / 60), minutes % 60, 0));
}

// ============================================================
// Wall-clock (WAT) -> absolute instant conversion.
//
// Mentora operates entirely in Cameroon/West Africa Time — fixed UTC+1
// year-round, no daylight saving. `sessionDate`/`sessionStartTime`/
// `sessionEndTime` are wall-clock values a tutor/student picked meaning
// WAT (e.g. "14:00" means 2pm in Douala). `new Date()` ("now") is always
// a true UTC instant. Comparing the two requires converting the WAT
// wall-clock digits to the UTC instant they actually correspond to —
// i.e. subtracting the 1-hour offset. Constructing the instant via
// `date.setUTCHours(rawDigits)` (treating "14:00 WAT" as if it were
// "14:00 UTC") is wrong by exactly one hour and must never be done
// directly at a call site — always go through sessionStartAt/sessionEndAt.
// ============================================================
export const WAT_OFFSET_HOURS = 1;

export function watWallClockToInstant(dateOnly: Date, timeOfDay: Date): Date {
  const minutes = dbTimeToMinutes(timeOfDay);
  return new Date(
    Date.UTC(
      dateOnly.getUTCFullYear(),
      dateOnly.getUTCMonth(),
      dateOnly.getUTCDate(),
      Math.floor(minutes / 60) - WAT_OFFSET_HOURS,
      minutes % 60,
      0,
      0
    )
  );
}

/** The absolute instant a booking's session actually starts, in real time. */
export function sessionStartAt(booking: { sessionDate: Date; sessionStartTime: Date }): Date {
  return watWallClockToInstant(booking.sessionDate, booking.sessionStartTime);
}

/** The absolute instant a booking's session actually ends, in real time. */
export function sessionEndAt(booking: { sessionDate: Date; sessionEndTime: Date }): Date {
  return watWallClockToInstant(booking.sessionDate, booking.sessionEndTime);
}

/**
 * "Today" as a `@db.Date`-compatible calendar marker in WAT — matches how
 * `sessionDate` values are stored (UTC-midnight anchored to the WAT
 * calendar day's Y/M/D, never a real instant). Use this instead of
 * `new Date(); date.setUTCHours(0,0,0,0)`, which reads the *UTC* calendar
 * day and is wrong during the ~1-hour window each day where the WAT date
 * has already rolled over but the UTC date hasn't yet.
 */
export function watCalendarDate(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + WAT_OFFSET_HOURS * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/**
 * The true instant 00:00:00 WAT occurs on the calendar day containing
 * `now` — for filtering real timestamp columns (createdAt, etc.) by
 * "since start of WAT day/week/month". Never use `date.setHours(0,0,0,0)`
 * (local-timezone-dependent — happens to work only if the process's OS
 * timezone is coincidentally WAT, silently wrong everywhere else,
 * including most default-UTC production containers).
 */
export function watStartOfDay(now: Date = new Date()): Date {
  return new Date(watCalendarDate(now).getTime() - WAT_OFFSET_HOURS * 60 * 60 * 1000);
}

/** Start of the WAT week (Sunday), as a true instant — see watStartOfDay. */
export function watStartOfWeek(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + WAT_OFFSET_HOURS * 60 * 60 * 1000);
  const dow = shifted.getUTCDay(); // 0 = Sunday
  const dayMarker = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - dow));
  return new Date(dayMarker.getTime() - WAT_OFFSET_HOURS * 60 * 60 * 1000);
}

/** Start of the WAT month, as a true instant — see watStartOfDay. */
export function watStartOfMonth(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + WAT_OFFSET_HOURS * 60 * 60 * 1000);
  const dayMarker = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1));
  return new Date(dayMarker.getTime() - WAT_OFFSET_HOURS * 60 * 60 * 1000);
}

/**
 * Subtracts each booked (+ buffer) window from the raw availability
 * windows, returning what's left open. Windows fully consumed by a
 * booking disappear entirely; partially-overlapping windows are split.
 */
export function subtractBookedWindows(
  raw: MinuteWindow[],
  booked: BookedWindow[]
): MinuteWindow[] {
  let windows = raw.map((w) => ({ ...w }));

  for (const b of booked) {
    const blockedStart = b.startMinutes - b.bufferMinutes;
    const blockedEnd = b.endMinutes + b.bufferMinutes;
    const next: MinuteWindow[] = [];

    for (const w of windows) {
      const noOverlap = blockedEnd <= w.startMinutes || blockedStart >= w.endMinutes;
      if (noOverlap) {
        next.push(w);
        continue;
      }
      if (blockedStart > w.startMinutes) {
        next.push({ startMinutes: w.startMinutes, endMinutes: Math.min(blockedStart, w.endMinutes) });
      }
      if (blockedEnd < w.endMinutes) {
        next.push({ startMinutes: Math.max(blockedEnd, w.startMinutes), endMinutes: w.endMinutes });
      }
    }
    windows = next.filter((w) => w.endMinutes > w.startMinutes);
  }

  return windows.sort((a, b) => a.startMinutes - b.startMinutes);
}

/**
 * Adds N business days (Mon-Fri) to an instant, walking day-by-day in WAT —
 * used for SLA deadlines (e.g. KYC review escalation). Walking via local
 * Date methods (`setDate`/`getDay`) would classify weekday-vs-weekend by
 * whichever timezone the process happens to run in, which is wrong on any
 * host that isn't coincidentally WAT (most production containers default
 * to UTC).
 */
export function addWatBusinessDays(from: Date, days: number): Date {
  let cursor = new Date(from.getTime() + WAT_OFFSET_HOURS * 60 * 60 * 1000);
  let added = 0;
  while (added < days) {
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    const watDay = cursor.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (watDay !== 0 && watDay !== 6) added++;
  }
  return new Date(cursor.getTime() - WAT_OFFSET_HOURS * 60 * 60 * 1000);
}
