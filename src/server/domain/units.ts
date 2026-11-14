/**
 * Unit handling (D-21). All stored quantities are integers in base units:
 * grams (MASS), millilitres (VOLUME), each (COUNT). No cross-kind conversion.
 */
import { DomainError } from "./errors";

export type UnitKind = "MASS" | "VOLUME" | "COUNT";

export const UNITS: Record<string, { kind: UnitKind; factor: number; label: string }> = {
  g: { kind: "MASS", factor: 1, label: "g" },
  kg: { kind: "MASS", factor: 1000, label: "kg" },
  oz: { kind: "MASS", factor: 28.349523125, label: "oz" },
  lb: { kind: "MASS", factor: 453.59237, label: "lb" },
  ml: { kind: "VOLUME", factor: 1, label: "ml" },
  l: { kind: "VOLUME", factor: 1000, label: "L" },
  each: { kind: "COUNT", factor: 1, label: "each" },
};

export const UNITS_BY_KIND: Record<UnitKind, string[]> = {
  MASS: ["g", "kg", "oz", "lb"],
  VOLUME: ["ml", "l"],
  COUNT: ["each"],
};

export function unitInfo(unit: string) {
  const u = UNITS[unit];
  if (!u) throw new DomainError("VALIDATION_ERROR", `Unknown unit "${unit}".`, { fieldErrors: { unit: ["Unknown unit"] } });
  return u;
}

/** Convert a user-entered quantity to integer base units, rejecting incompatible kinds. */
export function toBase(quantity: number, unit: string, expectedKind: UnitKind): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new DomainError("VALIDATION_ERROR", "Quantity must be a non-negative number.", { fieldErrors: { quantity: ["Invalid quantity"] } });
  }
  const u = unitInfo(unit);
  if (u.kind !== expectedKind) {
    throw new DomainError("UNIT_INCOMPATIBLE", `Unit "${unit}" (${u.kind.toLowerCase()}) cannot be used for a ${expectedKind.toLowerCase()} item.`);
  }
  return Math.round(quantity * u.factor);
}

/** Base units -> display number in the given unit (max 2 decimals). */
export function fromBase(base: number, unit: string): number {
  const u = unitInfo(unit);
  return Math.round((base / u.factor) * 100) / 100;
}

export function formatQty(base: number, unit: string): string {
  return `${fromBase(base, unit).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${unitInfo(unit).label}`;
}
