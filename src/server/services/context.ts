/** Participation context (D-22) and the volunteer's own commitments (FR-36). */
import "server-only";
import { prisma } from "../db/client";
import { config } from "../config";
import { DomainError } from "../domain/errors";
import { dbToDate, mealStartsAt } from "../domain/dates";
import { formatQty } from "../domain/units";
import type { SessionUser } from "../auth/session";

export async function listMyOrganizations(userId: string) {
  const rows = await prisma.organizationMembership.findMany({ where: { userId }, include: { organization: true }, orderBy: { organization: { name: "asc" } } });
  return rows.map((r) => ({ id: r.organization.id, name: r.organization.name, kind: r.organization.kind }));
}

export async function selectContext(s: SessionUser, input: { type: "SOLO" } | { type: "ORGANIZATION"; organizationId: string }) {
  if (s.user.role !== "USER") throw new DomainError("FORBIDDEN", "Administrators do not select a participation context.");
  let orgName: string | null = null;
  if (input.type === "ORGANIZATION") {
    const m = await prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: s.user.id, organizationId: input.organizationId } },
      include: { organization: true },
    });
    if (!m) throw new DomainError("ORG_NOT_AUTHORIZED", "You are not a member of that organization.");
    orgName = m.organization.name;
  }
  await prisma.$transaction([
    prisma.session.update({
      where: { id: s.sessionId },
      data: { contextType: input.type, organizationId: input.type === "ORGANIZATION" ? input.organizationId : null },
    }),
    prisma.auditLog.create({ data: { actorId: s.user.id, action: "context.select", entityType: "Session", entityId: s.user.id, data: { ...input } } }),
  ]);
  return input.type === "SOLO" ? { type: "SOLO" as const } : { type: "ORGANIZATION" as const, organizationId: input.organizationId, organizationName: orgName! };
}

export async function listMyCommitments(userId: string, scope: "upcoming" | "past") {
  const cfg = config();
  const rows = await prisma.commitment.findMany({
    where: { userId },
    orderBy: [{ plan: { slot: { date: "asc" } } }, { createdAt: "asc" }],
    include: {
      plan: { include: { slot: true } },
      organization: { select: { name: true } },
      groceryLines: { include: { planIngredient: { include: { pantryItem: true } } } },
      allocations: { include: { pantryItem: true } },
    },
  });
  const now = Date.now();
  return rows
    .map((c) => {
      const date = dbToDate(c.plan.slot.date);
      const startsAt = mealStartsAt(date, c.plan.slot.period, cfg.SHELTER_TIMEZONE, cfg.startTimes);
      const past = startsAt.getTime() <= now || c.plan.status === "COMPLETED";
      return {
        id: c.id,
        slotId: c.plan.slotId,
        date,
        period: c.plan.slot.period,
        dishName: c.plan.dishName,
        planStatus: c.plan.status,
        type: c.type,
        status: c.status,
        servings: c.servings,
        contextType: c.contextType,
        organizationName: c.organization?.name ?? null,
        lines:
          c.type === "GROCERY"
            ? c.groceryLines.map((l) => ({ name: l.planIngredient.pantryItem.name, quantity: formatQty(l.quantity, l.planIngredient.pantryItem.displayUnit), status: l.status }))
            : c.allocations.map((a) => ({ name: a.pantryItem.name, quantity: formatQty(a.quantity, a.pantryItem.displayUnit), status: a.status })),
        startsAt: startsAt.toISOString(),
        past,
        editable: !past && c.status === "ACTIVE" && c.plan.status === "PUBLISHED",
      };
    })
    .filter((c) => (scope === "past" ? c.past : !c.past));
}
