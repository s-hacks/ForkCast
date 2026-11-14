import Link from "next/link";
import { LogoutButton } from "./volunteer/logout-button";

/** Volunteer header: shows participation context (D-22) and primary navigation. */
export function AppHeader({ name, contextLabel }: { name: string; contextLabel: string | null }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/calendar" className="text-lg font-bold tracking-tight text-brand">
          ForkCast
        </Link>
        <nav aria-label="Main" className="flex items-center gap-4 text-sm font-medium">
          <Link href="/calendar" className="hover:underline">Calendar</Link>
          <Link href="/commitments" className="hover:underline">My commitments</Link>
        </nav>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-sm">
          {contextLabel && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              {contextLabel}{" "}
              <Link href="/context" className="ml-1 font-medium text-blue-700 underline">Change</Link>
            </span>
          )}
          <span className="text-slate-600">{name}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

export function contextLabelOf(ctx: { type: "SOLO" } | { type: "ORGANIZATION"; organizationName: string } | null): string | null {
  if (!ctx) return null;
  return ctx.type === "SOLO" ? "Volunteering solo" : `Representing ${ctx.organizationName}`;
}
