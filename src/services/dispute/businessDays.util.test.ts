import { addBusinessDays } from "./businessDays.util";

describe("addBusinessDays", () => {
  it("adds business days within the same week", () => {
    // 2026-07-27 is a Monday
    const result = addBusinessDays(new Date("2026-07-27T00:00:00.000Z"), 3);
    expect(result.toISOString().slice(0, 10)).toBe("2026-07-30"); // Thursday
  });

  it("skips over a weekend", () => {
    // 2026-07-30 is a Thursday; +3 business days -> Fri, (skip Sat/Sun), Mon, Tue
    const result = addBusinessDays(new Date("2026-07-30T00:00:00.000Z"), 3);
    expect(result.toISOString().slice(0, 10)).toBe("2026-08-04"); // Tuesday
  });

  it("skips a full weekend when starting on a Friday", () => {
    // 2026-07-31 is a Friday; +1 business day -> Monday 2026-08-03
    const result = addBusinessDays(new Date("2026-07-31T00:00:00.000Z"), 1);
    expect(result.toISOString().slice(0, 10)).toBe("2026-08-03");
  });
});
