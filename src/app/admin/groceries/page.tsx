import { pageAdmin } from "@/server/auth/guards";
import { listIncomingGroceries } from "@/server/services/admin";
import { ReceiveForm } from "@/components/admin/pantry-forms";

export const dynamic = "force-dynamic";

export default async function GroceriesPage() {
  await pageAdmin();
  const lines = await listIncomingGroceries();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Incoming grocery pledges</h1>
      <p className="text-sm text-slate-600">
        Pledged groceries are not stock. Recording a receipt adds the received quantity to the pantry and reserves it for the pledged meal in the same step. If less arrives than was promised, the difference reopens as a shortage.
      </p>
      {lines.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">No outstanding pledges.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Outstanding grocery pledges</caption>
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2">Donor</th>
                <th scope="col" className="px-3 py-2">Meal</th>
                <th scope="col" className="px-3 py-2">Item</th>
                <th scope="col" className="px-3 py-2">Promised</th>
                <th scope="col" className="px-3 py-2">Record receipt</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">{l.donor}</td>
                  <td className="px-3 py-2">{l.meal}</td>
                  <th scope="row" className="px-3 py-2 font-medium">{l.item}</th>
                  <td className="px-3 py-2">{l.quantity}</td>
                  <td className="px-3 py-2">
                    <ReceiveForm lineId={l.id} units={l.units} unit={l.unit} label={`${l.item} from ${l.donor}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
