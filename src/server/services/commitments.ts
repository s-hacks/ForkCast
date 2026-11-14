/**
 * Volunteer commitments. Every mutation: lock plan row -> recompute availability ->
 * validate against fresh capacity -> write + audit -> return fresh detail (D-28, FR-22).
 */
import "server-only";
import { prisma, withTx, type Tx } from "../db/client";
import { DomainError } from "../domain/errors";
import { toBase, formatQty } from "../domain/units";
import { demand } from "../domain/availability";
import type { VolunteerSession } from "../auth/guards";
import { audit, runIdempotent } from "./platform";
import { getPlanState, livePlanIdForSlot, lockPlan, mealDetail, type PlanState, type Viewer } from "./meals";
import { trimAllocations, tryReserve, releaseReserved } from "./stock";
import { Prisma } from "@/generated/prisma/client";

export function viewerOf(s: VolunteerSession | { user: { id: string; role: "USER" | "ADMIN" }; context: Viewer["context"] }): Viewer {
  return { userId: s.user.id, role: s.user.role, context: s.context };
}

/** Re-validate organization membership at commit time (FR-09). */
async function contextFields(tx: Tx, s: VolunteerSession) {
  if (s.context.type === "SOLO") return { contextType: "SOLO" as const, organizationId: null };
  const m = await tx.organizationMembership.findUnique({ where: { userId_organizationId: { userId: s.user.id, organizationId: s.context.organizationId } } });
  if (!m) throw new DomainError("ORG_NOT_AUTHORIZED", "You are no longer a member of this organization.");
  return { contextType: "ORGANIZATION" as const, organizationId: s.context.organizationId };
}

function assertBookable(st: PlanState) {
  if (st.plan.status !== "PUBLISHED") throw new DomainError("PLAN_NOT_BOOKABLE", "This meal is not open for booking.");
  if (!st.result.bookable) throw new DomainError("SLOT_CLOSED", "This meal has already started; bookings are closed.");
}

async function freshDetail(tx: Tx, planId: string, s: VolunteerSession) {
  return mealDetail(tx, planId, viewerOf(s));
}

async function capacityError(tx: Tx, planId: string, s: VolunteerSession, message: string): Promise<never> {
  const availability = await freshDetail(tx, planId, s);
  throw new DomainError("CAPACITY_EXCEEDED", message, { availability });
}

function uniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** Generic wrapper: tx + idempotency + plan lock. */
async function mutate<T>(s: VolunteerSession, key: string, route: string, slotIdOrPlan: { slotId?: string; planId?: string }, fn: (tx: Tx, planId: string) => Promise<T>) {
  try {
    return await withTx(async (tx) =>
      runIdempotent(tx, s.user.id, key, route, async () => {
        const planId = slotIdOrPlan.planId ?? (await livePlanIdForSlot(tx, slotIdOrPlan.slotId!, viewerOf(s)));
        await lockPlan(tx, planId);
        const body = await fn(tx, planId);
        return { status: 201, body };
      }),
    );
  } catch (e) {
    if (uniqueViolation(e)) throw new DomainError("DUPLICATE_COMMITMENT", "You already have this kind of commitment for this meal. Modify it from My Commitments instead.");
    throw e;
  }
}

/** D-03: after K shrinks, trim reservations exceeding D_i - g_i. */
async function trimExcessReservations(tx: Tx, planId: string, actorId: string) {
  const st = await getPlanState(tx, planId);
  for (const l of st.result.ingredients.lines) {
    const allowed = Math.max(0, l.required - l.pledged);
    if (l.reserved > allowed) await trimAllocations(tx, l.ingredientId, l.reserved - allowed, "Demand reduced by prepared food (D-03)", actorId);
  }
}

