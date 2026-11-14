import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { prisma } from "@/server/db/client";
import { addDays, dateToDb, todayIn, type MealPeriod } from "@/server/domain/dates";
import type { VolunteerSession } from "@/server/auth/guards";
import { DomainError } from "@/server/domain/errors";

/** Reseed firehouse_test with the demo dataset (same script as demo:reset). */
export function reseed() {
  execSync("npx tsx prisma/seed.ts", { stdio: "pipe", env: process.env });
}

export function scenarioTuesday(): string {
  const today = todayIn(process.env.SHELTER_TIMEZONE ?? "America/Chicago");
  let T = addDays(today, 1);
  while (new Date(`${T}T12:00:00Z`).getUTCDay() !== 2) T = addDays(T, 1);
  return T;
}

export async function slotId(date: string, period: MealPeriod) {
  const s = await prisma.mealSlot.findUniqueOrThrow({ where: { date_period: { date: dateToDb(date), period } } });
  return s.id;
}

export async function volunteer(username: string, org?: string): Promise<VolunteerSession> {
  const u = await prisma.user.findUniqueOrThrow({ where: { username } });
  let context: VolunteerSession["context"] = { type: "SOLO" };
  if (org) {
    const o = await prisma.organization.findUniqueOrThrow({ where: { name: org } });
    context = { type: "ORGANIZATION", organizationId: o.id, organizationName: o.name };
  }
  return { sessionId: "test", user: { id: u.id, username: u.username, displayName: u.displayName, role: u.role }, context };
}

export async function adminSession() {
  const u = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  return { sessionId: "test", user: { id: u.id, username: u.username, displayName: u.displayName, role: u.role }, context: null };
}

export const key = () => randomUUID();

export async function expectCode(p: Promise<unknown>, code: string) {
  try {
    await p;
  } catch (e) {
    if (e instanceof DomainError) {
      if (e.code !== code) throw new Error(`Expected ${code}, got ${e.code}: ${e.message}`);
      return e;
    }
    throw e;
  }
  throw new Error(`Expected ${code}, but the call succeeded`);
}

/** Ledger invariant: transactions reconcile exactly with item columns. */
export async function assertLedger() {
  const items = await prisma.pantryItem.findMany();
  for (const it of items) {
    const agg = await prisma.inventoryTransaction.aggregate({ where: { pantryItemId: it.id }, _sum: { deltaOnHand: true, deltaReserved: true } });
    const allocs = await prisma.pantryAllocation.aggregate({ where: { pantryItemId: it.id, status: "ACTIVE" }, _sum: { quantity: true } });
    if ((agg._sum.deltaOnHand ?? 0) !== it.onHandQty) throw new Error(`${it.name}: ledger onHand ${agg._sum.deltaOnHand} != ${it.onHandQty}`);
    if ((agg._sum.deltaReserved ?? 0) !== it.reservedQty) throw new Error(`${it.name}: ledger reserved ${agg._sum.deltaReserved} != ${it.reservedQty}`);
    if ((allocs._sum.quantity ?? 0) !== it.reservedQty) throw new Error(`${it.name}: active allocations ${allocs._sum.quantity} != reserved ${it.reservedQty}`);
  }
}
