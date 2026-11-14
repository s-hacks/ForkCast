/**
 * Administrator operations: meal plans (D-14..D-16), inventory (D-17..D-21),
 * grocery receipts (D-18) and served reconciliation (D-19).
 */
import "server-only";
import { prisma, withTx, type Tx } from "../db/client";
import { DomainError } from "../domain/errors";
import { computeAvailability, demand } from "../domain/availability";
import { dateToDb, isDateString, type MealPeriod } from "../domain/dates";
import { formatQty, toBase, UNITS_BY_KIND, type UnitKind } from "../domain/units";
import { audit, runIdempotent } from "./platform";
import { getPlanState, lockPlan, mealDetail } from "./meals";
import { cancelInTx } from "./commitments";
import { changeOnHand, trimAllocations } from "./stock";

type Admin = { user: { id: string; role: "USER" | "ADMIN" } };
const adminViewer = (a: Admin) => ({ userId: a.user.id, role: "ADMIN" as const, context: null });

export interface PlanInput {
  date: string;
  period: MealPeriod;
  dishName: string;
  servingsTarget: number;
  recipeYield: number;
  serviceCapacity: number;
  ingredients: { pantryItemId: string; quantity: number; unit: string }[];
  publish: boolean;
}

async function resolveIngredients(tx: Tx, ings: PlanInput["ingredients"]) {
  const seen = new Set<string>();
  const out: { pantryItemId: string; quantity: number; inputUnit: string }[] = [];
  for (const i of ings) {
    if (seen.has(i.pantryItemId)) throw new DomainError("VALIDATION_ERROR", "Each pantry item may appear only once per recipe.", { fieldErrors: { ingredients: ["Duplicate item"] } });
    seen.add(i.pantryItemId);
    const item = await tx.pantryItem.findUnique({ where: { id: i.pantryItemId } });
    if (!item) throw new DomainError("VALIDATION_ERROR", "Unknown pantry item.", { fieldErrors: { ingredients: ["Unknown item"] } });
    const q = toBase(i.quantity, i.unit, item.unitKind);
    if (q <= 0) throw new DomainError("VALIDATION_ERROR", `${item.name}: quantity must be greater than zero.`, { fieldErrors: { ingredients: ["Must be > 0"] } });
    out.push({ pantryItemId: i.pantryItemId, quantity: q, inputUnit: i.unit });
  }
  return out;
}

export async function createPlan(a: Admin, input: PlanInput, key: string) {
  if (!isDateString(input.date)) throw new DomainError("VALIDATION_ERROR", "Invalid date.", { fieldErrors: { date: ["Invalid date"] } });
  return withTx((tx) =>
    runIdempotent(tx, a.user.id, key, "admin:createPlan", async () => {
      const slot = await tx.mealSlot.upsert({
        where: { date_period: { date: dateToDb(input.date), period: input.period } },
        create: { date: dateToDb(input.date), period: input.period },
        update: {},
      });
      const existing = await tx.mealPlan.findFirst({ where: { slotId: slot.id, status: { not: "CANCELLED" } } });
      if (existing) throw new DomainError("VERSION_CONFLICT", "This meal slot already has a plan. Edit it instead.", { planId: existing.id });
      const ings = await resolveIngredients(tx, input.ingredients);
      const plan = await tx.mealPlan.create({
        data: {
          slotId: slot.id,
          dishName: input.dishName.trim(),
          servingsTarget: input.servingsTarget,
          recipeYield: input.recipeYield,
          serviceCapacity: input.serviceCapacity,
          status: input.publish ? "PUBLISHED" : "DRAFT",
          publishedAt: input.publish ? new Date() : null,
          ingredients: { create: ings },
        },
      });
      await audit(tx, a.user.id, "plan.create", "MealPlan", plan.id, { ...input });
      return { status: 201, body: await mealDetail(tx, plan.id, adminViewer(a)) };
    }),
  );
}

