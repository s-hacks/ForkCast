import Link from "next/link";
import { pageAdmin } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";
import { DomainError } from "@/server/domain/errors";
import { prettyDate } from "@/server/domain/dates";
import { fromBase } from "@/server/domain/units";
import { livePlanIdForSlot, mealDetail } from "@/server/services/meals";
import { listPantry } from "@/server/services/admin";
import { MealEditor } from "@/components/admin/meal-editor";
import { StatusBadge, PERIOD_LABEL, TYPE_LABEL } from "@/components/status";

export const dynamic = "force-dynamic";

export default async function EditMeal({ params }: { params: Promise<{ slotId: string }> }) {
  const s = await pageAdmin();
  const { slotId } = await params;
  const viewer = { userId: s.user.id, role: "ADMIN" as const, context: null };
  let planId: string;
  try {
    planId = await livePlanIdForSlot(prisma, slotId, viewer);
  } catch (e) {
    if (!(e instanceof DomainError)) throw e;
    const slot = await prisma.mealSlot.findUnique({ where: { id: slotId } });
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold">No active plan</h1>
        <p>This slot has no active meal plan (it may have been cancelled).</p>
        {slot && (
          <Link className="text-blue-700 underline" href={`/admin/meals/new?date=${slot.date.toISOString().slice(0, 10)}&period=${slot.period}`}>
            Create a new plan for this slot
          </Link>
        )}
      </div>
    );
  }
  const [detail, rawIngs, pantry] = await Promise.all([
    mealDetail(prisma, planId, viewer),
    prisma.planIngredient.findMany({ where: { planId, removedAt: null }, include: { pantryItem: true }, orderBy: { pantryItem: { name: "asc" } } }),
    listPantry(),
  ]);
  const items = pantry.map((i) => ({ id: i.id, name: i.name, units: i.units, displayUnit: i.displayUnit }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">
          {detail.dishName} · {PERIOD_LABEL[detail.period]}, {prettyDate(detail.date)}
        </h1>
        <StatusBadge status={detail.status} />
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase text-slate-700">{detail.planStatus.toLowerCase()}</span>
      </div>
      <MealEditor
        key={`${detail.planId}-${detail.version}`}
        mode="edit"
        items={items}
        planId={detail.planId}
        version={detail.version}
        planStatus={detail.planStatus}
        initial={{
          date: detail.date,
          period: detail.period,
          dishName: detail.dishName,
          servingsTarget: detail.servingsTarget,
          recipeYield: detail.recipeYield,
          serviceCapacity: detail.serving.capacity,
          ingredients: rawIngs.map((i) => ({ pantryItemId: i.pantryItemId, quantity: fromBase(i.quantity, i.inputUnit), unit: i.inputUnit })),
        }}
      />

      <section aria-labelledby="lanes-h" className="grid gap-3 sm:grid-cols-3">
        <h2 id="lanes-h" className="sr-only">Coverage lanes</h2>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold">Prepared food</p>
          <StatusBadge status={detail.prepared.status} size="sm" />
          <p className="mt-1 text-sm">{detail.prepared.committed} committed of {detail.prepared.capacity} possible ({detail.prepared.remaining} remaining)</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold">Ingredients</p>
          <StatusBadge status={detail.ingredients.status} size="sm" />
          <p className="mt-1 text-sm">Kitchen portion {detail.ingredients.kitchenServings} servings; {detail.ingredients.coveredServings} of {detail.servingsTarget} servings covered overall</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold">Serving</p>
          <StatusBadge status={detail.serving.status} size="sm" />
          <p className="mt-1 text-sm">{detail.serving.booked} of {detail.serving.capacity} booked</p>
        </div>
      </section>

      <section aria-labelledby="req-h" className="space-y-2">
        <h2 id="req-h" className="text-lg font-semibold">Ingredient requirements (computed by the server)</h2>
        {detail.ingredients.lines.length === 0 ? (
          <p className="text-sm text-slate-600">No ingredients — prepared food only.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2">Ingredient</th>
                  <th scope="col" className="px-3 py-2">Required (kitchen portion)</th>
                  <th scope="col" className="px-3 py-2">Reserved here</th>
                  <th scope="col" className="px-3 py-2">Pledged (not stock)</th>
                  <th scope="col" className="px-3 py-2">Pantry available</th>
                  <th scope="col" className="px-3 py-2">Donor shortage</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {detail.ingredients.lines.map((l) => (
                  <tr key={l.ingredientId} className="border-t border-slate-100">
                    <th scope="row" className="px-3 py-2 font-medium">
                      {l.name}
                      {l.removed && <span className="ml-1 text-xs text-red-700">(removed)</span>}
                    </th>
                    <td className="px-3 py-2">{l.required.display}</td>
                    <td className="px-3 py-2">{l.reservedHere.display}</td>
                    <td className="px-3 py-2">{l.pledged.display}</td>
                    <td className="px-3 py-2">{l.pantryAvailable.display}</td>
                    <td className="px-3 py-2">{l.shortage.display}</td>
                    <td className="px-3 py-2"><StatusBadge status={l.status} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="com-h" className="space-y-2">
        <h2 id="com-h" className="text-lg font-semibold">Active volunteer commitments</h2>
        {!detail.adminCommitments?.length ? (
          <p className="text-sm text-slate-600">None yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {detail.adminCommitments.map((c) => (
              <li key={c.id} className="px-3 py-2">
                <strong>{c.volunteerName}</strong>
                {c.organizationName ? ` (${c.organizationName})` : " (solo)"} — {TYPE_LABEL[c.type]}
                {c.servings ? `: ${c.servings} servings` : ""}
                {c.lines.length > 0 && `: ${c.lines.map((l) => `${l.ingredientName} ${l.quantity}`).join(", ")}`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
