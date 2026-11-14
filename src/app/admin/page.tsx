import Link from "next/link";
import { pageAdmin } from "@/server/auth/guards";
import { config } from "@/server/config";
import { addDays, todayIn } from "@/server/domain/dates";
import { listSlots } from "@/server/services/meals";
import { listIncomingGroceries, listPantry } from "@/server/services/admin";
import { SlotTable, slotHref } from "@/components/admin/slot-table";
import { TriangleAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const s = await pageAdmin();
  const today = todayIn(config().SHELTER_TIMEZONE);
  const [slots, pantry, incoming] = await Promise.all([
    listSlots(today, addDays(today, 6), { userId: s.user.id, role: "ADMIN", context: null }),
    listPantry(),
    listIncomingGroceries(),
  ]);
  const insufficient = pantry.filter((p) => p.insufficient);
  const conflicted = slots.filter((x) => x.status === "CONFLICTED");
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="ins-h">
          <h2 id="ins-h" className="font-semibold">Insufficient pantry stock</h2>
          {insufficient.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">All open ingredient demand is covered by available stock.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {insufficient.map((p) => (
                <li key={p.id} className="flex items-start gap-1">
                  <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 text-red-700" />
                  <span>
                    <strong>{p.name}</strong>: open demand {p.openDemand}, available {p.available}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/pantry" className="mt-3 inline-block text-sm font-medium text-blue-700 underline">Go to pantry</Link>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="inc-h">
          <h2 id="inc-h" className="font-semibold">Incoming grocery pledges</h2>
          <p className="mt-2 text-3xl font-bold">{incoming.length}</p>
          <p className="text-sm text-slate-600">Promised, not yet received (not counted as stock).</p>
          <Link href="/admin/groceries" className="mt-3 inline-block text-sm font-medium text-blue-700 underline">Record receipts</Link>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-4" aria-labelledby="con-h">
          <h2 id="con-h" className="font-semibold">Meals needing attention</h2>
          {conflicted.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No conflicts in the next 7 days.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {conflicted.map((c) => (
                <li key={`${c.date}-${c.period}`}>
                  <Link href={slotHref(c)} className="text-blue-700 underline">{c.dishName} — {c.date} {c.period.toLowerCase()}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section aria-labelledby="week-h" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="week-h" className="text-lg font-semibold">Next 7 days</h2>
          <Link href="/admin/meals/new" className="rounded-md bg-red-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-900">New meal plan</Link>
        </div>
        <SlotTable slots={slots} caption="Meal slots for the next 7 days" />
      </section>
    </div>
  );
}