export interface Conflict {
  kind: "SERVINGS_BELOW_PREPARED" | "INGREDIENT_BELOW_PLEDGED" | "SERVING_CAPACITY_BELOW_BOOKED" | "PLAN_HAS_COMMITMENTS";
  message: string;
}

export async function updatePlan(a: Admin, planId: string, input: Omit<PlanInput, "date" | "period" | "publish"> & { version: number; acknowledgeConflicts?: boolean }, key: string) {
  return withTx((tx) =>
    runIdempotent(tx, a.user.id, key, `admin:updatePlan:${planId}`, async () => {
      await lockPlan(tx, planId);
      const st = await getPlanState(tx, planId);
      if (st.plan.status === "CANCELLED" || st.plan.status === "COMPLETED") throw new DomainError("PLAN_NOT_BOOKABLE", "Cancelled or completed plans cannot be edited.");
      if (st.plan.version !== input.version) throw new DomainError("VERSION_CONFLICT", "This plan was changed by someone else. Reload and try again.");
      const ings = await resolveIngredients(tx, input.ingredients);
      const newQ = new Map(ings.map((i) => [i.pantryItemId, i.quantity]));

      // Hypothetical availability under the new plan (D-14).
      const P = st.result.prepared.committed;
      const hypoLines = st.ingredients.map((i) => {
        const r = st.result.ingredients.lines.find((l) => l.ingredientId === i.id)!;
        const q = newQ.get(i.pantryItemId);
        return { ingredientId: i.id, q: q ?? 1, reserved: r.reserved, pledged: r.pledged, pantryAvailable: 0, removed: q === undefined, name: i.pantryItem.name, unit: i.pantryItem.displayUnit };
      });
      const hypo = computeAvailability({
        servingsTarget: input.servingsTarget,
        recipeYield: input.recipeYield,
        serviceCapacity: input.serviceCapacity,
        preparedCommitted: P,
        servingBooked: st.result.serving.booked,
        lines: hypoLines,
        status: "PUBLISHED",
        closed: false,
      });
      const conflicts: Conflict[] = [];
      if (P > input.servingsTarget) conflicts.push({ kind: "SERVINGS_BELOW_PREPARED", message: `${P} prepared servings are already committed, more than the new target of ${input.servingsTarget}.` });
      for (const l of hypoLines) {
        const req = l.removed ? 0 : demand(l.q, hypo.kitchenServings, input.recipeYield);
        if (l.pledged > req) conflicts.push({ kind: "INGREDIENT_BELOW_PLEDGED", message: `${l.name}: ${formatQty(l.pledged, l.unit)} pledged by volunteers but only ${formatQty(req, l.unit)} would be needed.` });
      }
      if (st.result.serving.booked > input.serviceCapacity) conflicts.push({ kind: "SERVING_CAPACITY_BELOW_BOOKED", message: `${st.result.serving.booked} serving bookings exceed the new capacity of ${input.serviceCapacity}.` });
      if (conflicts.length > 0 && !input.acknowledgeConflicts) {
        throw new DomainError("PLAN_CONFLICT", "This change conflicts with existing volunteer commitments.", { conflicts });
      }

      // Apply: update lines in place, soft-remove dropped lines (D-15), add new ones.
      for (const i of st.ingredients.filter((x) => !x.removedAt)) {
        const q = newQ.get(i.pantryItemId);
        if (q === undefined) await tx.planIngredient.update({ where: { id: i.id }, data: { removedAt: new Date() } });
        else if (q !== i.quantity) await tx.planIngredient.update({ where: { id: i.id }, data: { quantity: q, inputUnit: ings.find((x) => x.pantryItemId === i.pantryItemId)!.inputUnit } });
      }
      const liveItemIds = new Set(st.ingredients.filter((x) => !x.removedAt).map((x) => x.pantryItemId));
      for (const i of ings.filter((x) => !liveItemIds.has(x.pantryItemId))) await tx.planIngredient.create({ data: { planId, ...i } });
      await tx.mealPlan.update({
        where: { id: planId },
        data: { dishName: input.dishName.trim(), servingsTarget: input.servingsTarget, recipeYield: input.recipeYield, serviceCapacity: input.serviceCapacity, version: { increment: 1 } },
      });
      // Release reservations above the new demand (pantry stock never stays stranded).
      const after = await getPlanState(tx, planId);
      for (const l of after.result.ingredients.lines) {
        const allowed = Math.max(0, l.required - l.pledged);
        if (l.reserved > allowed) await trimAllocations(tx, l.ingredientId, l.reserved - allowed, "Meal plan edited by admin", a.user.id);
      }
      await audit(tx, a.user.id, conflicts.length ? "plan.update.override" : "plan.update", "MealPlan", planId, { input, conflicts });
      return { status: 200, body: { conflicts, detail: await mealDetail(tx, planId, adminViewer(a)) } };
    }),
  );
}

