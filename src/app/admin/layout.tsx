import Link from "next/link";
import { pageAdmin } from "@/server/auth/guards";
import { LogoutButton } from "@/components/admin/logout-button";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/meals", label: "Meal plans" },
  { href: "/admin/pantry", label: "Pantry" },
  { href: "/admin/groceries", label: "Incoming groceries" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await pageAdmin();
  return (
    <>
      <header className="bg-red-800 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="text-lg font-semibold">
            ForkCast · Admin
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span>Signed in as {s.user.displayName}</span>
            <LogoutButton />
          </div>
        </div>
        <nav aria-label="Admin" className="mx-auto max-w-6xl px-4 pb-2">
          <ul className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block rounded px-3 py-1.5 text-sm font-medium hover:bg-white/15">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </>
  );
}
