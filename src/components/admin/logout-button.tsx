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
      className="rounded-md border border-white/40 px-3 py-1.5 text-sm font-medium hover:bg-white/10 disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Log out"}
    </button>
  );
}
