/**
 * Loads aggregates for meal plans and runs the availability engine.
 * Also produces context-scoped views (D-23): aggregates + own + own-organization rows only.
 */
import "server-only";
import { prisma, type Tx } from "../db/client";
import { config } from "../config";
import { computeAvailability, type AvailabilityResult, type LaneStatus, type SlotStatus } from "../domain/availability";
import { addDays, dateToDb, dbToDate, mealStartsAt, PERIODS, type MealPeriod } from "../domain/dates";
import { formatQty } from "../domain/units";
import { DomainError } from "../domain/errors";

type Db = Tx | typeof prisma;

export interface Viewer {
  userId: string;
  role: "USER" | "ADMIN";
  context: { type: "SOLO" } | { type: "ORGANIZATION"; organizationId: string; organizationName: string } | null;
}

export async function lockPlan(tx: Tx, planId: string) {
  await tx.$queryRaw`SELECT id FROM "MealPlan" WHERE id = ${planId}::uuid FOR UPDATE`;
}

export async function loadPlanState(db: Db, planIds: string[]) {
  if (planIds.length === 0) return new Map<string, PlanState>();
  const plans = await db.mealPlan.findMany({
    where: { id: { in: planIds } },
    include: { slot: true, ingredients: { include: { pantryItem: true }, orderBy: { pantryItem: { name: "asc" } } } },
  });
  const [prepared, serving, reserved, pledged] = await Promise.all([
    db.commitment.groupBy({ by: ["planId"], where: { planId: { in: planIds }, type: "PREPARED_FOOD", status: "ACTIVE" }, _sum: { servings: true } }),
    db.commitment.groupBy({ by: ["planId"], where: { planId: { in: planIds }, type: "SERVING", status: "ACTIVE" }, _count: { _all: true } }),
    db.pantryAllocation.groupBy({ by: ["planIngredientId"], where: { planId: { in: planIds }, status: "ACTIVE" }, _sum: { quantity: true } }),
    db.groceryLine.groupBy({ by: ["planIngredientId"], where: { planIngredient: { planId: { in: planIds } }, status: "PROMISED" }, _sum: { quantity: true } }),
  ]);
  const prepMap = new Map(prepared.map((p) => [p.planId, p._sum.servings ?? 0]));
  const servMap = new Map(serving.map((p) => [p.planId, p._count._all]));
  const resMap = new Map(reserved.map((p) => [p.planIngredientId, p._sum.quantity ?? 0]));
  const pledMap = new Map(pledged.map((p) => [p.planIngredientId, p._sum.quantity ?? 0]));
  const cfg = config();
  const now = Date.now();

  const out = new Map<string, PlanState>();
  for (const plan of plans) {
    const date = dbToDate(plan.slot.date);
    const startsAt = mealStartsAt(date, plan.slot.period, cfg.SHELTER_TIMEZONE, cfg.startTimes);
    const ings = plan.ingredients
      .map((i) => ({ i, reserved: resMap.get(i.id) ?? 0, pledged: pledMap.get(i.id) ?? 0 }))
      .filter((x) => !x.i.removedAt || x.reserved + x.pledged > 0);
    const result = computeAvailability({
      servingsTarget: plan.servingsTarget,
      recipeYield: plan.recipeYield,
      serviceCapacity: plan.serviceCapacity,
      preparedCommitted: prepMap.get(plan.id) ?? 0,
      servingBooked: servMap.get(plan.id) ?? 0,
      status: plan.status,
      closed: startsAt.getTime() <= now,
      lines: ings.map(({ i, reserved, pledged }) => ({
        ingredientId: i.id,
        q: i.quantity,
        reserved,
        pledged,
        pantryAvailable: i.pantryItem.onHandQty - i.pantryItem.reservedQty,
        removed: !!i.removedAt,
      })),
    });
    out.set(plan.id, { plan, date, startsAt, ingredients: ings.map((x) => x.i), result });
  }
  return out;
}

