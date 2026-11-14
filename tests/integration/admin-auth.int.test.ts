/** Admin operations, inventory integrity, auth and authorization (Tests 1, 12, 13, 16). */
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { addDays } from "@/server/domain/dates";
import { adjustStock, cancelPlan, createPantryItem, markServed, receiveGrocery, updatePlan } from "@/server/services/admin";
import { commitGroceries, commitPrepared, usePantry } from "@/server/services/commitments";
import { getPlanState, livePlanIdForSlot, mealDetail } from "@/server/services/meals";
import { login } from "@/server/auth/session";
import { assertAdmin, assertVolunteer } from "@/server/auth/guards";
import { runIdempotent } from "@/server/services/platform";
import { withTx } from "@/server/db/client";
import { adminSession, assertLedger, expectCode, key, reseed, scenarioTuesday, slotId, volunteer } from "./helpers";

const T = scenarioTuesday();
const A = { userId: "x", role: "ADMIN" as const, context: null };
const planOf = async (slot: string) => livePlanIdForSlot(prisma, slot, A);

beforeEach(() => reseed());

describe("meal plan edits (D-14)", () => {
  it("blocks lowering servings below committed, override flags CONFLICTED without deleting", async () => {
    const slot = await slotId(T, "LUNCH");
    const r = await commitPrepared(await volunteer("sam"), slot, 100, key());
    const planId = await planOf(slot);
    const admin = await adminSession();
    const st = await getPlanState(prisma, planId);
    const ingredients = st.ingredients.map((i) => ({ pantryItemId: i.pantryItemId, quantity: i.quantity, unit: "g" }));
    const input = { dishName: "Chili", servingsTarget: 80, recipeYield: 120, serviceCapacity: 1, ingredients, version: st.plan.version };
    const err = await expectCode(updatePlan(admin, planId, input, key()), "PLAN_CONFLICT");
    expect((err.extras.conflicts as { kind: string }[])[0].kind).toBe("SERVINGS_BELOW_PREPARED");
    const ok = await updatePlan(admin, planId, { ...input, acknowledgeConflicts: true }, key());
    expect(ok.body.detail.status).toBe("CONFLICTED");
    expect(await prisma.commitment.findUnique({ where: { id: r.body.commitmentId } })).toMatchObject({ status: "ACTIVE", servings: 100 });
    // stale version is rejected
    await expectCode(updatePlan(admin, planId, { ...input, servingsTarget: 150 }, key()), "VERSION_CONFLICT");
  });

  it("increasing servings reopens capacity and is visible to volunteers (Test 12)", async () => {
    const slot = await slotId(addDays(T, 2), "DINNER"); // fully covered scenario, prepared-only 100
    const planId = await planOf(slot);
    const st = await getPlanState(prisma, planId);
    expect(st.result.status).toBe("FULL");
    await updatePlan(await adminSession(), planId, { dishName: st.plan.dishName, servingsTarget: 150, recipeYield: 150, serviceCapacity: 1, ingredients: [], version: st.plan.version }, key());
    const sam = await volunteer("sam");
    const v = await mealDetail(prisma, planId, { userId: sam.user.id, role: "USER", context: sam.context });
    expect(v.prepared.remaining).toBe(50);
    expect(v.status).toBe("PARTIAL");
  });

  it("cancelling a plan with commitments needs acknowledgement and releases reservations", async () => {
    const pasta = await slotId(addDays(T, 1), "LUNCH");
    await usePantry(await volunteer("sam"), pasta, key());
    const planId = await planOf(pasta);
    const admin = await adminSession();
    await expectCode(cancelPlan(admin, planId, false, key()), "PLAN_CONFLICT");
    await cancelPlan(admin, planId, true, key());
    expect((await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Marinara sauce" } })).reservedQty).toBe(0);
    expect(await prisma.commitment.count({ where: { planId, status: "CANCELLED" } })).toBe(1);
    await assertLedger();
  });
});

describe("inventory (D-17..D-20)", () => {
  it("receipts and corrections are audited in the ledger", async () => {
    const admin = await adminSession();
    const onions = await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Onions" } });
    await adjustStock(admin, onions.id, { mode: "RECEIPT", quantity: 5, unit: "kg", reason: "Food bank delivery" }, key());
    await adjustStock(admin, onions.id, { mode: "CORRECTION", countedQuantity: 4.5, unit: "kg", reason: "Recount" }, key());
    expect((await prisma.pantryItem.findUniqueOrThrow({ where: { id: onions.id } })).onHandQty).toBe(4500);
    expect(await prisma.inventoryTransaction.count({ where: { pantryItemId: onions.id } })).toBe(2);
    await expectCode(adjustStock(admin, onions.id, { mode: "RECEIPT", quantity: 1, unit: "l", reason: "x" }, key()), "UNIT_INCOMPATIBLE");
    await assertLedger();
  });

  it("correction below reservations warns, override trims allocations", async () => {
    const pasta = await slotId(addDays(T, 1), "LUNCH");
    await usePantry(await volunteer("sam"), pasta, key());
    const admin = await adminSession();
    const sauce = await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Marinara sauce" } });
    await expectCode(adjustStock(admin, sauce.id, { mode: "CORRECTION", countedQuantity: 10, unit: "l", reason: "Spoiled" }, key()), "RESERVATION_CONFLICT");
    await adjustStock(admin, sauce.id, { mode: "CORRECTION", countedQuantity: 10, unit: "l", reason: "Spoiled", acknowledgeConflicts: true }, key());
    const after = await prisma.pantryItem.findUniqueOrThrow({ where: { id: sauce.id } });
    expect(after).toMatchObject({ onHandQty: 10000, reservedQty: 10000 });
    const st = await getPlanState(prisma, await planOf(pasta));
    expect(st.result.ingredients.status).toBe("PARTIAL");
    await assertLedger();
  });

  it("grocery receipt adds stock and reserves it; served consumes once (D-18, D-19)", async () => {
    const chili = await slotId(T, "DINNER");
    const planId = await planOf(chili);
    const st = await getPlanState(prisma, planId);
    const onionsLine = st.ingredients.find((i) => i.pantryItem.name === "Onions")!;
    await commitGroceries(await volunteer("sam"), chili, [{ ingredientId: onionsLine.id, quantity: 4, unit: "kg" }], key());
    const line = await prisma.groceryLine.findFirstOrThrow({ where: { planIngredientId: onionsLine.id } });
    const admin = await adminSession();
    await receiveGrocery(admin, line.id, { quantity: 4, unit: "kg" }, key());
    const onions = await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Onions" } });
    expect(onions).toMatchObject({ onHandQty: 4000, reservedQty: 4000 });
    const after = await getPlanState(prisma, planId);
    expect(after.result.ingredients.lines.find((l) => l.ingredientId === onionsLine.id)).toMatchObject({ reserved: 4000, pledged: 0, shortage: 0 });
    await markServed(admin, planId, key()).catch(() => undefined); // may be before start; served allowed any time for published plan
    const consumed = await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Onions" } });
    expect(consumed).toMatchObject({ onHandQty: 0, reservedQty: 0 });
    await assertLedger();
  });

  it("new pantry items reject a unit of the wrong kind", async () => {
    await expectCode(createPantryItem(await adminSession(), { name: "Rice", unitKind: "MASS", displayUnit: "l" }, key()), "UNIT_INCOMPATIBLE");
    await createPantryItem(await adminSession(), { name: "Rice", unitKind: "MASS", displayUnit: "lb", initialQuantity: 10 }, key());
    expect((await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Rice" } })).onHandQty).toBe(4536);
  });
});

describe("authentication and authorization (Tests 1, 13)", () => {
  it("logs in with correct credentials and rejects wrong portal/password generically", async () => {
    const ok = await login("Maria", process.env.SEED_USER_PASSWORD!, "user", "1.1.1.1");
    expect(ok.user.username).toBe("maria");
    expect(await prisma.session.count()).toBe(1);
    const e1 = await expectCode(login("maria", "wrong", "user", "1.1.1.1"), "INVALID_CREDENTIALS");
    const e2 = await expectCode(login("nobody", "wrong", "user", "1.1.1.1"), "INVALID_CREDENTIALS");
    const e3 = await expectCode(login("maria", process.env.SEED_USER_PASSWORD!, "admin", "1.1.1.1"), "INVALID_CREDENTIALS");
    expect(new Set([e1.message, e2.message, e3.message]).size).toBe(1);
    const stored = await prisma.user.findUniqueOrThrow({ where: { username: "maria" } });
    expect(stored.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("throttles repeated failures per username", async () => {
    for (let i = 0; i < 5; i++) await expectCode(login("james", "bad", "user", `10.0.0.${i}`), "INVALID_CREDENTIALS");
    await expectCode(login("james", process.env.SEED_USER_PASSWORD!, "user", "10.0.0.99"), "TOO_MANY_ATTEMPTS");
  });

  it("server guards deny regular users admin operations and admins volunteer operations", async () => {
    const sam = await volunteer("sam");
    expect(() => assertAdmin(sam)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    const admin = await adminSession();
    expect(() => assertVolunteer({ ...admin, context: { type: "SOLO" } })).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => assertVolunteer({ ...sam, context: null })).toThrow(expect.objectContaining({ code: "CONTEXT_REQUIRED" }));
    expect(() => assertAdmin(null)).toThrow(expect.objectContaining({ code: "UNAUTHENTICATED" }));
  });
});

describe("idempotency and persistence (FR-39, Test 16)", () => {
  it("rejects a key reused on a different route", async () => {
    const sam = await volunteer("sam");
    const k = key();
    await withTx((tx) => runIdempotent(tx, sam.user.id, k, "a", async () => ({ status: 201, body: { ok: 1 } })));
    await expectCode(withTx((tx) => runIdempotent(tx, sam.user.id, k, "b", async () => ({ status: 201, body: { ok: 2 } }))), "IDEMPOTENCY_KEY_REUSED");
  });

  it("failed mutations leave no audit row or idempotency record", async () => {
    const slot = await slotId(T, "LUNCH");
    const sam = await volunteer("sam");
    const k = key();
    const before = await prisma.auditLog.count();
    await expectCode(commitPrepared(sam, slot, 999, k), "CAPACITY_EXCEEDED");
    expect(await prisma.auditLog.count()).toBe(before);
    expect(await prisma.idempotencyRecord.count({ where: { key: k } })).toBe(0);
  });

  it("commitments persist across a new database connection", async () => {
    const slot = await slotId(T, "LUNCH");
    await commitPrepared(await volunteer("sam"), slot, 30, key());
    const { PrismaClient } = await import("@/generated/prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const fresh = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
    expect(await fresh.commitment.count({ where: { type: "PREPARED_FOOD", servings: 30 } })).toBe(1);
    await fresh.$disconnect();
  });
});
