import {
  dayOfWeekFromDateString,
  timeStringToMinutes,
  minutesToTimeString,
  subtractBookedWindows,
} from "./availability.logic";

describe("dayOfWeekFromDateString", () => {
  it("resolves a date to its UTC day-of-week name", () => {
    // 2026-07-27 is a Monday
    expect(dayOfWeekFromDateString("2026-07-27")).toBe("MONDAY");
    // 2026-08-02 is a Sunday
    expect(dayOfWeekFromDateString("2026-08-02")).toBe("SUNDAY");
  });
});

describe("timeStringToMinutes / minutesToTimeString", () => {
  it("round-trips HH:mm through minutes", () => {
    expect(timeStringToMinutes("09:30")).toBe(570);
    expect(minutesToTimeString(570)).toBe("09:30");
    expect(timeStringToMinutes("00:00")).toBe(0);
    expect(minutesToTimeString(0)).toBe("00:00");
  });
});

describe("subtractBookedWindows", () => {
  it("returns the full raw window when nothing is booked", () => {
    const result = subtractBookedWindows([{ startMinutes: 480, endMinutes: 720 }], []);
    expect(result).toEqual([{ startMinutes: 480, endMinutes: 720 }]);
  });

  it("splits a window around a booking in the middle, applying buffer on both sides", () => {
    // 08:00-12:00 raw, booking 09:00-10:00 with 30min buffer -> blocks 08:30-10:30
    const result = subtractBookedWindows(
      [{ startMinutes: 480, endMinutes: 720 }],
      [{ startMinutes: 540, endMinutes: 600, bufferMinutes: 30 }]
    );
    expect(result).toEqual([
      { startMinutes: 480, endMinutes: 510 },
      { startMinutes: 630, endMinutes: 720 },
    ]);
  });

  it("removes a window entirely when the booking (+buffer) fully covers it", () => {
    const result = subtractBookedWindows(
      [{ startMinutes: 540, endMinutes: 600 }],
      [{ startMinutes: 540, endMinutes: 600, bufferMinutes: 0 }]
    );
    expect(result).toEqual([]);
  });

  it("leaves a window untouched when the booking doesn't overlap even with buffer", () => {
    const result = subtractBookedWindows(
      [{ startMinutes: 480, endMinutes: 600 }],
      [{ startMinutes: 700, endMinutes: 760, bufferMinutes: 15 }]
    );
    expect(result).toEqual([{ startMinutes: 480, endMinutes: 600 }]);
  });

  it("applies multiple bookings cumulatively", () => {
    const result = subtractBookedWindows(
      [{ startMinutes: 480, endMinutes: 720 }],
      [
        { startMinutes: 480, endMinutes: 540, bufferMinutes: 0 },
        { startMinutes: 660, endMinutes: 720, bufferMinutes: 0 },
      ]
    );
    expect(result).toEqual([{ startMinutes: 540, endMinutes: 660 }]);
  });
});