export type PlanState = {
  plan: Awaited<ReturnType<typeof prisma.mealPlan.findMany>>[number] & { slot: { id: string; date: Date; period: MealPeriod } };
  date: string;
  startsAt: Date;
  ingredients: { id: string; pantryItemId: string; quantity: number; inputUnit: string; removedAt: Date | null; pantryItem: { id: string; name: string; unitKind: "MASS" | "VOLUME" | "COUNT"; displayUnit: string; onHandQty: number; reservedQty: number } }[];
  result: AvailabilityResult;
};

export async function getPlanState(db: Db, planId: string): Promise<PlanState> {
  const s = (await loadPlanState(db, [planId])).get(planId);
  if (!s) throw new DomainError("NOT_FOUND", "Meal not found.");
  return s;
}

/** Resolve the live (non-cancelled) plan of a slot. Volunteers only see PUBLISHED/COMPLETED. */
export async function livePlanIdForSlot(db: Db, slotId: string, viewer: Viewer): Promise<string> {
  const plan = await db.mealPlan.findFirst({ where: { slotId, status: { not: "CANCELLED" } }, select: { id: true, status: true } });
  if (!plan || (viewer.role !== "ADMIN" && plan.status === "DRAFT")) throw new DomainError("NOT_FOUND", "No published meal for this slot.");
  return plan.id;
}

// ---------- Views ----------

export interface CommitmentView {
  id: string;
  type: "PREPARED_FOOD" | "GROCERY" | "PANTRY" | "SERVING";
  status: "ACTIVE" | "CANCELLED";
  servings: number | null;
  contextType: "SOLO" | "ORGANIZATION";
  organizationName: string | null;
  volunteerName: string | null; // only populated for own / same-org rows
  lines: { ingredientName: string; quantity: string; status: string }[];
  createdAt: string;
}

async function commitmentViews(db: Db, where: object, withNames: boolean): Promise<CommitmentView[]> {
  const rows = await db.commitment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { displayName: true } },
      organization: { select: { name: true } },
      groceryLines: { include: { planIngredient: { include: { pantryItem: true } } } },
      allocations: { include: { pantryItem: true } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    type: c.type,
    status: c.status,
    servings: c.servings,
    contextType: c.contextType,
    organizationName: c.organization?.name ?? null,
    volunteerName: withNames ? c.user.displayName : null,
    lines:
      c.type === "GROCERY"
        ? c.groceryLines.map((l) => ({
            ingredientName: l.planIngredient.pantryItem.name,
            quantity: formatQty(l.quantity, l.planIngredient.pantryItem.displayUnit),
            status: l.status,
          }))
        : c.allocations.map((a) => ({ ingredientName: a.pantryItem.name, quantity: formatQty(a.quantity, a.pantryItem.displayUnit), status: a.status })),
    createdAt: c.createdAt.toISOString(),
  }));
}

export async function mealDetail(db: Db, planId: string, viewer: Viewer) {
  const s = await getPlanState(db, planId);
  const { plan, result } = s;
  const lines = s.ingredients.map((ing) => {
    const r = result.ingredients.lines.find((l) => l.ingredientId === ing.id)!;
    const u = ing.pantryItem.displayUnit;
    const q = (n: number) => ({ base: n, display: formatQty(n, u), unit: u });
    return {
      ingredientId: ing.id,
      pantryItemId: ing.pantryItemId,
      name: ing.pantryItem.name,
      unitKind: ing.pantryItem.unitKind,
      removed: !!ing.removedAt,
      required: q(r.required),
      reservedHere: q(r.reserved),
      pledged: q(r.pledged),
      onHand: q(ing.pantryItem.onHandQty),
      allocatedElsewhere: q(Math.max(0, ing.pantryItem.reservedQty - r.reserved)),
      pantryAvailable: q(ing.pantryItem.onHandQty - ing.pantryItem.reservedQty),
      pantryCanCover: q(r.pantryCanCover),
      shortage: q(r.shortage),
      overCovered: q(r.overCovered),
      status: r.status,
    };
  });
  const mine = viewer.role === "USER" ? await commitmentViews(db, { planId, userId: viewer.userId, status: "ACTIVE" }, true) : [];
  let organization: { name: string; commitments: CommitmentView[] } | undefined;
  if (viewer.context?.type === "ORGANIZATION") {
    organization = {
      name: viewer.context.organizationName,
      commitments: await commitmentViews(db, { planId, organizationId: viewer.context.organizationId, status: "ACTIVE" }, true),
    };
  }
  const adminCommitments = viewer.role === "ADMIN" ? await commitmentViews(db, { planId, status: "ACTIVE" }, true) : undefined;
  return {
    slotId: plan.slotId,
    planId: plan.id,
    planStatus: plan.status,
    version: plan.version,
    date: s.date,
    period: plan.slot.period,
    dishName: plan.dishName,
    servingsTarget: plan.servingsTarget,
    recipeYield: plan.recipeYield,
    status: result.status,
    bookable: result.bookable,
    startsAt: s.startsAt.toISOString(),
    prepared: result.prepared,
    ingredients: { status: result.ingredients.status, kitchenServings: result.kitchenServings, coveredServings: result.coveredServings, lines },
    serving: result.serving,
    mine,
    organization,
    adminCommitments,
  };
}
export type MealDetail = Awaited<ReturnType<typeof mealDetail>>;

