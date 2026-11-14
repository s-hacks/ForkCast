import Link from "next/link";
import { notFound } from "next/navigation";
import { pageAdmin } from "@/server/auth/guards";
import { itemTransactions } from "@/server/services/admin";
import { DomainError } from "@/server/domain/errors";

export const dynamic = "force-dynamic";

export default async function ItemHistory({ params }: { params: Promise<{ id: string }> }) {
  await pageAdmin();
  const { id } = await params;
  let data: Awaited<ReturnType<typeof itemTransactions>>;
  try {
    data = await itemTransactions(id);
  } catch (e) {
    if (e instanceof DomainError) notFound();
    throw e;
  }
  return (
    <div className="space-y-4">
      <Link href="/admin/pantry" className="text-sm text-blue-700 underline">← Back to pantry</Link>
      <h1 className="text-2xl font-bold">{data.item.name}: inventory history</h1>
      <p className="text-sm text-slate-600">Append-only ledger. Every stock change, reservation and release is recorded here.</p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Inventory transactions</caption>
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">Time</th>
              <th scope="col" className="px-3 py-2">Type</th>
              <th scope="col" className="px-3 py-2">Δ on hand</th>
              <th scope="col" className="px-3 py-2">Δ reserved</th>
              <th scope="col" className="px-3 py-2">On hand after</th>
              <th scope="col" className="px-3 py-2">Reserved after</th>
              <th scope="col" className="px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-slate-500">No transactions yet.</td>
              </tr>
            )}
            {data.transactions.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(t.createdAt).toLocaleString("en-US", { timeZone: "America/Chicago" })}</td>
                <td className="px-3 py-2">{t.type.replace("_", " ").toLowerCase()}</td>
                <td className="px-3 py-2">{t.deltaOnHand}</td>
                <td className="px-3 py-2">{t.deltaReserved}</td>
                <td className="px-3 py-2">{t.onHandAfter}</td>
                <td className="px-3 py-2">{t.reservedAfter}</td>
                <td className="px-3 py-2">{t.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
