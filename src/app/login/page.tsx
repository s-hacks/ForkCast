import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { LoginForm } from "@/components/volunteer/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const s = await getSession();
  if (s) redirect(s.user.role === "ADMIN" ? "/admin" : "/context");
  const portal = (await searchParams).as === "admin" ? "admin" : "user";
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">Firehouse Ministries</p>
      <h1 className="mt-2 text-3xl font-bold">{portal === "admin" ? "Administrator sign in" : "Volunteer sign in"}</h1>
      <LoginForm portal={portal} />
    </main>
  );
}
