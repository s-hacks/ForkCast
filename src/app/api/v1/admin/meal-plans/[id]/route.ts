import { api, json, parseBody, idempotencyKey } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertAdmin } from "@/server/auth/guards";
import { updatePlanSchema } from "@/lib/schemas";
import * as admin from "@/server/services/admin";
export const PUT = api(async (req, { params }) => {
  const a = assertAdmin(await getSession());
  const key = idempotencyKey(req);
  const b = await parseBody(req, updatePlanSchema);
  const p = await params;
  void p; void parseBody;
  const r = await admin.updatePlan(a, p.id, b, key);
  return json(r.status, r.body);
});
