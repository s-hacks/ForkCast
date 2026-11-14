"use client";
/**
 * Admin meal-plan editor. All validation and conflict detection is server-side (D-14);
 * this form only collects input and surfaces server responses.
 */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, newKey, type ApiError } from "@/lib/api-client";

export type PantryOption = { id: string; name: string; units: string[]; displayUnit: string };
type Row = { pantryItemId: string; quantity: string; unit: string };
type Conflict = { kind: string; message: string };

export interface EditorProps {
  mode: "create" | "edit";
  items: PantryOption[];
  initial: {
    date: string;
    period: "BREAKFAST" | "LUNCH" | "DINNER";
    dishName: string;
    servingsTarget: number;
    recipeYield: number;
    serviceCapacity: number;
    ingredients: { pantryItemId: string; quantity: number; unit: string }[];
  };
  planId?: string;
  version?: number;
  planStatus?: string;
}

const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm";

export function MealEditor(props: EditorProps) {
  const router = useRouter();
  const { items, mode } = props;
  const [date, setDate] = useState(props.initial.date);
  const [period, setPeriod] = useState(props.initial.period);
  const [dishName, setDishName] = useState(props.initial.dishName);
  const [servings, setServings] = useState(String(props.initial.servingsTarget || ""));
  const [yieldS, setYield] = useState(String(props.initial.recipeYield || ""));
  const [yieldTouched, setYieldTouched] = useState(mode === "edit");
  const [capacity, setCapacity] = useState(String(props.initial.serviceCapacity || 1));
  const [rows, setRows] = useState<Row[]>(props.initial.ingredients.map((i) => ({ pantryItemId: i.pantryItemId, quantity: String(i.quantity), unit: i.unit })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [pendingAction, setPendingAction] = useState<"save" | "cancel" | null>(null);

  const itemById = new Map(items.map((i) => [i.id, i]));

  function payload() {
    return {
      dishName,
      servingsTarget: Number(servings),
      recipeYield: Number(yieldS || servings),
      serviceCapacity: Number(capacity),
      ingredients: rows
        .filter((r) => r.pantryItemId)
        .map((r) => ({ pantryItemId: r.pantryItemId, quantity: Number(r.quantity), unit: r.unit })),
    };
  }

  function handleErr(e: ApiError, action: "save" | "cancel") {
    if (e.code === "PLAN_CONFLICT") {
      setConflicts((e.conflicts as Conflict[]) ?? []);
      setPendingAction(action);
      setError(null);
    } else {
      setError(e);
    }
  }

  async function save(publish: boolean, acknowledge = false) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    if (mode === "create") {
      const r = await apiFetch<{ slotId: string }>("/api/v1/admin/meal-plans", { method: "POST", body: { ...payload(), date, period, publish }, key: newKey() });
      setBusy(false);
      if (!r.ok) return handleErr(r.error, "save");
      router.push(`/admin/meals/${r.data.slotId}`);
      router.refresh();
      return;
    }
    const r = await apiFetch<{ conflicts: Conflict[] }>(`/api/v1/admin/meal-plans/${props.planId}`, {
      method: "PUT",
      body: { ...payload(), version: props.version, acknowledgeConflicts: acknowledge || undefined },
      key: newKey(),
    });
    setBusy(false);
    if (!r.ok) return handleErr(r.error, "save");
    setConflicts(null);
    setPendingAction(null);
    setSuccess(r.data.conflicts.length ? "Saved with override. Affected commitments now show “Needs attention”." : "Meal plan saved.");
    router.refresh();
  }

  async function simple(path: string, msg: string, body?: unknown) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const r = await apiFetch(path, { method: "POST", body, key: newKey() });
    setBusy(false);
    if (!r.ok) return handleErr(r.error, "cancel");
    setConflicts(null);
    setPendingAction(null);
    setSuccess(msg);
    router.refresh();
  }

  const fe = error?.fieldErrors ?? {};
  const isDraft = props.planStatus === "DRAFT";
  const isPublished = props.planStatus === "PUBLISHED";

  return (
    <form
      className="space-y-5 rounded-lg border border-slate-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save(false);
      }}
      aria-describedby={error ? "editor-error" : undefined}
    >
      {mode === "create" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">
            Date
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={input} />
          </label>
          <label className="block text-sm font-medium">
            Meal period
            <select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className={input}>
              <option value="BREAKFAST">Breakfast</option>
              <option value="LUNCH">Lunch</option>
              <option value="DINNER">Dinner</option>
            </select>
          </label>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium sm:col-span-2">
          Dish name
          <input required value={dishName} onChange={(e) => setDishName(e.target.value)} className={input} aria-invalid={!!fe.dishName} />
          {fe.dishName && <span className="text-xs text-red-700">{fe.dishName.join(", ")}</span>}
        </label>
        <label className="block text-sm font-medium">
          Servings required
          <input
            type="number"
            min={1}
            step={1}
            required
            inputMode="numeric"
            value={servings}
            onChange={(e) => {
              setServings(e.target.value);
              if (!yieldTouched) setYield(e.target.value);
            }}
            className={input}
          />
          {fe.servingsTarget && <span className="text-xs text-red-700">{fe.servingsTarget.join(", ")}</span>}
        </label>
        <label className="block text-sm font-medium">
          Serving volunteer capacity
          <input type="number" min={1} max={50} step={1} required value={capacity} onChange={(e) => setCapacity(e.target.value)} className={input} />
        </label>
        <label className="block text-sm font-medium sm:col-span-2">
          Recipe yield (servings)
          <input
            type="number"
            min={1}
            step={1}
            required
            value={yieldS}
            onChange={(e) => {
              setYield(e.target.value);
              setYieldTouched(true);
            }}
            className={input}
            aria-describedby="yield-help"
          />
          <span id="yield-help" className="text-xs font-normal text-slate-600">
            The ingredient quantities below are for this many servings. Demand is scaled to the portion not covered by prepared food.
          </span>
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Ingredients ({rows.length})</legend>
        {rows.length === 0 && <p className="text-sm text-slate-600">No ingredients: this meal can only be covered by prepared food.</p>}
        {rows.map((r, idx) => {
          const item = itemById.get(r.pantryItemId);
          return (
            <div key={idx} className="grid grid-cols-12 items-end gap-2">
              <label className="col-span-12 text-xs font-medium sm:col-span-5">
                Pantry item
                <select
                  value={r.pantryItemId}
                  onChange={(e) => {
                    const it = itemById.get(e.target.value);
                    setRows(rows.map((x, i) => (i === idx ? { ...x, pantryItemId: e.target.value, unit: it?.displayUnit ?? x.unit } : x)));
                  }}
                  className={input}
                >
                  <option value="">Select…</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-5 text-xs font-medium sm:col-span-3">
                Quantity
                <input type="number" min={0} step="any" required value={r.quantity} onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))} className={input} />
              </label>
              <label className="col-span-4 text-xs font-medium sm:col-span-2">
                Unit
                <select value={r.unit} onChange={(e) => setRows(rows.map((x, i) => (i === idx ? { ...x, unit: e.target.value } : x)))} className={input}>
                  {(item?.units ?? ["g", "kg", "oz", "lb", "ml", "l", "each"]).map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => setRows(rows.filter((_, i) => i !== idx))} className="col-span-3 rounded-md border border-slate-300 px-2 py-2 text-sm sm:col-span-2" aria-label={`Remove ingredient ${item?.name ?? idx + 1}`}>
                Remove
              </button>
            </div>
          );
        })}
        <button type="button" onClick={() => setRows([...rows, { pantryItemId: "", quantity: "", unit: "kg" }])} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
          + Add ingredient
        </button>
        {fe.ingredients && <p className="text-xs text-red-700">{fe.ingredients.join(", ")}</p>}
      </fieldset>

      {error && (
        <div id="editor-error" role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error.message}
        </div>
      )}
      {success && (
        <div role="status" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          {success}
        </div>
      )}
      {conflicts && (
        <div role="alert" className="space-y-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-semibold">This change conflicts with existing volunteer commitments:</p>
          <ul className="list-disc pl-5">
            {conflicts.map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => (pendingAction === "cancel" ? simple(`/api/v1/admin/meal-plans/${props.planId}/cancel`, "Meal cancelled.", { acknowledgeConflicts: true }) : save(false, true))}
              className="rounded-md bg-amber-700 px-3 py-1.5 font-medium text-white"
            >
              {pendingAction === "cancel" ? "Cancel meal anyway (commitments will be cancelled, kept in history)" : "Save anyway (volunteer commitments will be flagged “Needs attention”, never deleted)"}
            </button>
            <button type="button" onClick={() => setConflicts(null)} className="rounded-md border border-slate-300 bg-white px-3 py-1.5">
              Go back
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {mode === "create" ? (
          <>
            <button type="submit" disabled={busy} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium">
              Save draft
            </button>
            <button type="button" disabled={busy} onClick={() => save(true)} className="rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white">
              Save &amp; publish
            </button>
          </>
        ) : (
          <>
            <button type="submit" disabled={busy || props.planStatus === "COMPLETED" || props.planStatus === "CANCELLED"} className="rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {busy ? "Saving…" : "Save changes"}
            </button>
            {isDraft && (
              <button type="button" disabled={busy} onClick={() => simple(`/api/v1/admin/meal-plans/${props.planId}/publish`, "Meal published. Volunteers can now see it.")} className="rounded-md border border-green-700 px-4 py-2 text-sm font-medium text-green-800">
                Publish
              </button>
            )}
            {isPublished && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm("Mark this meal served? Its pantry reservations become consumption (stock is reduced automatically — do not also adjust stock manually).")) simple(`/api/v1/admin/meal-plans/${props.planId}/served`, "Meal marked served; reservations consumed.");
                }}
                className="rounded-md border border-slate-400 px-4 py-2 text-sm font-medium"
              >
                Mark served
              </button>
            )}
            {(isDraft || isPublished) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm("Cancel this meal?")) simple(`/api/v1/admin/meal-plans/${props.planId}/cancel`, "Meal cancelled.");
                }}
                className="rounded-md border border-red-400 px-4 py-2 text-sm font-medium text-red-800"
              >
                Cancel meal
              </button>
            )}
          </>
        )}
      </div>
      {isPublished && <p className="text-xs text-slate-600">“Mark served” converts this meal&apos;s pantry reservations into consumption. Do not also enter a manual stock adjustment for the same food.</p>}
    </form>
  );
}
