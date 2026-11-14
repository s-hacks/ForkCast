import { describe, expect, it } from "vitest";
import { computeAvailability, demand, kMinForPledge, type AvailabilityInput } from "@/server/domain/availability";

// Chili seed: 120 servings, 7 lines, 3 fully coverable by pantry, 4 missing (values in grams).
const chiliLines = (over: Partial<Record<string, { reserved?: number; pledged?: number; avail?: number }>> = {}) =>
  [
    ["beef", 10000, 25000],
    ["tomato", 8000, 20000],
    ["chili", 500, 1500],
    ["beans", 6000, 0],
    ["onion", 4000, 0],
    ["pepper", 3000, 0],
    ["cornbread", 2000, 0],
  ].map(([id, q, avail]) => ({
    ingredientId: id as string,
    q: q as number,
    reserved: over[id as string]?.reserved ?? 0,
    pledged: over[id as string]?.pledged ?? 0,
    pantryAvailable: over[id as string]?.avail ?? (avail as number),
  }));

const base = (o: Partial<AvailabilityInput> = {}): AvailabilityInput => ({
  servingsTarget: 120,
  recipeYield: 120,
  serviceCapacity: 1,
  preparedCommitted: 0,
  servingBooked: 0,
  lines: chiliLines(),
  status: "PUBLISHED",
  closed: false,
  ...o,
});

describe("demand scaling (D-01)", () => {
  it("scales with the kitchen portion and rounds up", () => {
    expect(demand(10000, 120, 120)).toBe(10000);
    expect(demand(10000, 60, 120)).toBe(5000);
    expect(demand(7, 50, 120)).toBe(3);
    expect(demand(5, 0, 120)).toBe(0);
  });
  it("kMinForPledge is the exact smallest K keeping a pledge needed", () => {
    for (const [g, q, y] of [[3, 7, 120], [6000, 6000, 120], [1, 500, 120], [2500, 6000, 120]]) {
      const k = kMinForPledge(g, q, y);
      expect(demand(q, k, y)).toBeGreaterThanOrEqual(g);
      expect(demand(q, k - 1, y)).toBeLessThan(g);
    }
  });
});

describe("prepared food lane (scenarios A1/A2)", () => {
  it("is white with full capacity initially", () => {
    const r = computeAvailability(base());
    expect(r.prepared).toMatchObject({ status: "AVAILABLE", capacity: 120, remaining: 120 });
    expect(r.status).toBe("AVAILABLE");
  });
  it("partial 60/120 is yellow with 60 remaining and halves ingredient demand", () => {
    const r = computeAvailability(base({ preparedCommitted: 60 }));
    expect(r.prepared).toMatchObject({ status: "PARTIAL", remaining: 60 });
    expect(r.kitchenServings).toBe(60);
    expect(r.ingredients.lines.find((l) => l.ingredientId === "beef")!.required).toBe(5000);
    expect(r.status).toBe("PARTIAL");
  });
  it("120/120 is gray; ingredients not needed; serving still open keeps slot partial", () => {
    const r = computeAvailability(base({ preparedCommitted: 120 }));
    expect(r.prepared.status).toBe("FULL");
    expect(r.ingredients.status).toBe("NOT_NEEDED");
    expect(r.serving.status).toBe("AVAILABLE");
    expect(r.status).toBe("PARTIAL");
  });
  it("grocery pledges cap prepared capacity (D-02)", () => {
    const r = computeAvailability(base({ lines: chiliLines({ beans: { pledged: 6000 } }) }));
    expect(r.prepared.capacity).toBe(0);
    const r2 = computeAvailability(base({ lines: chiliLines({ beans: { pledged: 3000 } }) }));
    expect(r2.prepared.capacity).toBe(60);
  });
});