export async function publishPlan(a: Admin, planId: string, key: string) {
  return withTx((tx) =>
    runIdempotent(tx, a.user.id, key, `admin:publish:${planId}`, async () => {
      await lockPlan(tx, planId);
      const p = await tx.mealPlan.findUnique({ where: { id: planId } });
      if (!p) throw new DomainError("NOT_FOUND", "Plan not found.");
      if (p.status !== "DRAFT") throw new DomainError("PLAN_NOT_BOOKABLE", "Only draft plans can be published.");
      if (!p.dishName.trim()) throw new DomainError("VALIDATION_ERROR", "A dish name is required before publishing.");
      await tx.mealPlan.update({ where: { id: planId }, data: { status: "PUBLISHED", publishedAt: new Date(), version: { increment: 1 } } });
      await audit(tx, a.user.id, "plan.publish", "MealPlan", planId);
      return { status: 200, body: await mealDetail(tx, planId, adminViewer(a)) };
    }),
  );
}

export async function cancelPlan(a: Admin, planId: string, acknowledge: boolean, key: string) {
  return withTx((tx) =>
    runIdempotent(tx, a.user.id, key, `admin:cancel:${planId}`, async () => {
      await lockPlan(tx, planId);
      const active = await tx.commitment.findMany({ where: { planId, status: "ACTIVE" }, select: { id: true } });
      if (active.length > 0 && !acknowledge) {
        throw new DomainError("PLAN_CONFLICT", `${active.length} active volunteer commitment(s) will be cancelled.`, {
          conflicts: [{ kind: "PLAN_HAS_COMMITMENTS", message: `${active.length} active commitments exist.` }],
        });
      }
      for (const c of active) await cancelInTx(tx, c.id, a.user.id, "Meal cancelled by admin");
      const allocs = await tx.pantryAllocation.findMany({ where: { planId, status: "ACTIVE" }, select: { planIngredientId: true, quantity: true } });
      for (const al of allocs) await trimAllocations(tx, al.planIngredientId, al.quantity, "Meal cancelled", a.user.id);
      await tx.mealPlan.update({ where: { id: planId }, data: { status: "CANCELLED", cancelledAt: new Date(), version: { increment: 1 } } });
      await audit(tx, a.user.id, "plan.cancel", "MealPlan", planId, { cancelledCommitments: active.length });
      return { status: 200, body: { ok: true } };
    }),
  );
}

