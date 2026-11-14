import Link from "next/link";
import { StatusBadge, PERIOD_LABEL } from "@/components/status";
import { prettyDate } from "@/server/domain/dates";
import type { SlotSummary } from "@/server/services/meals";

export function slotHref(s: SlotSummary) {
  return s.slotId ? `/admin/meals/${s.slotId}` : `/admin/meals/new?date=${s.date}&period=${s.period}`;
}

export function SlotTable({ slots, caption }: { slots: SlotSummary[]; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-2">Date</th>
            <th scope="col" className="px-3 py-2">Meal</th>
            <th scope="col" className="px-3 py-2">Dish</th>
            <th scope="col" className="px-3 py-2">Status</th>
            <th scope="col" className="px-3 py-2">Lanes (food / ingredients / serving)</th>
            <th scope="col" className="px-3 py-2">Covered</th>
            <th scope="col" className="px-3 py-2"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {slots.map((s) => (
            <tr key={`${s.date}-${s.period}`} className="border-t border-slate-100">
              <td className="px-3 py-2 whitespace-nowrap">{prettyDate(s.date)}</td>
              <td className="px-3 py-2">{PERIOD_LABEL[s.period]}</td>
              <td className="px-3 py-2">
                {s.dishName ?? <span className="text-slate-400">—</span>}
                {s.planStatus === "DRAFT" && <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-900">Draft</span>}
              </td>
              <td className="px-3 py-2"><StatusBadge status={s.status} size="sm" /></td>
              <td className="px-3 py-2">
                {s.lanes ? (
                  <span className="flex flex-wrap gap-1">
                    <StatusBadge status={s.lanes.prepared} size="sm" label={`Prepared: ${labelOf(s.lanes.prepared)}`} />
                    <StatusBadge status={s.lanes.ingredients} size="sm" label={`Ingredients: ${labelOf(s.lanes.ingredients)}`} />
                    <StatusBadge status={s.lanes.serving} size="sm" label={`Serving: ${labelOf(s.lanes.serving)}`} />
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{s.servingsTarget ? `${s.coveredServings} / ${s.servingsTarget}` : "—"}</td>
              <td className="px-3 py-2">
                <Link href={slotHref(s)} className="font-medium text-blue-700 underline">
                  {s.slotId ? "Edit" : "Create plan"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function labelOf(s: string) {
  return ({ AVAILABLE: "open", PARTIAL: "partial", FULL: "full", NOT_NEEDED: "not needed", CONFLICTED: "conflict" } as Record<string, string>)[s] ?? s.toLowerCase();
}
