import { pageVolunteer } from "@/server/auth/guards";
import { listMyCommitments } from "@/server/services/context";
import { AppHeader, contextLabelOf } from "@/components/app-header";
import { CommitmentList } from "@/components/volunteer/commitment-list";

export const dynamic = "force-dynamic";

export default async function CommitmentsPage() {
  const s = await pageVolunteer();
  const [upcoming, past] = await Promise.all([listMyCommitments(s.user.id, "upcoming"), listMyCommitments(s.user.id, "past")]);
  return (
    <>
      <AppHeader name={s.user.displayName} contextLabel={contextLabelOf(s.context)} />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <h1 className="text-2xl font-bold">My commitments</h1>
        <section aria-labelledby="up-h" className="mt-6">
          <h2 id="up-h" className="text-lg font-semibold">Upcoming</h2>
          <CommitmentList items={upcoming} empty="No upcoming commitments. Pick a meal on the calendar to help." />
        </section>
        <section aria-labelledby="past-h" className="mt-8">
          <h2 id="past-h" className="text-lg font-semibold">Past</h2>
          <CommitmentList items={past} empty="No past commitments yet." />
        </section>
      </main>
    </>
  );
}
