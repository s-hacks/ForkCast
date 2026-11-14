"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function ContextPicker({ orgs, current }: { orgs: { id: string; name: string; kind: string }[]; current: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: string) {
    setBusy(id);
    setError(null);
    const body = id === "SOLO" ? { type: "SOLO" } : { type: "ORGANIZATION", organizationId: id };
    const r = await apiFetch("/api/v1/me/context", { method: "PUT", body });
    if (!r.ok) {
      setError(r.error.message);
      setBusy(null);
      return;
    }
    router.push("/calendar");
    router.refresh();
  }

  const btn = (id: string, title: string, sub: string) => (
    <button
      key={id}
      type="button"
      disabled={busy !== null}
      onClick={() => choose(id)}
      aria-pressed={current === id}
      className={`w-full rounded-lg border p-4 text-left hover:border-slate-500 disabled:opacity-60 ${current === id ? "border-blue-600 ring-2 ring-blue-200" : "border-slate-300 bg-white"}`}
    >
      <span className="block font-semibold">{title}{current === id && <span className="ml-2 text-sm font-normal text-blue-700">(current)</span>}</span>
      <span className="block text-sm text-slate-600">{busy === id ? "Saving…" : sub}</span>
    </button>
  );

  return (
    <div className="mt-6 space-y-6">
      <section aria-labelledby="solo-h">
        <h2 id="solo-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Individually</h2>
        {btn("SOLO", "Volunteer solo", "You see all meals and their overall availability.")}
      </section>
      <section aria-labelledby="org-h">
        <h2 id="org-h" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">On behalf of an organization</h2>
        {orgs.length === 0 ? (
          <p className="rounded border border-dashed border-slate-300 p-4 text-sm text-slate-600">You are not a member of any organization yet. Ask the shelter to add you.</p>
        ) : (
          <div className="space-y-2">{orgs.map((o) => btn(o.id, o.name, `${o.kind} · see your group's commitments`))}</div>
        )}
      </section>
      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
    </div>
  );
}