/** D-19: reservations become consumption; on-hand and reserved drop together (no double subtraction). */
export async function markServed(a: Admin, planId: string, key: string) {
  return withTx((tx) =>
    runIdempotent(tx, a.user.id, key, `admin:served:${planId}`, async () => {
      await lockPlan(tx, planId);
      const st = await getPlanState(tx, planId);
      if (st.plan.status !== "PUBLISHED") throw new DomainError("PLAN_NOT_BOOKABLE", "Only published meals can be marked served.");
      const allocs = await tx.pantryAllocation.findMany({ where: { planId, status: "ACTIVE" }, orderBy: { pantryItemId: "asc" } });
      for (const al of allocs) {
        await tx.pantryAllocation.update({ where: { id: al.id }, data: { status: "CONSUMED" } });
        await changeOnHand(tx, al.pantryItemId, -al.quantity, -al.quantity, "CONSUMPTION", `Used for ${st.plan.dishName} ${st.date}`, a.user.id, planId);
      }
      await tx.mealPlan.update({ where: { id: planId }, data: { status: "COMPLETED", completedAt: new Date(), version: { increment: 1 } } });
      await audit(tx, a.user.id, "plan.served", "MealPlan", planId, { consumedAllocations: allocs.length });
      return { status: 200, body: { ok: true } };
    }),
  );
}

// ---------------- Inventory ----------------
export async function listPantry() {
  const items = await prisma.pantryItem.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } });
  const pledged = await prisma.groceryLine.groupBy({ by: ["planIngredientId"], where: { status: "PROMISED" }, _sum: { quantity: true } });
  const ingIds = pledged.map((p) => p.planIngredientId);
  const ingMap = new Map((await prisma.planIngredient.findMany({ where: { id: { in: ingIds } }, select: { id: true, pantryItemId: true } })).map((i) => [i.id, i.pantryItemId]));
  const pledgedByItem = new Map<string, number>();
  for (const p of pledged) {
    const item = ingMap.get(p.planIngredientId)!;
    pledgedByItem.set(item, (pledgedByItem.get(item) ?? 0) + (p._sum.quantity ?? 0));
  }
  // Upcoming shortage per item = sum of open shortages across published future meals.
  const plans = await prisma.mealPlan.findMany({ where: { status: "PUBLISHED" }, select: { id: true } });
  const { loadPlanState } = await import("./meals");
  const states = await loadPlanState(prisma, plans.map((p) => p.id));
  const shortageByItem = new Map<string, number>();
  for (const s of states.values()) {
    if (!s.result.bookable) continue;
    for (const l of s.result.ingredients.lines) {
      const ing = s.ingredients.find((i) => i.id === l.ingredientId)!;
      const open = Math.max(0, l.required - l.covered);
      shortageByItem.set(ing.pantryItemId, (shortageByItem.get(ing.pantryItemId) ?? 0) + open);
    }
  }
  return items.map((i) => {
    const pl = pledgedByItem.get(i.id) ?? 0;
    const open = shortageByItem.get(i.id) ?? 0;
    const available = i.onHandQty - i.reservedQty;
    return {
      id: i.id,
      name: i.name,
      unitKind: i.unitKind,
      displayUnit: i.displayUnit,
      units: UNITS_BY_KIND[i.unitKind],
      onHand: formatQty(i.onHandQty, i.displayUnit),
      reserved: formatQty(i.reservedQty, i.displayUnit),
      available: formatQty(available, i.displayUnit),
      pledged: formatQty(pl, i.displayUnit),
      openDemand: formatQty(open, i.displayUnit),
      insufficient: open > available,
      raw: { onHand: i.onHandQty, reserved: i.reservedQty, available, pledged: pl, openDemand: open },
    };
  });
}

export async function createPantryItem(a: Admin, input: { name: string; unitKind: UnitKind; displayUnit: string; initialQuantity?: number }, key: string) {
  if (!UNITS_BY_KIND[input.unitKind].includes(input.displayUnit)) throw new DomainError("UNIT_INCOMPATIBLE", "Display unit does not match the unit kind.");
  return withTx((tx) =>
    runIdempotent(tx, a.user.id, key, "admin:createItem", async () => {
      const dup = await tx.pantryItem.findFirst({ where: { name: { equals: input.name.trim(), mode: "insensitive" } } });
      if (dup) throw new DomainError("VALIDATION_ERROR", "An item with this name already exists.", { fieldErrors: { name: ["Already exists"] } });
      const item = await tx.pantryItem.create({ data: { name: input.name.trim(), unitKind: input.unitKind, displayUnit: input.displayUnit } });
      const q = input.initialQuantity ? toBase(input.initialQuantity, input.displayUnit, input.unitKind) : 0;
      if (q > 0) await changeOnHand(tx, item.id, q, 0, "INITIAL", "Initial stock", a.user.id);
      await audit(tx, a.user.id, "pantry.create", "PantryItem", item.id, { ...input });
      return { status: 201, body: { id: item.id } };
    }),
  );
}

