import Link from "next/link";
import { pageAdmin } from "@/server/auth/guards";
import { config } from "@/server/config";
import { monthRange, todayIn } from "@/server/domain/dates";
import { listSlots } from "@/server/services/meals";
import { SlotTable } from "@/components/admin/slot-table";

export const dynamic = "force-dynamic";

function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function AdminMeals({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const s = await pageAdmin();
  const sp = await searchParams;
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : todayIn(config().SHELTER_TIMEZONE).slice(0, 7);
  const { from, to } = monthRange(month);
  const slots = await listSlots(from, to, { userId: s.user.id, role: "ADMIN", context: null });
  const label = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Meal plans · {label}</h1>
        <div className="flex gap-2 text-sm">
          <Link href={`/admin/meals?month=${shiftMonth(month, -1)}`} className="rounded border border-slate-300 bg-white px-3 py-1.5">← Previous month</Link>
          <Link href={`/admin/meals?month=${shiftMonth(month, 1)}`} className="rounded border border-slate-300 bg-white px-3 py-1.5">Next month →</Link>
          <Link href="/admin/meals/new" className="rounded-md bg-red-800 px-3 py-1.5 font-medium text-white">New meal plan</Link>
        </div>
      </div>
      <SlotTable slots={slots} caption={`Meal slots for ${label}`} />
    </div>
  );
}
