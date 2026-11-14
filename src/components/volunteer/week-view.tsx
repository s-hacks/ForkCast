/**
 * Week view: seven day columns, three compact meal cards each. Deliberately light on detail
 * (dish, one status badge, a coverage bar); lanes and numbers live on the meal page.
 * Highlights: blue = you have a commitment, purple = your organization does (never shows who).
 */
import Link from "next/link";
import { CircleCheck, Users } from "lucide-react";
import type { SlotSummary } from "@/server/services/meals";
import { StatusBadge, PERIOD_LABEL } from "@/components/status";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dow = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

export function WeekLegend({ isOrg }: { isOrg: boolean }) {
  return (
    <ul aria-label="Highlight legend" className="flex flex-wrap gap-2 text-xs font-medium">
      <li className="inline-flex items-center gap-1 rounded-full border border-blue-600 bg-blue-50 px-2 py-0.5 text-blue-900">
        <CircleCheck aria-hidden className="h-3 w-3" /> You&apos;re booked
      </li>
      {isOrg && (
        <li className="inline-flex items-center gap-1 rounded-full border border-purple-600 bg-purple-50 px-2 py-0.5 text-purple-900">
          <Users aria-hidden className="h-3 w-3" /> Your group is booked
        </li>
      )}
    </ul>
  );
}

function SlotCard({ sl, isOrg }: { sl: SlotSummary; isOrg: boolean }) {
  const scheduled = sl.slotId && sl.status !== "UNSCHEDULED";
  if (!scheduled) {
    return (
      <li className="rounded-lg border border-dashed border-slate-300 px-2.5 py-2 text-xs text-slate-400">
        <span className="font-semibold">{PERIOD_LABEL[sl.period]}</span> · not scheduled
      </li>
    );
  }
  const mine = sl.mineCount > 0;
  const group = isOrg && sl.orgCount > 0;
  const tone = mine ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : group ? "border-purple-600 bg-purple-50 ring-1 ring-purple-600" : "border-slate-200 bg-white";
  const pct = sl.servingsTarget ? Math.min(100, Math.round((sl.coveredServings / sl.servingsTarget) * 100)) : 0;
  return (
    <li>
      <Link
        href={`/meals/${sl.slotId}`}
        className={`block rounded-lg border px-2.5 py-2 shadow-sm transition hover:shadow-md ${tone} ${sl.status === "CLOSED" ? "opacity-70" : ""}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{PERIOD_LABEL[sl.period]}</p>
        <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{sl.dishName}</p>
        <div className="mt-1.5"><StatusBadge status={sl.status} size="sm" /></div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
          role="img"
          aria-label={`${sl.coveredServings} of ${sl.servingsTarget} servings covered`}
          title={`${sl.coveredServings} of ${sl.servingsTarget} servings covered`}
        >
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        {(mine || group) && (
          <p className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold ${mine ? "text-blue-900" : "text-purple-900"}`}>
            {mine ? <CircleCheck aria-hidden className="h-3.5 w-3.5" /> : <Users aria-hidden className="h-3.5 w-3.5" />}
            {mine ? (group ? "You + your group" : "You're booked") : "Your group is booked"}
          </p>
        )}
      </Link>
    </li>
  );
}

export function WeekView({ days, byDate, today, isOrg }: { days: string[]; byDate: Map<string, SlotSummary[]>; today: string; isOrg: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((d) => (
        <section key={d} aria-label={new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}>
          <h2 className={`mb-2 flex items-baseline gap-1.5 text-sm font-semibold ${d === today ? "text-brand" : "text-slate-600"}`}>
            <span>{WEEKDAYS[dow(d)]}</span>
            <span className={`rounded-md px-1.5 text-base ${d === today ? "bg-brand text-white" : "text-slate-900"}`}>{Number(d.slice(8))}</span>
            {d === today && <span className="text-xs font-medium">Today</span>}
          </h2>
          <ul className="space-y-2">
            {(byDate.get(d) ?? []).map((sl) => <SlotCard key={sl.period} sl={sl} isOrg={isOrg} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