// ---------------- Prepared food ----------------
export async function commitPrepared(s: VolunteerSession, slotId: string, servings: number, key: string) {
  return mutate(s, key, `prepared:${slotId}`, { slotId }, async (tx, planId) => {
    const st = await getPlanState(tx, planId);
    assertBookable(st);
    const ctx = await contextFields(tx, s);
    if (servings > st.result.prepared.remaining) {
      await capacityError(tx, planId, s, `Only ${st.result.prepared.remaining} prepared servings can still be committed.`);
    }
    const c = await tx.commitment.create({ data: { planId, userId: s.user.id, ...ctx, type: "PREPARED_FOOD", servings } });
    await audit(tx, s.user.id, "commitment.prepared.create", "Commitment", c.id, { planId, servings, ...ctx });
    await trimExcessReservations(tx, planId, s.user.id);
    return { commitmentId: c.id, availability: await freshDetail(tx, planId, s) };
  });
}

// ---------------- Groceries (D-04, D-06) ----------------
export async function commitGroceries(s: VolunteerSession, slotId: string, lines: { ingredientId: string; quantity: number; unit: string }[], key: string) {
  return mutate(s, key, `groceries:${slotId}`, { slotId }, async (tx, planId) => {
    let st = await getPlanState(tx, planId);
    assertBookable(st);
    const ctx = await contextFields(tx, s);
    const wanted = new Map<string, number>();
    for (const l of lines) {
      const ing = st.ingredients.find((i) => i.id === l.ingredientId && !i.removedAt);
      if (!ing) throw new DomainError("VALIDATION_ERROR", "Unknown ingredient for this meal.", { fieldErrors: { lines: ["Unknown ingredient"] } });
      const base = toBase(l.quantity, l.unit, ing.pantryItem.unitKind);
      if (base <= 0) throw new DomainError("VALIDATION_ERROR", "Quantities must be greater than zero.", { fieldErrors: { lines: ["Must be > 0"] } });
      wanted.set(ing.id, (wanted.get(ing.id) ?? 0) + base);
    }
    if (wanted.size === 0) throw new DomainError("VALIDATION_ERROR", "Select at least one ingredient.", { fieldErrors: { lines: ["Required"] } });

    // D-04: reserve pantry-coverable stock first (ascending pantry item id = lock order).
    await reservePantryCoverable(tx, st, s.user.id, null);
    st = await getPlanState(tx, planId);
    for (const [ingId, base] of wanted) {
      const line = st.result.ingredients.lines.find((l) => l.ingredientId === ingId)!;
      const ingUnit = st.ingredients.find((i) => i.id === ingId)!.pantryItem.unitKind;
      // Unit conversion rounds to integer base units (1 lb = 453.59 g -> 454 g, 2 lb -> 907 g), so
      // "1 lb of a 2 lb need with 1 lb in the pantry" overshoots the shortage by 1 g. Treat an overshoot of
      // at most 1 base unit on a measured item as exact and clamp it, so coverage never exceeds demand.
      if (ingUnit !== "COUNT" && base > line.shortage && base - line.shortage <= 1 && line.shortage > 0) {
        wanted.set(ingId, line.shortage);
        continue;
      }
      if (base > line.shortage) {
        const ing = st.ingredients.find((i) => i.id === ingId)!;
        await capacityError(tx, planId, s, `${ing.pantryItem.name}: only ${formatQty(line.shortage, ing.pantryItem.displayUnit)} is still needed.`);
      }
    }
    const c = await tx.commitment.create({
      data: { planId, userId: s.user.id, ...ctx, type: "GROCERY", groceryLines: { create: [...wanted].map(([planIngredientId, quantity]) => ({ planIngredientId, quantity })) } },
    });
    await audit(tx, s.user.id, "commitment.grocery.create", "Commitment", c.id, { planId, lines: Object.fromEntries(wanted), ...ctx });
    return { commitmentId: c.id, availability: await freshDetail(tx, planId, s) };
  });
}

