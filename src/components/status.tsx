/**
 * Status presentation. Colors follow the white / yellow / gray scheme and are ALWAYS paired
 * with an icon and a text label (WCAG: color is never the only signal). Status values come
 * from the server; this component never derives them.
 */
import { CircleDashed, CircleDot, CircleCheck, CircleSlash, TriangleAlert, Clock, Ban, Leaf } from "lucide-react";

export type AnyStatus = "AVAILABLE" | "PARTIAL" | "FULL" | "NOT_NEEDED" | "CONFLICTED" | "UNSCHEDULED" | "CANCELLED" | "CLOSED";

export const STATUS_META: Record<AnyStatus, { label: string; cls: string; Icon: typeof CircleDot; hint: string }> = {
  AVAILABLE: { label: "Available", cls: "bg-white text-slate-900 border-slate-300", Icon: CircleDashed, hint: "Nothing committed yet" },
  PARTIAL: { label: "Partially booked", cls: "bg-yellow-100 text-yellow-950 border-yellow-400", Icon: CircleDot, hint: "Some help committed, more needed" },
  FULL: { label: "Fully booked", cls: "bg-slate-200 text-slate-800 border-slate-400", Icon: CircleCheck, hint: "No more capacity" },
  NOT_NEEDED: { label: "Not needed", cls: "bg-slate-100 text-slate-600 border-slate-300", Icon: Leaf, hint: "Covered another way" },
  CONFLICTED: { label: "Needs attention", cls: "bg-red-50 text-red-900 border-red-400", Icon: TriangleAlert, hint: "Commitments exceed the current plan" },
  UNSCHEDULED: { label: "Not scheduled", cls: "bg-transparent text-slate-500 border-dashed border-slate-300", Icon: CircleSlash, hint: "No published meal yet" },
  CANCELLED: { label: "Cancelled", cls: "bg-transparent text-slate-500 border-slate-300 line-through", Icon: Ban, hint: "Meal cancelled" },
  CLOSED: { label: "Closed", cls: "bg-slate-100 text-slate-500 border-slate-300", Icon: Clock, hint: "Meal time has passed" },
};

export function StatusBadge({ status, size = "md", label }: { status: AnyStatus; size?: "sm" | "md"; label?: string }) {
  const m = STATUS_META[status];
  const { Icon } = m;
  return (
    <span
      data-status={status}
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${m.cls} ${size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-sm"}`}
    >
      <Icon aria-hidden className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      {label ?? m.label}
    </span>
  );
}

export function StatusLegend() {
  const shown: AnyStatus[] = ["AVAILABLE", "PARTIAL", "FULL", "CONFLICTED", "UNSCHEDULED", "CLOSED"];
  return (
    <ul aria-label="Status legend" className="flex flex-wrap gap-2 text-sm">
      {shown.map((s) => (
        <li key={s} className="flex items-center gap-1">
          <StatusBadge status={s} size="sm" />
          <span className="sr-only">{STATUS_META[s].hint}</span>
        </li>
      ))}
    </ul>
  );
}

export const PERIOD_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner" };
export const TYPE_LABEL: Record<string, string> = { PREPARED_FOOD: "Prepared food", GROCERY: "Groceries", PANTRY: "Pantry allocation", SERVING: "Serving" };