export type AdjustInput =
  | { mode: "RECEIPT" | "ADJUSTMENT"; quantity: number; unit: string; reason: string; acknowledgeConflicts?: boolean }
  | { mode: "CORRECTION"; countedQuantity: number; unit: string; reason: string; acknowledgeConflicts?: boolean };

export async function adjustStock(a: Admin, itemId: string, input: AdjustInput, key: string) {
  return withTx((tx) =>
    runIdempotent(tx, a.user.id, key, `admin:adjust:${itemId}`, async () => {
      const item0 = await tx.pantryItem.findUnique({ where: { id: itemId } });
      if (!item0) throw new DomainError("NOT_FOUND", "Pantry item not found.");
      // Lock order (D-28): affected plans first, then the item.
      const affected = await tx.pantryAllocation.findMany({
        where: { pantryItemId: itemId, status: "ACTIVE" },
        include: { plan: { include: { slot: true } } },
      });
      const planIds = [...new Set(affected.map((x) => x.planId))].sort();
      for (const pid of planIds) await lockPlan(tx, pid);
      await tx.$queryRaw`SELECT id FROM "PantryItem" WHERE id = ${itemId}::uuid FOR UPDATE`;
      const item = await tx.pantryItem.findUniqueOrThrow({ where: { id: itemId } });

      let delta: number;
      if (input.mode === "CORRECTION") {
        delta = toBase(input.countedQuantity, input.unit, item.unitKind) - item.onHandQty;
      } else {
        const sign = input.quantity < 0 ? -1 : 1;
        delta = sign * toBase(Math.abs(input.quantity), input.unit, item.unitKind);
        if (input.mode === "RECEIPT" && delta < 0) throw new DomainError("VALIDATION_ERROR", "Receipts must be positive.", { fieldErrors: { quantity: ["Must be > 0"] } });
      }
      if (delta === 0) throw new DomainError("VALIDATION_ERROR", "No change in quantity.", { fieldErrors: { quantity: ["No change"] } });
      const newOnHand = item.onHandQty + delta;
      if (newOnHand < 0) throw new DomainError("VALIDATION_ERROR", "Stock cannot go below zero.", { fieldErrors: { quantity: ["Below zero"] } });

      if (newOnHand < item.reservedQty) {
        const deficit = item.reservedQty - newOnHand;
        const meals = [...new Map(affected.map((x) => [x.planId, `${x.plan.dishName} (${x.plan.slot.date.toISOString().slice(0, 10)} ${x.plan.slot.period.toLowerCase()})`])).values()];
        if (!input.acknowledgeConflicts) {
          throw new DomainError("RESERVATION_CONFLICT", `This leaves ${formatQty(deficit, item.displayUnit)} less than is reserved for upcoming meals.`, { affected: meals });
        }
        // D-20: trim latest meals first.
        const byLatest = [...affected].sort((x, y) => y.plan.slot.date.getTime() - x.plan.slot.date.getTime());
        let left = deficit;
        for (const al of byLatest) {
          if (left <= 0) break;
          const take = Math.min(al.quantity, left);
          left -= await trimAllocations(tx, al.planIngredientId, take, `Stock correction: ${input.reason}`, a.user.id);
        }
      }
      const type = input.mode === "RECEIPT" ? "RECEIPT" : input.mode === "CORRECTION" ? "CORRECTION" : "ADJUSTMENT";
      const after = await changeOnHand(tx, itemId, delta, 0, type, input.reason, a.user.id);
      await audit(tx, a.user.id, `pantry.${type.toLowerCase()}`, "PantryItem", itemId, { delta, reason: input.reason, after });
      return { status: 201, body: { onHand: formatQty(after.onHandQty, item.displayUnit), reserved: formatQty(after.reservedQty, item.displayUnit) } };
    }),
  );
}

