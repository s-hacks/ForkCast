import { api, json, parseBody, idempotencyKey } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertAdmin } from "@/server/auth/guards";
import { createPlanSchema } from "@/lib/schemas";
import * as admin from "@/server/services/admin";
export const POST = api(async (req, { params }) => {
  const a = assertAdmin(await getSession());
  const key = idempotencyKey(req);
  const b = await parseBody(req, createPlanSchema);
  const p = await params;
  void p; void parseBody;
  const r = await admin.createPlan(a, b, key);
  return json(r.status, r.body);
});

import { listSlots } from "@/server/services/meals";
import { isDateString } from "@/server/domain/dates";
import { DomainError } from "@/server/domain/errors";
export const GET = api(async (req) => {
  const a = assertAdmin(await getSession());
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!isDateString(from) || !isDateString(to)) throw new DomainError("VALIDATION_ERROR", "from/to required");
  return json(200, { slots: await listSlots(from, to, { userId: a.user.id, role: "ADMIN", context: null }) });
});