export interface SlotSummary {
  slotId: string | null;
  date: string;
  period: MealPeriod;
  status: SlotStatus;
  dishName: string | null;
  servingsTarget: number | null;
  coveredServings: number;
  lanes: { prepared: LaneStatus; ingredients: LaneStatus; serving: LaneStatus } | null;
  preparedRemaining: number;
  servingRemaining: number;
  mineCount: number;
  orgCount: number;
  planStatus?: string;
}

/** Calendar: every date x period in range; missing slots are UNSCHEDULED (D-09). */
export async function listSlots(from: string, to: string, viewer: Viewer): Promise<SlotSummary[]> {
  const statuses = viewer.role === "ADMIN" ? ["DRAFT", "PUBLISHED", "COMPLETED"] : ["PUBLISHED", "COMPLETED"];
  const plans = await prisma.mealPlan.findMany({
    where: { status: { in: statuses as ("DRAFT" | "PUBLISHED" | "COMPLETED")[] }, slot: { date: { gte: dateToDb(from), lte: dateToDb(to) } } },
    select: { id: true },
  });
  const states = await loadPlanState(prisma, plans.map((p) => p.id));
  const ids = [...states.keys()];
  const [mine, org] = await Promise.all([
    viewer.role === "USER"
      ? prisma.commitment.groupBy({ by: ["planId"], where: { planId: { in: ids }, userId: viewer.userId, status: "ACTIVE" }, _count: { _all: true } })
      : Promise.resolve([]),
    viewer.context?.type === "ORGANIZATION"
      ? prisma.commitment.groupBy({ by: ["planId"], where: { planId: { in: ids }, organizationId: viewer.context.organizationId, status: "ACTIVE" }, _count: { _all: true } })
      : Promise.resolve([]),
  ]);
  const mineMap = new Map(mine.map((m) => [m.planId, m._count._all]));
  const orgMap = new Map(org.map((m) => [m.planId, m._count._all]));
  const byKey = new Map<string, PlanState>();
  for (const s of states.values()) byKey.set(`${s.date}|${s.plan.slot.period}`, s);

  const out: SlotSummary[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const period of PERIODS) {
      const s = byKey.get(`${d}|${period}`);
      if (!s) {
        out.push({ slotId: null, date: d, period, status: "UNSCHEDULED", dishName: null, servingsTarget: null, coveredServings: 0, lanes: null, preparedRemaining: 0, servingRemaining: 0, mineCount: 0, orgCount: 0 });
        continue;
      }
      const isDraft = s.plan.status === "DRAFT";
      out.push({
        slotId: s.plan.slotId,
        date: d,
        period,
        status: isDraft ? "UNSCHEDULED" : s.result.status,
        dishName: s.plan.dishName,
        servingsTarget: s.plan.servingsTarget,
        coveredServings: s.result.coveredServings,
        lanes: { prepared: s.result.prepared.status, ingredients: s.result.ingredients.status, serving: s.result.serving.status },
        preparedRemaining: s.result.prepared.remaining,
        servingRemaining: s.result.serving.remaining,
        mineCount: mineMap.get(s.plan.id) ?? 0,
        orgCount: orgMap.get(s.plan.id) ?? 0,
        planStatus: s.plan.status,
      });
    }
  }
  return out;
}
