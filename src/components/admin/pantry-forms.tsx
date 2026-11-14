"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, newKey, type ApiError } from "@/lib/api-client";

const input = "mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm";
const KIND_UNITS: Record<string, string[]> = { MASS: ["g", "kg", "oz", "lb"], VOLUME: ["ml", "l"], COUNT: ["each"] };

export function AddItemForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("MASS");
  const [unit, setUnit] = useState("kg");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-5 sm:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        setOk(null);
        const r = await apiFetch("/api/v1/admin/pantry", {
          method: "POST",
          key: newKey(),
          body: { name, unitKind: kind, displayUnit: unit, initialQuantity: qty ? Number(qty) : undefined },
        });
        setBusy(false);
        if (!r.ok) return setErr(r.error);
        setOk(`Added ${name}.`);
        setName("");
        setQty("");
        router.refresh();
      }}
    >
      <label className="text-sm font-medium sm:col-span-2">
        Item name
        <input required value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </label>
      <label className="text-sm font-medium">
        Unit kind
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setUnit(KIND_UNITS[e.target.value][0]);
          }}
          className={input}
        >
          <option value="MASS">Weight</option>
          <option value="VOLUME">Volume</option>
          <option value="COUNT">Count</option>
        </select>
      </label>
      <label className="text-sm font-medium">
        Display unit
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className={input}>
          {KIND_UNITS[kind].map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Initial quantity ({unit})
        <input type="number" min={0} step="any" value={qty} onChange={(e) => setQty(e.target.value)} className={input} />
      </label>
      <div className="sm:col-span-5 flex items-center gap-3">
        <button disabled={busy} className="rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {busy ? "Adding…" : "Add pantry item"}
        </button>
        {err && <span role="alert" className="text-sm text-red-800">{err.message}</span>}
        {ok && <span role="status" className="text-sm text-green-800">{ok}</span>}
      </div>
    </form>
  );
}

export function AdjustForm({ itemId, itemName, units, displayUnit }: { itemId: string; itemName: string; units: string[]; displayUnit: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"RECEIPT" | "ADJUSTMENT" | "CORRECTION">("RECEIPT");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState(displayUnit);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | null>(null);
  const [affected, setAffected] = useState<string[] | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(acknowledge: boolean) {
    setBusy(true);
    setErr(null);
    setOk(null);
    const body =
      mode === "CORRECTION"
        ? { mode, countedQuantity: Number(qty), unit, reason, acknowledgeConflicts: acknowledge || undefined }
        : { mode, quantity: Number(qty), unit, reason, acknowledgeConflicts: acknowledge || undefined };
    const r = await apiFetch<{ onHand: string; reserved: string }>(`/api/v1/admin/pantry/${itemId}/adjustments`, { method: "POST", body, key: newKey() });
    setBusy(false);
    if (!r.ok) {
      if (r.error.code === "RESERVATION_CONFLICT") {
        setAffected((r.error.affected as string[]) ?? []);
        setErr(r.error);
        return;
      }
      return setErr(r.error);
    }
    setAffected(null);
    setOk(`Saved. On hand ${r.data.onHand}, reserved ${r.data.reserved}.`);
    setQty("");
    setReason("");
    router.refresh();
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium" aria-label={`Adjust stock for ${itemName}`}>
        Adjust
      </button>
    );
  return (
    <form
      className="mt-2 grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-left sm:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      aria-label={`Adjust stock for ${itemName}`}
    >
      <label className="text-xs font-medium">
        Type
        <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className={input}>
          <option value="RECEIPT">Receipt (+ incoming stock)</option>
          <option value="ADJUSTMENT">Adjustment (± change)</option>
          <option value="CORRECTION">Correction (counted total)</option>
        </select>
      </label>
      <label className="text-xs font-medium">
        {mode === "CORRECTION" ? "Counted total" : "Quantity"}
        <input type="number" step="any" required value={qty} onChange={(e) => setQty(e.target.value)} className={input} min={mode === "ADJUSTMENT" ? undefined : 0} />
      </label>
      <label className="text-xs font-medium">
        Unit
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className={input}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium">
        Reason (required)
        <input required value={reason} onChange={(e) => setReason(e.target.value)} className={input} placeholder="e.g. Delivery from food bank" />
      </label>
      {err && (
        <div role="alert" className="sm:col-span-4 rounded border border-amber-400 bg-amber-50 p-2 text-xs text-amber-950">
          <p>{err.message}</p>
          {affected && (
            <>
              <p className="mt-1 font-semibold">Affected meals:</p>
              <ul className="list-disc pl-5">
                {affected.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <button type="button" disabled={busy} onClick={() => submit(true)} className="mt-2 rounded bg-amber-700 px-2 py-1 font-medium text-white">
                Apply anyway (reservations for the latest meals are reduced and their shortages reopen)
              </button>
            </>
          )}
        </div>
      )}
      {ok && <p role="status" className="sm:col-span-4 text-xs text-green-800">{ok}</p>}
      <div className="sm:col-span-4 flex gap-2">
        <button disabled={busy} className="rounded bg-red-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save adjustment"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded border border-slate-300 px-3 py-1.5 text-xs">
          Close
        </button>
      </div>
    </form>
  );
}

export function ReceiveForm({ lineId, units, unit: defUnit, label }: { lineId: string; units: string[]; unit: string; label: string }) {
  const router = useRouter();
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState(defUnit);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      aria-label={`Record receipt for ${label}`}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const r = await apiFetch(`/api/v1/admin/groceries/${lineId}/receive`, { method: "POST", key: newKey(), body: { receivedQuantity: Number(qty), unit } });
        setBusy(false);
        if (!r.ok) return setErr(r.error.message);
        router.refresh();
      }}
    >
      <label className="text-xs font-medium">
        Received
        <input type="number" min={0} step="any" required value={qty} onChange={(e) => setQty(e.target.value)} className={`${input} w-24`} />
      </label>
      <label className="text-xs font-medium">
        Unit
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className={input}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
      </label>
      <button disabled={busy} className="rounded bg-red-800 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
        {busy ? "Saving…" : "Record receipt"}
      </button>
      {err && <span role="alert" className="text-xs text-red-800">{err}</span>}
    </form>
  );
}
