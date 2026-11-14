import { describe, expect, it } from "vitest";
import { toBase, fromBase, formatQty } from "@/server/domain/units";
import { addDays, isDateString, mealStartsAt, monthRange, parseStartTimes, todayIn } from "@/server/domain/dates";
import { DomainError } from "@/server/domain/errors";
import { assertResetAllowed } from "../../scripts/reset-guard";

describe("units (D-21)", () => {
  it("converts within a kind to integer base units", () => {
    expect(toBase(1, "lb", "MASS")).toBe(454);
    expect(toBase(2.5, "kg", "MASS")).toBe(2500);
    expect(toBase(1.5, "l", "VOLUME")).toBe(1500);
    expect(toBase(12, "each", "COUNT")).toBe(12);
    expect(fromBase(2500, "kg")).toBe(2.5);
    expect(formatQty(4536, "lb")).toBe("10 lb");
  });
  it("rejects incompatible units instead of converting", () => {
    expect(() => toBase(1, "l", "MASS")).toThrowError(DomainError);
    try {
      toBase(1, "each", "VOLUME");
    } catch (e) {
      expect((e as DomainError).code).toBe("UNIT_INCOMPATIBLE");
    }
  });
  it("rejects negative / NaN and unknown units", () => {
    expect(() => toBase(-1, "g", "MASS")).toThrow();
    expect(() => toBase(Number.NaN, "g", "MASS")).toThrow();
    expect(() => toBase(1, "cup", "VOLUME")).toThrow();
  });
});

describe("dates (D-32, Test 17)", () => {
  const st = parseStartTimes("07:00,11:30,17:00");
  it("validates calendar dates", () => {
    expect(isDateString("2026-02-29")).toBe(false);
    expect(isDateString("2028-02-29")).toBe(true);
    expect(isDateString("2026-13-01")).toBe(false);
  });
  it("adds days across DST boundaries without shifting", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08"); // US DST start
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01"); // DST end
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("computes meal start in shelter local time on DST days", () => {
    // 11:30 CDT = 16:30Z before; 11:30 CST = 17:30Z after.
    expect(mealStartsAt("2026-10-31", "LUNCH", "America/Chicago", st).toISOString()).toBe("2026-10-31T16:30:00.000Z");
    expect(mealStartsAt("2026-11-01", "LUNCH", "America/Chicago", st).toISOString()).toBe("2026-11-01T17:30:00.000Z");
    expect(mealStartsAt("2026-03-08", "BREAKFAST", "America/Chicago", st).toISOString()).toBe("2026-03-08T12:00:00.000Z") // 07:00 CDT (DST began 02:00);
  });
  it("derives today in the shelter timezone, not UTC", () => {
    // 2026-11-15T03:00Z is still Nov 14 evening in Chicago.
    expect(todayIn("America/Chicago", new Date("2026-11-15T03:00:00Z"))).toBe("2026-11-14");
  });
  it("month range handles leap years", () => {
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
});

describe("demo reset guard", () => {
  it("refuses production and remote hosts", () => {
    expect(() => assertResetAllowed("postgresql://u:p@localhost:5432/db", { NODE_ENV: "production" })).toThrow();
    expect(() => assertResetAllowed("postgresql://u:p@db.neon.tech/db", {})).toThrow(/not local/);
    expect(() => assertResetAllowed("postgresql://u:p@db.neon.tech/db", { ALLOW_DEMO_RESET: "true" })).not.toThrow();
    expect(() => assertResetAllowed("postgresql://u:p@127.0.0.1/db", {})).not.toThrow();
  });
});
