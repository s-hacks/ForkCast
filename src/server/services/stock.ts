/**
 * Pantry stock primitives (D-17..D-20). Every change writes an InventoryTransaction so that
 * sum(deltaOnHand) == onHandQty and sum(deltaReserved) == reservedQty (ledger invariant).
 */
import "server-only";
import type { Tx } from "../db/client";
import { InventoryTxnType } from "@/generated/prisma/client";

type Row = { onHandQty: number; reservedQty: number };

async function ledger(tx: Tx, itemId: string, type: InventoryTxnType, dOn: number, dRes: number, after: Row, reason: string, actorId: string | null, planId?: string) {
  await tx.inventoryTransaction.create({
    data: { pantryItemId: itemId, type, deltaOnHand: dOn, deltaReserved: dRes, onHandAfter: after.onHandQty, reservedAfter: after.reservedQty, reason, actorId, planId },
  });
}

/** Atomic conditional reserve: succeeds only if unreserved stock >= qty. Returns false otherwise. */
export async function tryReserve(tx: Tx, itemId: string, qty: number, reason: string, actorId: string | null, planId: string): Promise<boolean> {
  if (qty <= 0) return true;
  const rows = await tx.$queryRaw<Row[]>`
    UPDATE "PantryItem" SET "reservedQty" = "reservedQty" + ${qty}, "version" = "version" + 1, "updatedAt" = now()
    WHERE id = ${itemId}::uuid AND "onHandQty" - "reservedQty" >= ${qty}
    RETURNING "onHandQty", "reservedQty"`;
  if (rows.length === 0) return false;
  await ledger(tx, itemId, "RESERVE", 0, qty, rows[0], reason, actorId, planId);
  return true;
}

export async function releaseReserved(tx: Tx, itemId: string, qty: number, reason: string, actorId: string | null, planId: string) {
  if (qty <= 0) return;
  const rows = await tx.$queryRaw<Row[]>`
    UPDATE "PantryItem" SET "reservedQty" = "reservedQty" - ${qty}, "version" = "version" + 1, "updatedAt" = now()
    WHERE id = ${itemId}::uuid RETURNING "onHandQty", "reservedQty"`;
  await ledger(tx, itemId, "RELEASE", 0, -qty, rows[0], reason, actorId, planId);
}

/** Change physical stock (receipt / correction / consumption). CHECK constraint guards reserved <= onHand. */
export async function changeOnHand(tx: Tx, itemId: string, delta: number, dReserved: number, type: InventoryTxnType, reason: string, actorId: string | null, planId?: string) {
  const rows = await tx.$queryRaw<Row[]>`
    UPDATE "PantryItem" SET "onHandQty" = "onHandQty" + ${delta}, "reservedQty" = "reservedQty" + ${dReserved},
      "version" = "version" + 1, "updatedAt" = now()
    WHERE id = ${itemId}::uuid RETURNING "onHandQty", "reservedQty"`;
  await ledger(tx, itemId, type, delta, dReserved, rows[0], reason, actorId, planId);
  return rows[0];
}

/** Shrink a plan line's ACTIVE allocations by `amount`, newest first (D-03 / D-14 / D-20). */
export async function trimAllocations(tx: Tx, planIngredientId: string, amount: number, reason: string, actorId: string | null) {
  let left = amount;
  if (left <= 0) return 0;
  const allocs = await tx.pantryAllocation.findMany({ where: { planIngredientId, status: "ACTIVE" }, orderBy: { createdAt: "desc" } });
  for (const a of allocs) {
    if (left <= 0) break;
    const take = Math.min(a.quantity, left);
    if (take === a.quantity) await tx.pantryAllocation.update({ where: { id: a.id }, data: { status: "RELEASED" } });
    else await tx.pantryAllocation.update({ where: { id: a.id }, data: { quantity: a.quantity - take } });
    await releaseReserved(tx, a.pantryItemId, take, reason, actorId, a.planId);
    left -= take;
  }
  return amount - left;
}