/** Reserve min(pantryCanCover, available) per live line. Partial reservations allowed (D-04). */
async function reservePantryCoverable(tx: Tx, st: PlanState, actorId: string, commitmentId: string | null) {
  const targets = st.result.ingredients.lines
    .filter((l) => l.pantryCanCover > 0)
    .map((l) => ({ l, ing: st.ingredients.find((i) => i.id === l.ingredientId)! }))
    .sort((a, b) => a.ing.pantryItemId.localeCompare(b.ing.pantryItemId));
  let reservedAny = false;
  for (const { l, ing } of targets) {
    let qty = l.pantryCanCover;
    // Another meal may have reserved in between; fall back to what is actually free.
    if (!(await tryReserve(tx, ing.pantryItemId, qty, `Reserved for ${st.plan.dishName} ${st.date}`, actorId, st.plan.id))) {
      const item = await tx.pantryItem.findUniqueOrThrow({ where: { id: ing.pantryItemId } });
      qty = Math.min(qty, item.onHandQty - item.reservedQty);
      if (qty <= 0 || !(await tryReserve(tx, ing.pantryItemId, qty, `Reserved for ${st.plan.dishName} ${st.date}`, actorId, st.plan.id))) continue;
    }
    await tx.pantryAllocation.create({
      data: { planId: st.plan.id, planIngredientId: ing.id, pantryItemId: ing.pantryItemId, quantity: qty, source: commitmentId ? "USE_PANTRY" : "PLAN_AUTO", commitmentId, createdById: actorId },
    });
    reservedAny = true;
  }
  return reservedAny;
}

// ---------------- Use pantry (D-05) ----------------
export async function usePantry(s: VolunteerSession, slotId: string, key: string) {
  return mutate(s, key, `pantry:${slotId}`, { slotId }, async (tx, planId) => {
    const st = await getPlanState(tx, planId);
    assertBookable(st);
    const ctx = await contextFields(tx, s);
    const lines = st.result.ingredients.lines.filter((l) => l.required > 0);
    if (lines.length === 0 || st.result.ingredients.status === "FULL" || st.result.kitchenServings === 0) {
      throw new DomainError("PANTRY_INSUFFICIENT", "No ingredient demand is open for this meal.", { availability: await freshDetail(tx, planId, s) });
    }
    const short = lines.filter((l) => l.shortage > 0);
    if (short.length > 0) {
      throw new DomainError("PANTRY_INSUFFICIENT", "The pantry cannot cover every ingredient. Bring groceries for the shortages instead.", {
        availability: await freshDetail(tx, planId, s),
      });
    }
    const c = await tx.commitment.create({ data: { planId, userId: s.user.id, ...ctx, type: "PANTRY" } });
    await reservePantryCoverable(tx, st, s.user.id, c.id);
    const after = await getPlanState(tx, planId);
    if (after.result.ingredients.lines.some((l) => l.required > l.covered)) {
      // Stock moved under us: roll back the whole transaction rather than claim a false allocation.
      throw new DomainError("PANTRY_INSUFFICIENT", "Pantry stock changed while confirming. Please review the shortages.", {});
    }
    await audit(tx, s.user.id, "commitment.pantry.create", "Commitment", c.id, { planId, ...ctx });
    return { commitmentId: c.id, availability: await freshDetail(tx, planId, s) };
  });
}

// ---------------- Serving (D-10) ----------------
export async function bookServing(s: VolunteerSession, slotId: string, key: string) {
  return mutate(s, key, `serving:${slotId}`, { slotId }, async (tx, planId) => {
    const st = await getPlanState(tx, planId);
    assertBookable(st);
    const ctx = await contextFields(tx, s);
    if (st.result.serving.remaining <= 0) await capacityError(tx, planId, s, "The serving assignment for this meal is already taken.");
    const c = await tx.commitment.create({ data: { planId, userId: s.user.id, ...ctx, type: "SERVING" } });
    await audit(tx, s.user.id, "commitment.serving.create", "Commitment", c.id, { planId, ...ctx });
    return { commitmentId: c.id, availability: await freshDetail(tx, planId, s) };
  });
}

