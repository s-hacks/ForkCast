/**
 * Demo seed / reset (FR-42). Truncates all tables and recreates the scenario dataset in
 * docs/requirements.md section 7. Refuses non-local databases unless ALLOW_DEMO_RESET=true,
 * and always refuses in production.
 *
 * Usage: npm run db:seed   (or npm run demo:reset)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../src/generated/prisma/client";
import { assertResetAllowed } from "../scripts/reset-guard";
import { addDays, dateToDb, todayIn, PERIODS, type MealPeriod } from "../src/server/domain/dates";

const url = process.env.DATABASE_URL!;
assertResetAllowed(url, process.env);
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const TZ = process.env.SHELTER_TIMEZONE ?? "America/Chicago";

async function main() {
  const adminPw = process.env.SEED_ADMIN_PASSWORD;
  const userPw = process.env.SEED_USER_PASSWORD;
  if (!adminPw || !userPw) throw new Error("Set SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD (see .env.example).");

  await prisma.$executeRawUnsafe(`TRUNCATE "AuditLog","IdempotencyRecord","InventoryTransaction","PantryAllocation","GroceryLine","Commitment","PlanIngredient","MealPlan","MealSlot","PantryItem","OrganizationMembership","Session","LoginAttempt","Organization","User" CASCADE`);

  const opts = { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 as const };
  const [aHash, uHash] = await Promise.all([hash(adminPw, opts), hash(userPw, opts)]);
  const mk = (username: string, displayName: string, role: "USER" | "ADMIN") =>
    prisma.user.create({ data: { username, displayName, role, passwordHash: role === "ADMIN" ? aHash : uHash } });
  const admin = await mk("admin", "Kitchen Admin", "ADMIN");
  const maria = await mk("maria", "Maria Lopez", "USER");
  const james = await mk("james", "James Carter", "USER");
  const aisha = await mk("aisha", "Aisha Khan", "USER");
  const sam = await mk("sam", "Sam Rivera", "USER");

  const church = await prisma.organization.create({ data: { name: "St. Paul's Church", kind: "Church" } });
  const hospital = await prisma.organization.create({ data: { name: "UAB Hospital Volunteers", kind: "Hospital" } });
  await prisma.organizationMembership.createMany({
    data: [
      { userId: maria.id, organizationId: church.id },
      { userId: maria.id, organizationId: hospital.id },
      { userId: james.id, organizationId: church.id },
      { userId: aisha.id, organizationId: hospital.id },
    ],
  });

  // Pantry (base units: g / ml / each). Illustrative quantities, not real recipes.
  const items: Record<string, { kind: "MASS" | "VOLUME" | "COUNT"; unit: string; onHand: number }> = {
    "Ground beef": { kind: "MASS", unit: "kg", onHand: 25000 },
    "Canned tomatoes": { kind: "MASS", unit: "kg", onHand: 20000 },
    "Chili powder": { kind: "MASS", unit: "g", onHand: 1500 },
    "Kidney beans": { kind: "MASS", unit: "kg", onHand: 0 },
    Onions: { kind: "MASS", unit: "kg", onHand: 0 },
    "Bell peppers": { kind: "MASS", unit: "kg", onHand: 0 },
    "Cornbread mix": { kind: "MASS", unit: "kg", onHand: 0 },
    "Spaghetti pasta": { kind: "MASS", unit: "lb", onHand: 18144 },
    "Marinara sauce": { kind: "VOLUME", unit: "l", onHand: 20000 },
    "Parmesan cheese": { kind: "MASS", unit: "lb", onHand: 2268 },
    "Milk": { kind: "VOLUME", unit: "l", onHand: 8000 },
    "Eggs": { kind: "COUNT", unit: "each", onHand: 120 },
  };
  const item: Record<string, string> = {};
  for (const [name, v] of Object.entries(items)) {
    const it = await prisma.pantryItem.create({ data: { name, unitKind: v.kind, displayUnit: v.unit, onHandQty: v.onHand } });
    item[name] = it.id;
    if (v.onHand > 0) {
      await prisma.inventoryTransaction.create({
        data: { pantryItemId: it.id, type: "INITIAL", deltaOnHand: v.onHand, deltaReserved: 0, onHandAfter: v.onHand, reservedAfter: 0, reason: "Seed stock", actorId: admin.id },
      });
    }
  }

  // Dates: today .. today+13 in the shelter timezone. Scenario anchor = next Tuesday after today.
  const today = todayIn(TZ);
  let T = addDays(today, 1);
  while (new Date(`${T}T12:00:00Z`).getUTCDay() !== 2) T = addDays(T, 1);
  const chiliIngredients = [
    ["Ground beef", 10000, "kg"],
    ["Canned tomatoes", 8000, "kg"],
    ["Chili powder", 500, "g"],
    ["Kidney beans", 6000, "kg"],
    ["Onions", 4000, "kg"],
    ["Bell peppers", 3000, "kg"],
    ["Cornbread mix", 2000, "kg"],
  ] as const;

  const special: Record<string, { dish: string; servings: number; ingredients?: readonly (readonly [string, number, string])[]; status?: "DRAFT" | "NONE" }> = {
    [`${T}|LUNCH`]: { dish: "Chili", servings: 120, ingredients: chiliIngredients },
    [`${T}|DINNER`]: { dish: "Chili (grocery scenario)", servings: 120, ingredients: chiliIngredients },
    [`${addDays(T, 1)}|LUNCH`]: {
      dish: "Spaghetti marinara",
      servings: 100,
      ingredients: [["Spaghetti pasta", 9072, "lb"], ["Marinara sauce", 12000, "l"], ["Parmesan cheese", 907, "lb"]],
    },
    [`${addDays(T, 1)}|BREAKFAST`]: { dish: "Scrambled eggs", servings: 60, ingredients: [["Eggs", 120, "each"], ["Milk", 2000, "l"]] },
    [`${addDays(T, 2)}|LUNCH`]: { dish: "Chicken & rice", servings: 120 },
    [`${addDays(T, 4)}|DINNER`]: { dish: "", servings: 0, status: "NONE" },
    [`${addDays(T, 5)}|LUNCH`]: { dish: "Turkey sandwiches (draft)", servings: 110, status: "DRAFT" },
  };
  const fillers: Record<MealPeriod, string[]> = {
    BREAKFAST: ["Oatmeal & fruit", "Pancakes", "Breakfast burritos", "Biscuits & gravy"],
    LUNCH: ["Vegetable soup & sandwiches", "Chicken & rice", "Red beans & rice", "Pasta salad"],
    DINNER: ["Baked chicken", "Meatloaf & potatoes", "Beef stew", "Lasagna"],
  };

  const plans: Record<string, string> = {};
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i);
    for (const period of PERIODS) {
      const key = `${d}|${period}`;
      const sp = special[key];
      if (sp?.status === "NONE") continue;
      const slot = await prisma.mealSlot.create({ data: { date: dateToDb(d), period } });
      const dish = sp?.dish ?? fillers[period][i % 4];
      const servings = sp?.servings ?? (period === "LUNCH" ? 130 : 100);
      const plan = await prisma.mealPlan.create({
        data: {
          slotId: slot.id,
          dishName: dish,
          servingsTarget: servings,
          recipeYield: servings,
          serviceCapacity: 1,
          status: sp?.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
          publishedAt: sp?.status === "DRAFT" ? null : new Date(),
          ingredients: sp?.ingredients
            ? { create: sp.ingredients.map(([n, q, u]) => ({ pantryItemId: item[n], quantity: q, inputUnit: u })) }
            : undefined,
        },
      });
      plans[key] = plan.id;
    }
  }

  // Scenario states (prepared-only meals, so no reservations are involved).
  const thuL = plans[`${addDays(T, 2)}|LUNCH`];
  const thuD = plans[`${addDays(T, 2)}|DINNER`];
  const friB = plans[`${addDays(T, 3)}|BREAKFAST`];
  await prisma.commitment.createMany({
    data: [
      { planId: thuL, userId: james.id, contextType: "ORGANIZATION", organizationId: church.id, type: "PREPARED_FOOD", servings: 60 },
      { planId: thuD, userId: aisha.id, contextType: "ORGANIZATION", organizationId: hospital.id, type: "PREPARED_FOOD", servings: 100 },
      { planId: thuD, userId: sam.id, contextType: "SOLO", type: "SERVING" },
      { planId: friB, userId: maria.id, contextType: "ORGANIZATION", organizationId: church.id, type: "PREPARED_FOOD", servings: 100 },
    ],
  });
  console.log(`Seeded. Scenario Tuesday = ${T}. Users: admin, maria, james, aisha, sam.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
