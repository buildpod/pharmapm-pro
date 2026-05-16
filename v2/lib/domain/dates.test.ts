import { describe, it, expect } from "vitest";
import {
  isValidISO,
  dayOfWeek,
  today,
  nowISO,
  addDays,
  addWorkingDays,
  daysBetween,
  workingDaysBetween,
  compare,
} from "./dates";

describe("dates.isValidISO", () => {
  it("accepts valid date", () => expect(isValidISO("2026-04-19")).toBe(true));
  it("rejects Feb 31", () => expect(isValidISO("2026-02-31")).toBe(false));
  it("rejects garbage", () => expect(isValidISO("not-a-date")).toBe(false));
});

describe("dates.addDays", () => {
  it("+5 days", () => expect(addDays("2026-04-19", 5)).toBe("2026-04-24"));
  it("crosses year boundary", () => expect(addDays("2026-12-31", 1)).toBe("2027-01-01"));
});

describe("dates.addWorkingDays", () => {
  it("Fri+3 working days = Wed", () => expect(addWorkingDays("2026-04-17", 3)).toBe("2026-04-22"));
  it("+1 from Mon = Tue", () => expect(addWorkingDays("2026-05-04", 1)).toBe("2026-05-05"));
  it("-1 from Mon = prev Fri (skips weekend)", () => expect(addWorkingDays("2026-05-04", -1)).toBe("2026-05-01"));
  it("-5 from Fri = prev Fri", () => expect(addWorkingDays("2026-05-08", -5)).toBe("2026-05-01"));
  it("0 returns input unchanged", () => expect(addWorkingDays("2026-05-04", 0)).toBe("2026-05-04"));
});

describe("dates.daysBetween", () => {
  it("9 days between Apr 1 and Apr 10", () => expect(daysBetween("2026-04-01", "2026-04-10")).toBe(9));
});

describe("dates.workingDaysBetween (M20.5 PL-3)", () => {
  it("zero when same date", () =>
    expect(workingDaysBetween("2026-05-04", "2026-05-04")).toBe(0));
  it("5 working days across a weekend (Fri → Fri = 5 WD, 7 cal days)", () =>
    expect(workingDaysBetween("2026-05-08", "2026-05-15")).toBe(5));
  it("1 working day Fri → Mon", () =>
    expect(workingDaysBetween("2026-05-08", "2026-05-11")).toBe(1));
  it("negative when b precedes a", () =>
    expect(workingDaysBetween("2026-05-15", "2026-05-08")).toBe(-5));
  it("respects holidays", () =>
    expect(workingDaysBetween("2026-05-08", "2026-05-15", [1, 2, 3, 4, 5], ["2026-05-11"])).toBe(4));
  it("custom working week — Sun–Thu Mid-East", () =>
    // Sun 05-10 → Sun 05-17 = 5 working days under Sun–Thu calendar
    expect(workingDaysBetween("2026-05-10", "2026-05-17", [0, 1, 2, 3, 4])).toBe(5));
});

describe("dates.compare", () => {
  it("earlier < later returns -1", () => expect(compare("2026-01-01", "2026-02-01")).toBe(-1));
  it("later > earlier returns 1", () => expect(compare("2026-02-01", "2026-01-01")).toBe(1));
  it("equal dates return 0", () => expect(compare("2026-01-01", "2026-01-01")).toBe(0));
});

describe("dates.dayOfWeek", () => {
  it("2026-04-19 is Sunday (0)", () => expect(dayOfWeek("2026-04-19")).toBe(0));
});

describe("dates.today", () => {
  it("returns a valid ISO string", () => {
    const t = today();
    expect(typeof t).toBe("string");
    expect(isValidISO(t)).toBe(true);
  });
});

describe("dates.nowISO", () => {
  it("contains T separator", () => {
    expect(typeof nowISO()).toBe("string");
    expect(nowISO().indexOf("T")).toBeGreaterThan(0);
  });
});
