import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const s = await getSession();
  if (s) redirect(s.user.role === "ADMIN" ? "/admin" : s.context ? "/calendar" : "/context");
  return (
    <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">Firehouse Ministries</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Meal scheduling &amp; volunteer coordination</h1>
      <p className="mt-4 text-lg text-slate-700">
        Firehouse serves breakfast, lunch and dinner every day. See what each meal still needs — prepared food,
        groceries, pantry supplies or serving help — and commit without duplicating what others are already bringing.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/login?as=user" className="rounded-lg bg-brand px-6 py-3 text-center font-semibold text-white hover:opacity-90">
          Enter as Volunteer
        </Link>
        <Link href="/login?as=admin" className="rounded-lg border border-slate-400 bg-white px-6 py-3 text-center font-semibold hover:bg-slate-50">
          Enter as Administrator
        </Link>
      </div>
      <p className="mt-4 text-sm text-slate-500">Both options require signing in. Administrator access is granted only to administrator accounts.</p>
    </main>
  );
}
