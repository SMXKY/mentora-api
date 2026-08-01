import { computeOccurrenceDates } from "./recurrence.util";

describe("computeOccurrenceDates", () => {
  it("generates weekly occurrences until occurrenceCount is reached", () => {
    const dates = computeOccurrenceDates({
      recurrenceType: "WEEKLY",
      startDate: "2026-08-03",
      occurrenceCount: 3,
    });
    expect(dates).toEqual(["2026-08-03", "2026-08-10", "2026-08-17"]);
  });

  it("generates biweekly occurrences", () => {
    const dates = computeOccurrenceDates({
      recurrenceType: "BIWEEKLY",
      startDate: "2026-08-03",
      occurrenceCount: 3,
    });
    expect(dates).toEqual(["2026-08-03", "2026-08-17", "2026-08-31"]);
  });

  it("stops at endDate even if occurrenceCount would allow more", () => {
    const dates = computeOccurrenceDates({
      recurrenceType: "WEEKLY",
      startDate: "2026-08-03",
      endDate: "2026-08-12",
      occurrenceCount: 10,
    });
    expect(dates).toEqual(["2026-08-03", "2026-08-10"]);
  });

  it("returns the explicit sorted date list for CUSTOM", () => {
    const dates = computeOccurrenceDates({
      recurrenceType: "CUSTOM",
      startDate: "2026-08-03",
      recurrenceDays: ["2026-08-20", "2026-08-05"],
    });
    expect(dates).toEqual(["2026-08-05", "2026-08-20"]);
  });
});
