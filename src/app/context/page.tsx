import { redirect } from "next/navigation";
import { pageUser } from "@/server/auth/guards";
import { listMyOrganizations } from "@/server/services/context";
import { AppHeader, contextLabelOf } from "@/components/app-header";
import { ContextPicker } from "@/components/volunteer/context-picker";

export const dynamic = "force-dynamic";

export default async function ContextPage() {
  const s = await pageUser();
  if (s.user.role === "ADMIN") redirect("/admin");
  const orgs = await listMyOrganizations(s.user.id);
  const current = s.context?.type === "ORGANIZATION" ? s.context.organizationId : s.context ? "SOLO" : null;
  return (
    <>
      <AppHeader name={s.user.displayName} contextLabel={contextLabelOf(s.context)} />
      <main id="main" className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="text-2xl font-bold">How are you participating today?</h1>
        <p className="mt-2 text-slate-600">Your choice is recorded with each commitment so contributions are attributed correctly. You can change it anytime.</p>
        <ContextPicker orgs={orgs} current={current} />
      </main>
    </>
  );
}
