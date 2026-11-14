import Link from "next/link";
import { TriangleAlert, CircleCheck } from "lucide-react";
import { pageAdmin } from "@/server/auth/guards";
import { listPantry } from "@/server/services/admin";
import { AddItemForm, AdjustForm } from "@/components/admin/pantry-forms";

export const dynamic = "force-dynamic";

export default async function PantryPage() {
  await pageAdmin();
  const items = await listPantry();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Pantry inventory</h1>
      <p className="text-sm text-slate-600">
        <strong>On hand</strong> is physical stock. <strong>Reserved</strong> is held for scheduled meals. <strong>Available</strong> = on hand − reserved.{" "}
        <strong>Pledged</strong> groceries are promises from donors and are not counted as stock until you record a receipt.
      </p>
      <AddItemForm />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-left text-sm">
          <caption className="sr-only">Pantry items</caption>
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2">Item</th>
              <th scope="col" className="px-3 py-2">On hand</th>
              <th scope="col" className="px-3 py-2">Reserved</th>
              <th scope="col" className="px-3 py-2">Available</th>
              <th scope="col" className="px-3 py-2">Pledged (incoming)</th>
              <th scope="col" className="px-3 py-2">Open demand</th>
              <th scope="col" className="px-3 py-2">Status</th>
              <th scope="col" className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-slate-100 align-top">
                <th scope="row" className="px-3 py-2 font-medium">{i.name}</th>
                <td className="px-3 py-2">{i.onHand}</td>
                <td className="px-3 py-2">{i.reserved}</td>
                <td className="px-3 py-2">{i.available}</td>
                <td className="px-3 py-2">{i.pledged}</td>
                <td className="px-3 py-2">{i.openDemand}</td>
                <td className="px-3 py-2">
                  {i.insufficient ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-400 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-900">
                      <TriangleAlert aria-hidden className="h-3 w-3" /> Insufficient
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-700">
                      <CircleCheck aria-hidden className="h-3 w-3" /> OK
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <AdjustForm itemId={i.id} itemName={i.name} units={i.units} displayUnit={i.displayUnit} />
                    <Link href={`/admin/pantry/${i.id}`} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium">History</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
