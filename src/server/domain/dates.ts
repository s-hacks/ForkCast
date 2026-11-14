/**
 * Calendar-date helpers (D-32). Meal dates are "YYYY-MM-DD" strings in the shelter
 * timezone. Arithmetic works on calendar fields, never on 24h millisecond offsets,
 * so DST transitions cannot shift a date.
 */
import { TZDate } from "@date-fns/tz";

export type MealPeriod = "BREAKFAST" | "LUNCH" | "DINNER";
export const PERIODS: MealPeriod[] = ["BREAKFAST", "LUNCH", "DINNER"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Postgres DATE <-> JS Date at UTC midnight (how Prisma maps @db.Date). */
export function dateToDb(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}
export function dbToDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: string, n: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function todayIn(tz: string, now: Date = new Date()): string {
  const z = new TZDate(now.getTime(), tz);
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
}

export function parseStartTimes(spec: string): Record<MealPeriod, [number, number]> {
  const parts = spec.split(",").map((p) => p.trim().split(":").map(Number) as [number, number]);
  return { BREAKFAST: parts[0] ?? [7, 0], LUNCH: parts[1] ?? [11, 30], DINNER: parts[2] ?? [17, 0] };
}

/** Absolute instant a meal starts, computed in the shelter timezone (DST-safe). */
export function mealStartsAt(date: string, period: MealPeriod, tz: string, startTimes: Record<MealPeriod, [number, number]>): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = startTimes[period];
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, tz).getTime());
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from, to: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}` };
}

export function weekdayName(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}
export function prettyDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
