/**
 * Booking flows against real PostgreSQL (firehouse_test). Maps to brief Tests 4-11, 14, 15
 * and OpenSpec capabilities prepared-food-commitments, ingredient-planning, serving-assignments.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/client";
import { addDays } from "@/server/domain/dates";
import { bookServing, cancelCommitment, commitGroceries, commitPrepared, modifyPrepared, usePantry } from "@/server/services/commitments";
import { getPlanState, livePlanIdForSlot, mealDetail } from "@/server/services/meals";
import { assertLedger, expectCode, key, reseed, scenarioTuesday, slotId, volunteer } from "./helpers";

const T = scenarioTuesday();
const viewerAdmin = { userId: "00000000-0000-0000-0000-000000000000", role: "ADMIN" as const, context: null };
async function state(slot: string) {
  return getPlanState(prisma, await livePlanIdForSlot(prisma, slot, viewerAdmin));
}

beforeEach(() => reseed());

describe("prepared food (Tests 4-6)", () => {
  it("full 120/120 commitment turns the prepared lane gray and blocks more", async () => {
    const slot = await slotId(T, "LUNCH");
    const sam = await volunteer("sam");
    const r = await commitPrepared(sam, slot, 120, key());
    expect(r.status).toBe(201);
    expect(r.body.availability.prepared).toMatchObject({ status: "FULL", committed: 120, remaining: 0 });
    expect(r.body.availability.ingredients.status).toBe("NOT_NEEDED");
    await expectCode(commitPrepared(await volunteer("james"), slot, 1, key()), "CAPACITY_EXCEEDED");
  });

  it("partial 60 is yellow, a second user completes it", async () => {
    const slot = await slotId(T, "LUNCH");
    const r1 = await commitPrepared(await volunteer("sam"), slot, 60, key());
    expect(r1.body.availability.prepared).toMatchObject({ status: "PARTIAL", remaining: 60 });
    expect(r1.body.availability.status).toBe("PARTIAL");
    await expectCode(commitPrepared(await volunteer("james"), slot, 61, key()), "CAPACITY_EXCEEDED");
    const r2 = await commitPrepared(await volunteer("james"), slot, 60, key());
    expect(r2.body.availability.prepared).toMatchObject({ status: "FULL", committed: 120 });
  });

  it("rejects duplicate active commitment per user and replays idempotent requests", async () => {
    const slot = await slotId(T, "LUNCH");
    const sam = await volunteer("sam");
    const k = key();
    const a = await commitPrepared(sam, slot, 10, k);
    const b = await commitPrepared(sam, slot, 10, k);
    expect(b.replayed).toBe(true);
    expect(b.body.commitmentId).toBe(a.body.commitmentId);
    expect(await prisma.commitment.count({ where: { userId: sam.user.id, status: "ACTIVE", type: "PREPARED_FOOD" } })).toBe(1);
    await expectCode(commitPrepared(sam, slot, 5, key()), "DUPLICATE_COMMITMENT");
  });

  it("concurrent requests for the last 60 servings: exactly one succeeds (Test 14)", async () => {
    const slot = await slotId(T, "LUNCH");
    await commitPrepared(await volunteer("sam"), slot, 60, key());
    const results = await Promise.allSettled([commitPrepared(await volunteer("james"), slot, 60, key()), commitPrepared(await volunteer("aisha"), slot, 60, key())]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason.code).toBe("CAPACITY_EXCEEDED");
    const st = await state(slot);
    expect(st.result.prepared.committed).toBe(120);
  });

  it("modify and cancel restore capacity without deleting history (Test 15)", async () => {
    const slot = await slotId(T, "LUNCH");
    const sam = await volunteer("sam");
    const r = await commitPrepared(sam, slot, 100, key());
    await modifyPrepared(sam, r.body.commitmentId, 40, key());
    expect((await state(slot)).result.prepared.remaining).toBe(80);
    await expectCode(modifyPrepared(sam, r.body.commitmentId, 121, key()), "CAPACITY_EXCEEDED");
    await expectCode(cancelCommitment(await volunteer("james"), r.body.commitmentId, key()), "NOT_OWNER");
    await cancelCommitment(sam, r.body.commitmentId, key());
    expect((await state(slot)).result.prepared).toMatchObject({ committed: 0, remaining: 120, status: "AVAILABLE" });
    expect(await prisma.commitment.findUnique({ where: { id: r.body.commitmentId } })).toMatchObject({ status: "CANCELLED" });
  });
});

describe("groceries and pantry (Tests 7-10)", () => {
  async function chili() {
    const slot = await slotId(T, "DINNER");
    const d = await mealDetail(prisma, await livePlanIdForSlot(prisma, slot, viewerAdmin), viewerAdmin);
    const byName = Object.fromEntries(d.ingredients.lines.map((l) => [l.name, l]));
    return { slot, d, byName };
  }

  it("shows 7 ingredients: 3 coverable by pantry, 4 short", async () => {
    const { d } = await chili();
    expect(d.ingredients.lines).toHaveLength(7);
    expect(d.ingredients.lines.filter((l) => l.shortage.base === 0 && l.pantryCanCover.base === l.required.base)).toHaveLength(3);
    expect(d.ingredients.lines.filter((l) => l.shortage.base > 0).map((l) => l.name).sort()).toEqual(["Bell peppers", "Cornbread mix", "Kidney beans", "Onions"]);
  });

  it("partial grocery pledge reserves pantry stock, stays yellow; full coverage turns gray", async () => {
    const { slot, byName } = await chili();
    const r1 = await commitGroceries(await volunteer("sam"), slot, [
      { ingredientId: byName["Kidney beans"].ingredientId, quantity: 6, unit: "kg" },
      { ingredientId: byName["Onions"].ingredientId, quantity: 4, unit: "kg" },
    ], key());
    const lines = Object.fromEntries(r1.body.availability.ingredients.lines.map((l) => [l.name, l]));
    expect(r1.body.availability.ingredients.status).toBe("PARTIAL");
    expect(lines["Ground beef"].reservedHere.base).toBe(10000); // D-04 auto reservation
    expect(lines["Kidney beans"].pledged.base).toBe(6000);
    expect(lines["Bell peppers"].shortage.base).toBe(3000);
    // Pledged groceries are not physical stock (D-18).
    expect((await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Kidney beans" } })).onHandQty).toBe(0);
    await expectCode(
      commitGroceries(await volunteer("james"), slot, [{ ingredientId: byName["Bell peppers"].ingredientId, quantity: 3.5, unit: "kg" }], key()),
      "CAPACITY_EXCEEDED",
    );
    await expectCode(
      commitGroceries(await volunteer("james"), slot, [{ ingredientId: byName["Bell peppers"].ingredientId, quantity: 3, unit: "l" }], key()),
      "UNIT_INCOMPATIBLE",
    );
    const r2 = await commitGroceries(await volunteer("james"), slot, [
      { ingredientId: byName["Bell peppers"].ingredientId, quantity: 3, unit: "kg" },
      { ingredientId: byName["Cornbread mix"].ingredientId, quantity: 2, unit: "kg" },
    ], key());
    expect(r2.body.availability.ingredients.status).toBe("FULL");
    expect(r2.body.availability.prepared.remaining).toBe(0); // all servings provisioned by the kitchen
    await assertLedger();
  });

  it("cancelling a grocery commitment reopens the shortage", async () => {
    const { slot, byName } = await chili();
    const sam = await volunteer("sam");
    const r = await commitGroceries(sam, slot, [{ ingredientId: byName["Onions"].ingredientId, quantity: 4, unit: "kg" }], key());
    await cancelCommitment(sam, r.body.commitmentId, key());
    const st = await state(slot);
    expect(st.result.ingredients.lines.find((l) => l.ingredientId === byName["Onions"].ingredientId)!.shortage).toBe(4000);
  });

  it("use pantry is all-or-nothing and never double-allocates stock (Test 10)", async () => {
    const pastaSlot = await slotId(addDays(T, 1), "LUNCH");
    const { slot: chiliSlot } = await chili();
    await expectCode(usePantry(await volunteer("sam"), chiliSlot, key()), "PANTRY_INSUFFICIENT");
    const r = await usePantry(await volunteer("sam"), pastaSlot, key());
    expect(r.body.availability.ingredients.status).toBe("FULL");
    const marinara = await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Marinara sauce" } });
    expect(marinara.reservedQty).toBe(12000);
    // A second meal needing 12 L of the same 20 L cannot reserve it again.
    const { createPlan } = await import("@/server/services/admin");
    const { adminSession } = await import("./helpers");
    const admin = await adminSession();
    const sauce = await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Marinara sauce" } });
    const created = await createPlan(admin, {
      date: addDays(T, 6), period: "LUNCH", dishName: "Pasta again", servingsTarget: 100, recipeYield: 100, serviceCapacity: 1,
      ingredients: [{ pantryItemId: sauce.id, quantity: 12, unit: "l" }], publish: true,
    }, key()).catch(async (e) => {
      // slot may already have a seeded filler plan; use a fresh date instead
      if (e.code !== "VERSION_CONFLICT") throw e;
      return createPlan(admin, { date: addDays(T, 20), period: "LUNCH", dishName: "Pasta again", servingsTarget: 100, recipeYield: 100, serviceCapacity: 1, ingredients: [{ pantryItemId: sauce.id, quantity: 12, unit: "l" }], publish: true }, key());
    });
    const d2 = created.body as Awaited<ReturnType<typeof mealDetail>>;
    expect(d2.ingredients.lines[0].pantryCanCover.base).toBe(8000);
    expect(d2.ingredients.lines[0].shortage.base).toBe(4000);
    await expectCode(usePantry(await volunteer("james"), d2.slotId, key()), "PANTRY_INSUFFICIENT");
    await assertLedger();
  });

  it("concurrent pantry reservations for the same stock never over-allocate", async () => {
    const { createPlan } = await import("@/server/services/admin");
    const { adminSession } = await import("./helpers");
    const admin = await adminSession();
    const sauce = await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Marinara sauce" } });
    const mk = (d: string) => createPlan(admin, { date: d, period: "DINNER", dishName: "Sauce", servingsTarget: 10, recipeYield: 10, serviceCapacity: 1, ingredients: [{ pantryItemId: sauce.id, quantity: 15, unit: "l" }], publish: true }, key());
    const a = (await mk(addDays(T, 30))).body as Awaited<ReturnType<typeof mealDetail>>;
    const b = (await mk(addDays(T, 31))).body as Awaited<ReturnType<typeof mealDetail>>;
    const res = await Promise.allSettled([usePantry(await volunteer("sam"), a.slotId, key()), usePantry(await volunteer("james"), b.slotId, key())]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const after = await prisma.pantryItem.findUniqueOrThrow({ where: { id: sauce.id } });
    expect(after.reservedQty).toBeLessThanOrEqual(after.onHandQty);
    expect(after.reservedQty).toBe(15000);
    await assertLedger();
  });

  it("cancelling a pantry commitment releases the reservation", async () => {
    const pastaSlot = await slotId(addDays(T, 1), "LUNCH");
    const sam = await volunteer("sam");
    const r = await usePantry(sam, pastaSlot, key());
    await cancelCommitment(sam, r.body.commitmentId, key());
    expect((await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Marinara sauce" } })).reservedQty).toBe(0);
    await assertLedger();
  });

  it("prepared food after pantry reservations trims them (D-03)", async () => {
    const pastaSlot = await slotId(addDays(T, 1), "LUNCH");
    await usePantry(await volunteer("sam"), pastaSlot, key());
    const r = await commitPrepared(await volunteer("james"), pastaSlot, 50, key());
    expect(r.body.availability.prepared.committed).toBe(50);
    expect((await prisma.pantryItem.findUniqueOrThrow({ where: { name: "Marinara sauce" } })).reservedQty).toBe(6000);
    await assertLedger();
  });
});

describe("serving (Test 11) and visibility (Test 3)", () => {
  it("booking serving fills only the serving lane", async () => {
    const slot = await slotId(T, "LUNCH");
    const r = await bookServing(await volunteer("aisha", "UAB Hospital Volunteers"), slot, key());
    expect(r.body.availability.serving.status).toBe("FULL");
    expect(r.body.availability.prepared.status).toBe("AVAILABLE");
    expect(r.body.availability.ingredients.status).toBe("AVAILABLE");
    expect(r.body.availability.status).toBe("PARTIAL");
    await expectCode(bookServing(await volunteer("sam"), slot, key()), "CAPACITY_EXCEEDED");
  });

  it("organization context sees its own commitments but not another org's", async () => {
    const thuLunch = await slotId(addDays(T, 2), "LUNCH"); // church committed 60
    const planId = await livePlanIdForSlot(prisma, thuLunch, viewerAdmin);
    const maria = await volunteer("maria", "UAB Hospital Volunteers");
    const hospitalView = await mealDetail(prisma, planId, { userId: maria.user.id, role: "USER", context: maria.context });
    expect(hospitalView.organization!.commitments).toHaveLength(0);
    expect(hospitalView.prepared.remaining).toBe(60); // global availability still reduced
    expect(JSON.stringify(hospitalView)).not.toContain("James");
    const mariaChurch = await volunteer("maria", "St. Paul's Church");
    const churchView = await mealDetail(prisma, planId, { userId: mariaChurch.user.id, role: "USER", context: mariaChurch.context });
    expect(churchView.organization!.commitments[0]).toMatchObject({ servings: 60, volunteerName: "James Carter" });
    const solo = await mealDetail(prisma, planId, { userId: (await volunteer("sam")).user.id, role: "USER", context: { type: "SOLO" } });
    expect(solo.organization).toBeUndefined();
    expect(JSON.stringify(solo)).not.toContain("James");
  });

  it("rejects commitments for an organization the user does not belong to", async () => {
    const slot = await slotId(T, "LUNCH");
    const sam = await volunteer("james", "UAB Hospital Volunteers"); // james is not a hospital member
    await expectCode(commitPrepared(sam, slot, 10, key()), "ORG_NOT_AUTHORIZED");
  });

  it("drafts are invisible to volunteers", async () => {
    const draftSlot = await slotId(addDays(T, 5), "LUNCH");
    const sam = await volunteer("sam");
    await expectCode(livePlanIdForSlot(prisma, draftSlot, { userId: sam.user.id, role: "USER", context: sam.context }), "NOT_FOUND");
  });
});
