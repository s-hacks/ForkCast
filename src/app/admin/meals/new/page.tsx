import { pageAdmin } from "@/server/auth/guards";
import { config } from "@/server/config";
import { addDays, isDateString, todayIn } from "@/server/domain/dates";
import { listPantry } from "@/server/services/admin";
import { MealEditor } from "@/components/admin/meal-editor";

export const dynamic = "force-dynamic";

export default async function NewMeal({ searchParams }: { searchParams: Promise<{ date?: string; period?: string }> }) {
  await pageAdmin();
  const sp = await searchParams;
  const date = sp.date && isDateString(sp.date) ? sp.date : addDays(todayIn(config().SHELTER_TIMEZONE), 1);
  const period = (["BREAKFAST", "LUNCH", "DINNER"].includes(sp.period ?? "") ? sp.period : "LUNCH") as "BREAKFAST" | "LUNCH" | "DINNER";
  const items = (await listPantry()).map((i) => ({ id: i.id, name: i.name, units: i.units, displayUnit: i.displayUnit }));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New meal plan</h1>
      <p className="text-sm text-slate-600">Drafts are invisible to volunteers. Publish when the dish, servings and ingredients are complete.</p>
      <MealEditor mode="create" items={items} initial={{ date, period, dishName: "", servingsTarget: 120, recipeYield: 120, serviceCapacity: 1, ingredients: [] }} />
    </div>
  );
}
