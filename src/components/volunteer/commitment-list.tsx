"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, newKey } from "@/lib/api-client";
import { PERIOD_LABEL, TYPE_LABEL } from "@/components/status";

type Item = {
  id: string; slotId: string; date: string; period: string; dishName: string; planStatus: string; type: string; status: string;
  servings: number | null; contextType: string; organizationName: string | null; lines: { name: string; quantity: string; status: string }[];
  editable: boolean;
};

export function CommitmentList({ items, empty }: { items: Item[]; empty: string }) {
  if (items.length === 0) return <p className="mt-2 rounded border border-dashed border-slate-300 p-4 text-sm text-slate-600">{empty}</p>;
  return <ul className="mt-3 space-y-3">{items.map((c) => <Row key={c.id} c={c} />)}</ul>;
}

function Row({ c }: { c: Item }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "cancel" | "edit">("view");
  const [servings, setServings] = useState(String(c.servings ?? ""));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const date = new Date(`${c.date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  async function run(path: string, method: string, body: unknown, ok: string) {
    setBusy(true);
    setMsg(null);
    const r = await apiFetch(path, { method, body, key: newKey() });
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: ok });
      setMode("view");
      router.refresh();
    } else setMsg({ ok: false, text: r.error.message });
  }

  const cancelled = c.status === "CANCELLED";
  return (
    <li className={`rounded-lg border bg-white p-4 shadow-sm ${cancelled ? "border-slate-200 opacity-70" : "border-slate-300"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/meals/${c.slotId}`} className="font-semibold text-blue-800 underline">{date} · {PERIOD_LABEL[c.period]} · {c.dishName}</Link>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium">{TYPE_LABEL[c.type]}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cancelled ? "bg-slate-200 text-slate-700" : "bg-green-100 text-green-900"}`}>{cancelled ? "Cancelled" : "Active"}</span>
        {c.planStatus === "CANCELLED" && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-900">Meal cancelled</span>}
      </div>
      <p className="mt-1 text-sm text-slate-700">
        {c.servings ? `${c.servings} servings` : ""}
        {c.lines.length > 0 && c.lines.map((l) => `${l.name} ${l.quantity}${l.status !== "PROMISED" && l.status !== "ACTIVE" ? ` (${l.status.toLowerCase()})` : ""}`).join(", ")}
        {c.type === "SERVING" && "Serving assignment"}
        <span className="text-slate-500"> · {c.contextType === "SOLO" ? "Solo" : `For ${c.organizationName}`}</span>
      </p>
      {c.editable && mode === "view" && (
        <div className="mt-2 flex gap-2">
          {c.type === "PREPARED_FOOD" && <button type="button" onClick={() => setMode("edit")} className="rounded border border-slate-300 px-3 py-1 text-sm">Change servings</button>}
          <button type="button" onClick={() => setMode("cancel")} className="rounded border border-red-300 px-3 py-1 text-sm text-red-800">Cancel commitment</button>
        </div>
      )}
      {mode === "cancel" && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-3 text-sm">
          <p>Cancel this commitment? The capacity will reopen for other volunteers.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => run(`/api/v1/commitments/${c.id}/cancel`, "POST", {}, "Commitment cancelled.")} className="rounded bg-red-700 px-3 py-1 font-medium text-white disabled:opacity-50">{busy ? "Cancelling…" : "Yes, cancel"}</button>
            <button type="button" onClick={() => setMode("view")} className="rounded border border-slate-300 bg-white px-3 py-1">Keep it</button>
          </div>
        </div>
      )}
      {mode === "edit" && (
        <form
          className="mt-2 flex flex-wrap items-end gap-2 text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(servings);
            if (!/^\d+$/.test(servings.trim()) || n < 1) return setMsg({ ok: false, text: "Enter a whole number of at least 1." });
            run(`/api/v1/commitments/${c.id}`, "PATCH", { servings: n }, "Servings updated.");
          }}
        >
          <label className="flex flex-col">
            <span className="font-medium">Servings</span>
            <input inputMode="numeric" value={servings} onChange={(e) => setServings(e.target.value)} className="w-28 rounded border border-slate-300 px-2 py-1" />
          </label>
          <button type="submit" disabled={busy} className="rounded bg-brand px-3 py-1.5 font-medium text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => setMode("view")} className="rounded border border-slate-300 px-3 py-1.5">Cancel</button>
        </form>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`mt-2 text-sm ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>}
    </li>
  );
}
