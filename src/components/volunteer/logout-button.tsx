"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await apiFetch("/api/v1/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
      className="rounded border border-slate-300 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-50"
    >
      Log out
    </button>
  );
}
