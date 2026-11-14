import Link from "next/link";
import { pageVolunteer } from "@/server/auth/guards";
import { prisma } from "@/server/db/client";
import { livePlanIdForSlot, mealDetail } from "@/server/services/meals";
import { viewerOf } from "@/server/services/commitments";
import { DomainError } from "@/server/domain/errors";
import { AppHeader, contextLabelOf } from "@/components/app-header";
import { MealActions } from "@/components/volunteer/meal-actions";

export const dynamic = "force-dynamic";

export default async function MealPage({ params }: { params: Promise<{ slotId: string }> }) {
  const s = await pageVolunteer();
  const { slotId } = await params;
  const viewer = viewerOf(s);
  let detail = null;
  try {
    detail = await mealDetail(prisma, await livePlanIdForSlot(prisma, slotId, viewer), viewer);
  } catch (e) {
    if (!(e instanceof DomainError && e.code === "NOT_FOUND")) throw e;
  }
  return (
    <>
      <AppHeader name={s.user.displayName} contextLabel={contextLabelOf(s.context)} />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Link href={detail ? `/calendar?date=${detail.date}` : "/calendar"} className="text-sm text-blue-700 underline">← Back to calendar</Link>
        {detail ? (
          <MealActions initial={detail} contextType={s.context.type} />
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <h1 className="text-xl font-semibold">Not scheduled</h1>
            <p className="mt-2 text-slate-600">No meal has been published for this slot yet. Please check back later.</p>
          </div>
        )}
      </main>
    </>
  );
}