// ---------------- Modify / cancel (D-13) ----------------
async function ownCommitment(tx: Tx, s: VolunteerSession, id: string) {
  const c = await tx.commitment.findUnique({ where: { id } });
  if (!c) throw new DomainError("NOT_FOUND", "Commitment not found.");
  if (c.userId !== s.user.id) throw new DomainError("NOT_OWNER", "You can only change your own commitments.");
  return c;
}

export async function modifyPrepared(s: VolunteerSession, commitmentId: string, servings: number, key: string) {
  const c0 = await prisma.commitment.findUnique({ where: { id: commitmentId }, select: { planId: true } });
  if (!c0) throw new DomainError("NOT_FOUND", "Commitment not found.");
  return mutate(s, key, `modify:${commitmentId}`, { planId: c0.planId }, async (tx, planId) => {
    const c = await ownCommitment(tx, s, commitmentId);
    if (c.type !== "PREPARED_FOOD" || c.status !== "ACTIVE") throw new DomainError("VALIDATION_ERROR", "Only active prepared-food commitments can change servings.");
    const st = await getPlanState(tx, planId);
    if (!st.result.bookable) throw new DomainError("SLOT_CLOSED", "This meal has already started.");
    const max = st.result.prepared.remaining + (c.servings ?? 0);
    if (servings > max) await capacityError(tx, planId, s, `You can commit at most ${max} servings.`);
    await tx.commitment.update({ where: { id: c.id }, data: { servings } });
    await audit(tx, s.user.id, "commitment.prepared.modify", "Commitment", c.id, { from: c.servings, to: servings });
    await trimExcessReservations(tx, planId, s.user.id);
    return { commitmentId: c.id, availability: await freshDetail(tx, planId, s) };
  });
}

export async function cancelCommitment(s: VolunteerSession, commitmentId: string, key: string) {
  const c0 = await prisma.commitment.findUnique({ where: { id: commitmentId }, select: { planId: true } });
  if (!c0) throw new DomainError("NOT_FOUND", "Commitment not found.");
  return mutate(s, key, `cancel:${commitmentId}`, { planId: c0.planId }, async (tx, planId) => {
    const c = await ownCommitment(tx, s, commitmentId);
    if (c.status !== "ACTIVE") throw new DomainError("VALIDATION_ERROR", "This commitment is already cancelled.");
    const st = await getPlanState(tx, planId);
    if (st.startsAt.getTime() <= Date.now()) throw new DomainError("SLOT_CLOSED", "This meal has already started; it can no longer be cancelled.");
    await cancelInTx(tx, c.id, s.user.id, "Cancelled by volunteer");
    return { commitmentId: c.id, availability: await freshDetail(tx, planId, s) };
  });
}

/** Shared by volunteer cancel and admin plan cancel. History rows are kept, never deleted. */
export async function cancelInTx(tx: Tx, commitmentId: string, actorId: string, reason: string) {
  const c = await tx.commitment.update({ where: { id: commitmentId }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  if (c.type === "GROCERY") await tx.groceryLine.updateMany({ where: { commitmentId, status: "PROMISED" }, data: { status: "CANCELLED" } });
  if (c.type === "PANTRY") {
    const allocs = await tx.pantryAllocation.findMany({ where: { commitmentId, status: "ACTIVE" }, orderBy: { pantryItemId: "asc" } });
    for (const a of allocs) {
      await tx.pantryAllocation.update({ where: { id: a.id }, data: { status: "RELEASED" } });
      await releaseReserved(tx, a.pantryItemId, a.quantity, reason, actorId, a.planId);
    }
  }
  await audit(tx, actorId, "commitment.cancel", "Commitment", commitmentId, { type: c.type, reason });
}

export { demand };