export async function itemTransactions(itemId: string) {
  const item = await prisma.pantryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new DomainError("NOT_FOUND", "Pantry item not found.");
  const rows = await prisma.inventoryTransaction.findMany({ where: { pantryItemId: itemId }, orderBy: { createdAt: "desc" }, take: 200 });
  return {
    item: { id: item.id, name: item.name, displayUnit: item.displayUnit },
    transactions: rows.map((r) => ({
      id: r.id,
      type: r.type,
      deltaOnHand: formatQty(r.deltaOnHand, item.displayUnit),
      deltaReserved: formatQty(r.deltaReserved, item.displayUnit),
      onHandAfter: formatQty(r.onHandAfter, item.displayUnit),
      reservedAfter: formatQty(r.reservedAfter, item.displayUnit),
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function listIncomingGroceries() {
  const lines = await prisma.groceryLine.findMany({
    where: { status: "PROMISED" },
    include: { planIngredient: { include: { pantryItem: true, plan: { include: { slot: true } } } }, commitment: { include: { user: { select: { displayName: true } }, organization: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return lines.map((l) => ({
    id: l.id,
    item: l.planIngredient.pantryItem.name,
    unit: l.planIngredient.pantryItem.displayUnit,
    units: UNITS_BY_KIND[l.planIngredient.pantryItem.unitKind],
    quantity: formatQty(l.quantity, l.planIngredient.pantryItem.displayUnit),
    meal: `${l.planIngredient.plan.dishName}, ${l.planIngredient.plan.slot.date.toISOString().slice(0, 10)} ${l.planIngredient.plan.slot.period.toLowerCase()}`,
    donor: l.commitment.organization ? `${l.commitment.user.displayName} (${l.commitment.organization.name})` : l.commitment.user.displayName,
  }));
}

/** D-18: receipt raises on-hand AND reserves it for the pledged meal in one transaction. */
export async function receiveGrocery(a: Admin, lineId: string, received: { quantity: number; unit: string }, key: string) {
  const l0 = await prisma.groceryLine.findUnique({ where: { id: lineId }, include: { planIngredient: true } });
  if (!l0) throw new DomainError("NOT_FOUND", "Grocery pledge not found.");
  const planId = l0.planIngredient.planId;
  return withTx((tx) =>
    runIdempotent(tx, a.user.id, key, `admin:receive:${lineId}`, async () => {
      await lockPlan(tx, planId);
      const line = await tx.groceryLine.findUniqueOrThrow({ where: { id: lineId }, include: { planIngredient: { include: { pantryItem: true } } } });
      if (line.status !== "PROMISED") throw new DomainError("VALIDATION_ERROR", "This pledge is no longer outstanding.");
      const item = line.planIngredient.pantryItem;
      const qty = toBase(received.quantity, received.unit, item.unitKind);
      await tx.groceryLine.update({ where: { id: lineId }, data: { status: "RECEIVED", receivedQty: qty, receivedAt: new Date() } });
      if (qty > 0) {
        // Only the pledged amount is earmarked for the meal; any surplus becomes general stock.
        const reserve = Math.min(qty, line.quantity);
        await changeOnHand(tx, item.id, qty, reserve, "GROCERY_RECEIPT", `Donation received for meal`, a.user.id, planId);
        await tx.pantryAllocation.create({
          data: { planId, planIngredientId: line.planIngredientId, pantryItemId: item.id, quantity: reserve, source: "GROCERY_RECEIPT", createdById: a.user.id },
        });
      }
      await audit(tx, a.user.id, "grocery.receive", "GroceryLine", lineId, { promised: line.quantity, received: qty });
      return { status: 200, body: { ok: true } };
    }),
  );
}
