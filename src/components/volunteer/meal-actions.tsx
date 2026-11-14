"use client";
/**
 * Meal detail + booking actions. All statuses and numbers come from the server
 * (MealDetail); after every mutation the returned availability replaces local state.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MealDetail } from "@/server/services/meals";
import { apiFetch, newKey, type ApiError } from "@/lib/api-client";
import { StatusBadge, PERIOD_LABEL, TYPE_LABEL } from "@/components/status";

type Tab = "prepared" | "groceries" | "pantry" | "serving";
type Mutation = { commitmentId: string; availability: MealDetail };

function pretty(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function MealActions({ initial, contextType }: { initial: MealDetail; contextType: "SOLO" | "ORGANIZATION" }) {
  const router = useRouter();
  const [d, setD] = useState<MealDetail>(initial);
  const [tab, setTab] = useState<Tab>("prepared");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function submit(path: string, body: unknown, okMsg: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const r = await apiFetch<Mutation>(`/api/v1/meals/${d.slotId}/${path}`, { method: "POST", body, key: newKey() });
    setBusy(false);
    if (r.ok) {
      setD(r.data.availability);
      setSuccess(okMsg);
      router.refresh();
      return true;
    }
    setError(r.error);
    if (r.error.availability) setD(r.error.availability as MealDetail);
    return false;
  }

  const closedReason = !d.bookable ? (d.status === "CLOSED" ? "This meal has started or been served; bookings are closed." : d.status === "CANCELLED" ? "This meal was cancelled." : "This meal is not open for booking.") : null;

  return (
    <div className="mt-4 space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{d.dishName}</h1>
          <StatusBadge status={d.status} />
        </div>
        <p className="mt-1 text-slate-700">
          {pretty(d.date)} · {PERIOD_LABEL[d.period]} · {d.servingsTarget} servings needed
        </p>
        <p className="text-sm text-slate-600">{d.ingredients.coveredServings} of {d.servingsTarget} servings currently covered.</p>
      </header>

      <section aria-label="Requirements" className="grid gap-3 md:grid-cols-3">
        <Lane title="Prepared food" status={d.prepared.status}>
          <p>{d.prepared.committed} servings committed</p>
          <p className="font-semibold">{d.prepared.remaining} servings can still be pledged</p>
        </Lane>
        <Lane title="Ingredients" status={d.ingredients.status}>
          <p>Kitchen to cook {d.ingredients.kitchenServings} servings</p>
          <p className="font-semibold">
            {d.ingredients.lines.filter((l) => l.shortage.base > 0).length} of {d.ingredients.lines.filter((l) => !l.removed).length} ingredients still need donors
          </p>
        </Lane>
        <Lane title="Serving" status={d.serving.status}>
          <p>{d.serving.booked} of {d.serving.capacity} serving assignment(s) booked</p>
          <p className="font-semibold">{d.serving.remaining > 0 ? "Open" : "Taken"}</p>
        </Lane>
      </section>

      <div aria-live="polite" role="status">
        {success && <p className="rounded border border-green-300 bg-green-50 px-3 py-2 text-green-900">{success}</p>}
      </div>
      {error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-red-900">
          {error.message}
        </p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div role="tablist" aria-label="How do you want to help?" className="flex flex-wrap border-b border-slate-200">
          {(
            [
              ["prepared", "Bring cooked food"],
              ["groceries", "Plan: bring groceries"],
              ["pantry", "Plan: use pantry"],
              ["serving", "Volunteer to serve"],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button
              key={t}
              role="tab"
              id={`tab-${t}`}
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              onClick={() => {
                setTab(t);
                setError(null);
                setSuccess(null);
              }}
              className={`px-4 py-3 text-sm font-medium ${tab === t ? "border-b-2 border-brand text-brand" : "text-slate-600 hover:text-slate-900"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-5">
          {closedReason && <p className="mb-4 rounded bg-slate-100 px-3 py-2 text-sm text-slate-700">{closedReason}</p>}
          {tab === "prepared" && <PreparedPanel d={d} busy={busy} disabled={!!closedReason} onSubmit={(n) => submit("prepared", { servings: n }, `Thank you! ${n} prepared servings committed.`)} />}
          {tab === "groceries" && <GroceriesPanel d={d} busy={busy} disabled={!!closedReason} onSubmit={(lines) => submit("groceries", { lines }, "Thank you! Your grocery pledge is recorded (promised, not yet received).")} />}
          {tab === "pantry" && <PantryPanel d={d} busy={busy} disabled={!!closedReason} onSubmit={() => submit("pantry", { confirm: true }, "Pantry supplies are now reserved for this meal.")} goGroceries={() => setTab("groceries")} />}
          {tab === "serving" && <ServingPanel d={d} busy={busy} disabled={!!closedReason} onSubmit={() => submit("serving", {}, "You're booked to serve this meal. Thank you!")} />}
        </div>
      </section>

      <Commitments title="Your commitments for this meal" items={d.mine} empty="You have no commitments for this meal yet." />
      {contextType === "ORGANIZATION" && d.organization && (
        <Commitments title={`${d.organization.name}'s commitments`} items={d.organization.commitments} empty="Your organization has not committed to this meal yet." showNames />
      )}
    </div>
  );
}

function Lane({ title, status, children }: { title: string; status: MealDetail["prepared"]["status"]; children: React.ReactNode }) {
  return (
    <section aria-label={`${title} requirement`} data-lane={title} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <StatusBadge status={status} size="sm" />
      </div>
      <div className="mt-2 space-y-0.5 text-sm text-slate-700">{children}</div>
    </section>
  );
}

const btn = "rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

function PreparedPanel({ d, busy, disabled, onSubmit }: { d: MealDetail; busy: boolean; disabled: boolean; onSubmit: (n: number) => Promise<boolean> }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const max = d.prepared.remaining;
  const off = disabled || max <= 0;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const n = Number(val);
        if (!/^\d+$/.test(val.trim()) || n < 1) return setErr("Enter a whole number of at least 1.");
        if (n > max) return setErr(`Only ${max} servings can still be pledged.`);
        setErr(null);
        if (await onSubmit(n)) setVal("");
      }}
      className="space-y-3"
    >
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-slate-500">Required</dt><dd className="text-lg font-semibold">{d.servingsTarget}</dd></div>
        <div><dt className="text-slate-500">Committed</dt><dd className="text-lg font-semibold">{d.prepared.committed}</dd></div>
        <div><dt className="text-slate-500">Remaining</dt><dd className="text-lg font-semibold">{max}</dd></div>
      </dl>
      {max <= 0 && !disabled && <p className="text-sm text-slate-700">No more prepared servings are needed — this requirement is fully booked or covered by the kitchen plan.</p>}
      <div>
        <label htmlFor="servings" className="block text-sm font-medium">Servings you will bring</label>
        <input id="servings" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} disabled={off} aria-invalid={!!err} aria-describedby={err ? "servings-err" : undefined} className="mt-1 w-40 rounded border border-slate-300 px-3 py-2 disabled:bg-slate-100" placeholder={`1–${Math.max(max, 1)}`} />
        {err && <p id="servings-err" className="mt-1 text-sm text-red-700">{err}</p>}
      </div>
      <button type="submit" disabled={off || busy} className={btn}>{busy ? "Saving…" : "Commit prepared food"}</button>
    </form>
  );
}

function GroceriesPanel({ d, busy, disabled, onSubmit }: { d: MealDetail; busy: boolean; disabled: boolean; onSubmit: (l: { ingredientId: string; quantity: number; unit: string }[]) => Promise<boolean> }) {
  const [sel, setSel] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const lines = d.ingredients.lines.filter((l) => !l.removed);
  if (lines.length === 0) return <p className="text-sm text-slate-700">This meal has no recipe ingredients; it can only be covered with prepared food.</p>;
  const open = lines.filter((l) => l.shortage.base > 0);
  const toUnits = (l: (typeof lines)[number], base: number) => Number(l.shortage.display.split(" ")[0].replace(/,/g, "")) * (base / Math.max(l.shortage.base, 1));
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const chosen = Object.entries(sel).filter(([, v]) => v !== "");
        if (chosen.length === 0) return setErr("Select at least one ingredient and enter a quantity.");
        const payload = [];
        for (const [id, v] of chosen) {
          const l = lines.find((x) => x.ingredientId === id)!;
          const n = Number(v);
          if (!Number.isFinite(n) || n <= 0) return setErr(`${l.name}: enter a quantity greater than 0.`);
          payload.push({ ingredientId: id, quantity: n, unit: l.shortage.unit });
        }
        setErr(null);
        if (await onSubmit(payload)) setSel({});
      }}
      className="space-y-3"
    >
      <p className="text-sm text-slate-700">
        Quantities are for the {d.ingredients.kitchenServings} servings the kitchen will cook. Ingredients the pantry can cover are reserved automatically when you commit, so you only buy what is truly missing. Your pledge is recorded as <strong>promised</strong>; stock increases only when the shelter receives it.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Ingredient requirements and shortages</caption>
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr>
              <th scope="col" className="py-2">Bring?</th>
              <th scope="col">Ingredient</th>
              <th scope="col" className="text-right">Required</th>
              <th scope="col" className="text-right">In pantry</th>
              <th scope="col" className="text-right">Allocated elsewhere</th>
              <th scope="col" className="text-right">Reserved here</th>
              <th scope="col" className="text-right">Pledged</th>
              <th scope="col" className="text-right">Pantry will cover</th>
              <th scope="col" className="text-right">Still needed</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const can = l.shortage.base > 0 && !disabled;
              const checked = sel[l.ingredientId] !== undefined;
              return (
                <tr key={l.ingredientId} className="border-b border-slate-100 align-middle">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      aria-label={`Bring ${l.name}`}
                      disabled={!can}
                      checked={checked}
                      onChange={(e) => setSel((s) => {
                        const n = { ...s };
                        if (e.target.checked) n[l.ingredientId] = String(toUnits(l, l.shortage.base));
                        else delete n[l.ingredientId];
                        return n;
                      })}
                    />
                  </td>
                  <td className="font-medium">{l.name}</td>
                  <td className="text-right">{l.required.display}</td>
                  <td className="text-right">{l.onHand.display}</td>
                  <td className="text-right">{l.allocatedElsewhere.display}</td>
                  <td className="text-right">{l.reservedHere.display}</td>
                  <td className="text-right">{l.pledged.display}</td>
                  <td className="text-right">{l.pantryCanCover.display}</td>
                  <td className="text-right font-semibold">
                    {checked ? (
                      <span className="inline-flex items-center gap-1">
                        <label htmlFor={`q-${l.ingredientId}`} className="sr-only">Quantity of {l.name} in {l.shortage.unit}</label>
                        <input id={`q-${l.ingredientId}`} inputMode="decimal" value={sel[l.ingredientId]} onChange={(e) => setSel((s) => ({ ...s, [l.ingredientId]: e.target.value }))} className="w-20 rounded border border-slate-300 px-2 py-1 text-right" />
                        <span>{l.shortage.unit}</span>
                      </span>
                    ) : (
                      l.shortage.display
                    )}
                  </td>
                  <td><StatusBadge status={l.status} size="sm" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open.length === 0 && <p className="text-sm text-slate-700">No ingredient shortages remain for donors.</p>}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      <button type="submit" disabled={disabled || busy || open.length === 0} className={btn}>{busy ? "Saving…" : "Commit groceries"}</button>
    </form>
  );
}

function PantryPanel({ d, busy, disabled, onSubmit, goGroceries }: { d: MealDetail; busy: boolean; disabled: boolean; onSubmit: () => Promise<boolean>; goGroceries: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const lines = d.ingredients.lines.filter((l) => !l.removed);
  if (lines.length === 0) return <p className="text-sm text-slate-700">This meal has no recipe ingredients.</p>;
  const openLines = lines.filter((l) => l.required.base > l.reservedHere.base + l.pledged.base);
  const short = lines.filter((l) => l.shortage.base > 0);
  const possible = !disabled && openLines.length > 0 && short.length === 0;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-slate-100 text-sm">
        {lines.map((l) => (
          <li key={l.ingredientId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="font-medium">{l.name}</span>
            <span>needs {l.required.display} · pantry available {l.pantryAvailable.display} · will reserve {l.pantryCanCover.display}{l.shortage.base > 0 && <strong className="ml-1 text-red-800">· short {l.shortage.display}</strong>}</span>
          </li>
        ))}
      </ul>
      {openLines.length === 0 ? (
        <p className="text-sm text-slate-700">All ingredients are already covered for this meal.</p>
      ) : short.length > 0 ? (
        <div className="rounded border border-yellow-400 bg-yellow-50 p-3 text-sm">
          <p>The pantry cannot cover every ingredient, so a full pantry allocation isn&apos;t possible. Bring groceries for the shortages; whatever the pantry has will be reserved at the same time.</p>
          <button type="button" onClick={goGroceries} className="mt-2 rounded border border-slate-400 bg-white px-3 py-1.5 font-medium">Go to Bring groceries</button>
        </div>
      ) : confirming ? (
        <div role="dialog" aria-modal="false" aria-labelledby="confirm-pantry" className="rounded border border-slate-300 bg-slate-50 p-4">
          <p id="confirm-pantry" className="font-medium">Reserve these pantry quantities for {d.dishName}? Other meals will no longer be able to use them.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={async () => { if (await onSubmit()) setConfirming(false); }} className={btn}>{busy ? "Reserving…" : "Confirm allocation"}</button>
            <button type="button" onClick={() => setConfirming(false)} className="rounded border border-slate-300 bg-white px-4 py-2">Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={!possible || busy} onClick={() => setConfirming(true)} className={btn}>Use pantry supplies</button>
      )}
    </div>
  );
}

function ServingPanel({ d, busy, disabled, onSubmit }: { d: MealDetail; busy: boolean; disabled: boolean; onSubmit: () => Promise<boolean> }) {
  const [confirming, setConfirming] = useState(false);
  const mine = d.mine.some((c) => c.type === "SERVING");
  if (mine) return <p className="text-sm text-slate-700">You are booked to serve this meal.</p>;
  if (d.serving.remaining <= 0) return <p className="text-sm text-slate-700">The serving assignment for this meal is already taken. Food requirements may still need help.</p>;
  return confirming ? (
    <div className="rounded border border-slate-300 bg-slate-50 p-4">
      <p className="font-medium">Confirm you (or your group) will serve {PERIOD_LABEL[d.period].toLowerCase()} on {pretty(d.date)}?</p>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={async () => { if (await onSubmit()) setConfirming(false); }} className={btn}>{busy ? "Booking…" : "Confirm"}</button>
        <button type="button" onClick={() => setConfirming(false)} className="rounded border border-slate-300 bg-white px-4 py-2">Cancel</button>
      </div>
    </div>
  ) : (
    <div className="space-y-2">
      <p className="text-sm text-slate-700">The serving assignment is open ({d.serving.remaining} of {d.serving.capacity} available). Serving is tracked separately from food.</p>
      <button type="button" disabled={disabled} onClick={() => setConfirming(true)} className={btn}>Volunteer to serve</button>
    </div>
  );
}

function Commitments({ title, items, empty, showNames }: { title: string; items: MealDetail["mine"]; empty: string; showNames?: boolean }) {
  return (
    <section aria-label={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100 text-sm">
          {items.map((c) => (
            <li key={c.id} className="py-2">
              <span className="font-medium">{TYPE_LABEL[c.type]}</span>
              {c.servings ? ` · ${c.servings} servings` : ""}
              {c.lines.length > 0 && ` · ${c.lines.map((l) => `${l.ingredientName} ${l.quantity}`).join(", ")}`}
              {showNames && c.volunteerName && <span className="text-slate-600"> · by {c.volunteerName}</span>}
              {c.organizationName && !showNames && <span className="text-slate-600"> · for {c.organizationName}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
