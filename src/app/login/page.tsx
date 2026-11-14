import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { LoginForm } from "@/components/volunteer/login-form";
import { BrandPanel, Logo } from "@/components/brand-panel";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const s = await getSession();
  if (s) redirect(s.user.role === "ADMIN" ? "/admin" : "/context");
  const portal = (await searchParams).as === "admin" ? "admin" : "user";
  return (
    <main id="main" className="grid flex-1 lg:grid-cols-2">
      <div className="hidden lg:block">
        <BrandPanel headline={portal === "admin" ? "Plan the week." : "Find where you can help."} />
      </div>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 text-brand lg:hidden" />
          <h2 className="text-3xl font-bold tracking-tight">{portal === "admin" ? "Administrator sign in" : "Volunteer sign in"}</h2>
          <LoginForm portal={portal} />
        </div>
      </section>
    </main>
  );
}
