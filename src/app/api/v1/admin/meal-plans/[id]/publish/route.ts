import { api, json, parseBody, idempotencyKey } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertAdmin } from "@/server/auth/guards";
import * as admin from "@/server/services/admin";
export const POST = api(async (req, { params }) => {
  const a = assertAdmin(await getSession());
  const key = idempotencyKey(req);
  const p = await params;
  void p; void parseBody;
  const r = await admin.publishPlan(a, p.id, key);
  return json(r.status, r.body);
});
