import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { BrandPanel } from "@/components/brand-panel";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const s = await getSession();
  if (s) redirect(s.user.role === "ADMIN" ? "/admin" : s.context ? "/calendar" : "/context");
  return (
    <main id="main" className="grid flex-1 lg:grid-cols-2">
      <BrandPanel headline="Every meal, covered." />
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="text-3xl font-bold tracking-tight">Welcome</h2>
          <p className="mt-2 text-slate-600">See what each meal still needs, then help.</p>
          <div className="mt-8 space-y-3">
            <Link href="/login?as=user" className="group flex items-center justify-between rounded-2xl bg-brand px-6 py-4 font-semibold text-white shadow-sm transition hover:shadow-lg">
              Enter as Volunteer
              <span aria-hidden className="transition group-hover:translate-x-1">→</span>
            </Link>
            <Link href="/login?as=admin" className="group flex items-center justify-between rounded-2xl border border-slate-300 bg-white px-6 py-4 font-semibold transition hover:border-brand hover:shadow-lg">
              Enter as Administrator
              <span aria-hidden className="transition group-hover:translate-x-1">→</span>
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">Sign-in required for both.</p>
        </div>
      </section>
    </main>
  );
}