describe("ingredient lane (B1/B2)", () => {
  it("identifies 3 pantry-coverable and 4 short lines", () => {
    const r = computeAvailability(base());
    const coverable = r.ingredients.lines.filter((l) => l.pantryCanCover === l.required);
    const short = r.ingredients.lines.filter((l) => l.shortage > 0);
    expect(coverable.map((l) => l.ingredientId)).toEqual(["beef", "tomato", "chili"]);
    expect(short.map((l) => l.ingredientId)).toEqual(["beans", "onion", "pepper", "cornbread"]);
    expect(r.ingredients.status).toBe("AVAILABLE");
  });
  it("quantities matter: partial pantry stock leaves a shortage", () => {
    const r = computeAvailability(base({ lines: chiliLines({ beef: { avail: 2000 } }) }));
    expect(r.ingredients.lines[0]).toMatchObject({ pantryCanCover: 2000, shortage: 8000 });
  });
  it("partial grocery coverage is yellow, full is gray", () => {
    const reservedPantry = { beef: { reserved: 10000 }, tomato: { reserved: 8000 }, chili: { reserved: 500 } };
    const partial = computeAvailability(base({ lines: chiliLines({ ...reservedPantry, beans: { pledged: 6000 }, onion: { pledged: 4000 } }) }));
    expect(partial.ingredients.status).toBe("PARTIAL");
    const full = computeAvailability(
      base({ lines: chiliLines({ ...reservedPantry, beans: { pledged: 6000 }, onion: { pledged: 4000 }, pepper: { pledged: 3000 }, cornbread: { pledged: 2000 } }) }),
    );
    expect(full.ingredients.status).toBe("FULL");
    expect(full.coveredServings).toBe(120);
    // Food covered but serving open -> not FULL overall (independent lanes, D-07).
    expect(full.status).toBe("PARTIAL");
    expect(computeAvailability({ ...base(), lines: full.ingredients.lines.map((l) => ({ ingredientId: l.ingredientId, q: l.required, reserved: l.reserved, pledged: l.pledged, pantryAvailable: 0 })), servingBooked: 1 }).status).toBe("FULL");
  });
  it("over-coverage after an admin edit is CONFLICTED (D-14)", () => {
    const r = computeAvailability(base({ servingsTarget: 60, recipeYield: 120, lines: chiliLines({ beans: { pledged: 6000 } }) }));
    expect(r.ingredients.status).toBe("CONFLICTED");
    expect(r.status).toBe("CONFLICTED");
  });
  it("removed line with coverage is CONFLICTED (D-15)", () => {
    const lines = chiliLines({ beans: { pledged: 1000 } }).map((l) => (l.ingredientId === "beans" ? { ...l, removed: true } : l));
    expect(computeAvailability(base({ lines })).ingredients.status).toBe("CONFLICTED");
  });
});

describe("serving lane (C) and overall status", () => {
  it("serving full does not complete food", () => {
    const r = computeAvailability(base({ servingBooked: 1 }));
    expect(r.serving.status).toBe("FULL");
    expect(r.prepared.status).toBe("AVAILABLE");
    expect(r.ingredients.status).toBe("AVAILABLE");
    expect(r.status).toBe("PARTIAL");
  });
  it("distinguishes unscheduled, cancelled and closed from booking states", () => {
    expect(computeAvailability(base({ status: "DRAFT" })).status).toBe("UNSCHEDULED");
    expect(computeAvailability(base({ status: "CANCELLED" })).status).toBe("CANCELLED");
    const closed = computeAvailability(base({ closed: true }));
    expect(closed.status).toBe("CLOSED");
    expect(closed.bookable).toBe(false);
  });
  it("prepared-only meal (no recipe) can be fully covered by prepared food", () => {
    const r = computeAvailability(base({ lines: [], preparedCommitted: 120, servingBooked: 1 }));
    expect(r.prepared.capacity).toBe(120);
    expect(r.ingredients.status).toBe("NOT_NEEDED");
    expect(r.status).toBe("FULL");
  });
});
