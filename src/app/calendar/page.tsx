import Link from "next/link";
import { pageVolunteer } from "@/server/auth/guards";
import { config } from "@/server/config";
import { listSlots, type SlotSummary } from "@/server/services/meals";
import { viewerOf } from "@/server/services/commitments";
import { addDays, isDateString, monthRange, prettyDate, todayIn } from "@/server/domain/dates";
import { AppHeader, contextLabelOf } from "@/components/app-header";
import { StatusBadge, StatusLegend, PERIOD_LABEL } from "@/components/status";
import { WeekView, WeekLegend } from "@/components/volunteer/week-view";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const dow = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay();

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; date?: string; view?: string }> }) {
  const s = await pageVolunteer();
  const sp = await searchParams;
  const today = todayIn(config().SHELTER_TIMEZONE);
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : sp.date && isDateString(sp.date) ? sp.date.slice(0, 7) : today.slice(0, 7);
  const view = sp.view === "month" ? "month" : "week";
  const anchor = sp.date && isDateString(sp.date) ? sp.date : today;
  const weekStart = addDays(anchor, -dow(anchor));
  const weekEnd = addDays(weekStart, 6);
  const { from, to } = view === "week" ? { from: weekStart, to: weekEnd } : monthRange(month);
  const selected = sp.date && isDateString(sp.date) && sp.date.startsWith(month) ? sp.date : today.startsWith(month) ? today : from;
  const slots = await listSlots(from, to, viewerOf(s));
  const byDate = new Map<string, SlotSummary[]>();
  for (const sl of slots) byDate.set(sl.date, [...(byDate.get(sl.date) ?? []), sl]);
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const lead = view === "month" ? dow(from) : 0;
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { ...o, timeZone: "UTC" });
  const monthLabel = fmt(from, { month: "long", year: "numeric" });
  const weekLabel = `${fmt(weekStart, { month: "short", day: "numeric" })} – ${fmt(weekEnd, { month: "short", day: "numeric", year: "numeric" })}`;
  const tab = (active: boolean) => `rounded-md px-3 py-1.5 text-sm font-semibold ${active ? "bg-white text-brand shadow" : "text-slate-600 hover:text-brand"}`;
  const isOrg = s.context.type === "ORGANIZATION";

  return (
    <>
      <AppHeader name={s.user.displayName} contextLabel={contextLabelOf(s.context)} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">Meal calendar</h1>
          <nav aria-label="View" className="flex rounded-lg bg-slate-200/70 p-1">
            <Link href={`/calendar?view=week&date=${view === "week" ? weekStart : selected}`} aria-current={view === "week" ? "page" : undefined} className={tab(view === "week")}>Week</Link>
            <Link href={`/calendar?view=month&month=${view === "week" ? weekStart.slice(0, 7) : month}`} aria-current={view === "month" ? "page" : undefined} className={tab(view === "month")}>Month</Link>
          </nav>
          {view === "week" ? (
            <nav aria-label="Week navigation" className="ml-auto flex items-center gap-2">
              <Link href={`/calendar?view=week&date=${addDays(weekStart, -7)}`} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50" aria-label="Previous week">← Prev</Link>
              <span className="min-w-44 text-center font-semibold" aria-live="polite">{weekLabel}</span>
              <Link href={`/calendar?view=week&date=${addDays(weekStart, 7)}`} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50" aria-label="Next week">Next →</Link>
              <Link href="/calendar" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Today</Link>
            </nav>
          ) : (
            <nav aria-label="Month navigation" className="ml-auto flex items-center gap-2">
              <Link href={`/calendar?view=month&month=${shiftMonth(month, -1)}`} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50" aria-label="Previous month">← Prev</Link>
              <span className="min-w-36 text-center font-semibold" aria-live="polite">{monthLabel}</span>
              <Link href={`/calendar?view=month&month=${shiftMonth(month, 1)}`} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50" aria-label="Next month">Next →</Link>
              <Link href="/calendar?view=month" className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Today</Link>
            </nav>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"><StatusLegend /><WeekLegend isOrg={isOrg} /></div>
        <p className="mt-2 text-sm text-slate-600">
          {view === "week"
            ? "Status shows overall availability. Blue outlines are your commitments" + (isOrg ? ", purple are your organization's. Other groups stay private." : ".")
            : isOrg
              ? "Colors show overall availability across all volunteers. Dots mark your organization's commitments; other groups' details stay private."
              : "Colors show overall availability across all volunteers. Dots mark your own commitments."}
        </p>

        {view === "week" ? (
          <div className="mt-4"><WeekView days={days} byDate={byDate} today={today} isOrg={isOrg} /></div>
        ) : (
          <>
        {/* Mobile: date strip + agenda */}
        <div className="mt-4 md:hidden">
          <div className="flex gap-1 overflow-x-auto pb-2" role="list" aria-label="Choose a date">
            {days.map((d) => (
              <Link
                role="listitem"
                key={d}
                href={`/calendar?view=month&month=${month}&date=${d}`}
                aria-current={d === selected ? "date" : undefined}
                className={`flex min-w-12 flex-col items-center rounded border px-2 py-1 text-xs ${d === selected ? "border-blue-600 bg-blue-50 font-semibold" : "border-slate-200 bg-white"}`}
              >
                <span>{WEEKDAYS[dow(d)]}</span>
                <span className="text-base">{Number(d.slice(8))}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Desktop month grid */}
        <div className="mt-4 hidden md:block">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200" role="grid" aria-label={monthLabel}>
            {WEEKDAYS.map((w) => (
              <div key={w} role="columnheader" className="bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600">{w}</div>
            ))}
            {Array.from({ length: lead }).map((_, i) => <div key={`pad${i}`} className="bg-slate-50" aria-hidden />)}
            {days.map((d) => (
              <div key={d} role="gridcell" className={`min-h-28 bg-white p-1.5 ${d === selected ? "ring-2 ring-inset ring-blue-500" : ""}`}>
                <Link href={`/calendar?view=month&month=${month}&date=${d}`} className={`text-xs font-semibold ${d === today ? "rounded bg-brand px-1.5 text-white" : "text-slate-700"}`} aria-label={`Show ${prettyDate(d)}`}>
                  {Number(d.slice(8))}
                </Link>
                <ul className="mt-1 space-y-0.5">
                  {(byDate.get(d) ?? []).map((sl) => <SlotRow key={sl.period} sl={sl} compact />)}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <section aria-labelledby="day-h" className="mt-6">
          <h2 id="day-h" className="text-lg font-semibold">{prettyDate(selected)}</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {(byDate.get(selected) ?? []).map((sl) => <DayCard key={sl.period} sl={sl} isOrg={isOrg} />)}
          </ul>
        </section>
          </>
        )}
      </main>
    </>
  );
}

function Dots({ sl }: { sl: SlotSummary }) {
  return (
    <>
      {sl.mineCount > 0 && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-blue-600" title="You have a commitment" aria-label="You have a commitment" />}
      {sl.orgCount > 0 && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-purple-600" title="Your organization has a commitment" aria-label="Your organization has a commitment" />}
    </>
  );
}

function SlotRow({ sl }: { sl: SlotSummary; compact?: boolean }) {
  const inner = (
    <span className="flex items-center gap-1 text-[11px]">
      <span className="w-3 font-bold text-slate-500" aria-hidden>{sl.period[0]}</span>
      <span className="sr-only">{PERIOD_LABEL[sl.period]}:</span>
      <StatusBadge status={sl.status} size="sm" label={sl.status === "UNSCHEDULED" ? "—" : undefined} />
      <span className="truncate text-slate-700">{sl.dishName ?? ""}</span>
      <Dots sl={sl} />
    </span>
  );
  return <li>{sl.slotId && sl.status !== "UNSCHEDULED" ? <Link href={`/meals/${sl.slotId}`} className="block rounded hover:bg-slate-50">{inner}</Link> : inner}</li>;
}

function DayCard({ sl, isOrg }: { sl: SlotSummary; isOrg: boolean }) {
  const bookable = sl.slotId && sl.status !== "UNSCHEDULED";
  const body = (
    <div className="h-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{PERIOD_LABEL[sl.period]}</h3>
        <StatusBadge status={sl.status} />
      </div>
      {bookable ? (
        <>
          <p className="mt-1 text-lg">{sl.dishName}</p>
          <p className="text-sm text-slate-600">{sl.coveredServings} of {sl.servingsTarget} servings covered</p>
          {sl.lanes && (
            <dl className="mt-3 grid grid-cols-1 gap-1 text-sm">
              <div className="flex items-center justify-between"><dt>Prepared food</dt><dd><StatusBadge status={sl.lanes.prepared} size="sm" /></dd></div>
              <div className="flex items-center justify-between"><dt>Ingredients</dt><dd><StatusBadge status={sl.lanes.ingredients} size="sm" /></dd></div>
              <div className="flex items-center justify-between"><dt>Serving</dt><dd><StatusBadge status={sl.lanes.serving} size="sm" /></dd></div>
            </dl>
          )}
          {(sl.mineCount > 0 || sl.orgCount > 0) && (
            <p className="mt-2 text-xs text-slate-600">
              {sl.mineCount > 0 && `You: ${sl.mineCount} commitment(s). `}
              {isOrg && sl.orgCount > 0 && `Your organization: ${sl.orgCount}.`}
            </p>
          )}
          <span className="mt-3 inline-block text-sm font-medium text-blue-700 underline">View details</span>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No meal has been published for this slot yet.</p>
      )}
    </div>
  );
  return <li>{bookable ? <Link href={`/meals/${sl.slotId}`} className="block h-full">{body}</Link> : body}</li>;
}
