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

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
      <div>
        <label htmlFor="username" className="block text-sm font-medium">Username</label>
        <input id="username" name="username" autoComplete="username" required className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="mt-1 w-full rounded border border-slate-300 px-3 py-2" />
      </div>
      {error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
      )}
      <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white disabled:opacity-50">
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-slate-500">
        Demo accounts: {portal === "admin" ? "admin" : "maria, james, aisha, sam"} (passwords are in the README / your .env).
      </p>
      <p className="text-sm">
        {portal === "admin" ? <Link href="/login?as=user" className="text-blue-700 underline">Volunteer sign in instead</Link> : <Link href="/login?as=admin" className="text-blue-700 underline">Administrator sign in instead</Link>}
      </p>
    </form>
  );
}
