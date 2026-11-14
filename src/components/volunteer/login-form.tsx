"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function LoginForm({ portal }: { portal: "user" | "admin" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const r = await apiFetch<{ user: { role: string } }>("/api/v1/auth/login", {
      method: "POST",
      body: { username: String(f.get("username") ?? ""), password: String(f.get("password") ?? ""), portal },
    });
    if (!r.ok) {
      setError(r.error.message);
      setBusy(false);
      return;
    }
    router.push(r.data.user.role === "ADMIN" ? "/admin" : "/context");
    router.refresh();
  }

  const input = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20";
  const tab = (active: boolean) => `flex-1 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${active ? "bg-white text-brand shadow" : "text-slate-600 hover:text-brand"}`;
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
      <nav aria-label="Sign in as" className="flex rounded-xl bg-slate-200/70 p-1">
        <Link href="/login?as=user" className={tab(portal === "user")} aria-current={portal === "user" ? "page" : undefined}>Volunteer</Link>
        <Link href="/login?as=admin" className={tab(portal === "admin")} aria-current={portal === "admin" ? "page" : undefined}>Administrator</Link>
      </nav>
      <div>
        <label htmlFor="username" className="block text-sm font-medium">Username</label>
        <input id="username" name="username" autoComplete="username" required className={input} />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={input} />
      </div>
      {error && (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
      )}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white shadow-sm transition hover:shadow-lg disabled:opacity-50">
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-slate-500">
        Demo: {portal === "admin" ? "admin" : "maria, james, aisha, sam"}
      </p>
    </form>
  );
}
