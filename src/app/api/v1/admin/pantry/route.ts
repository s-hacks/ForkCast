import { api, json, parseBody, idempotencyKey } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertAdmin } from "@/server/auth/guards";
import { createItemSchema } from "@/lib/schemas";
import * as admin from "@/server/services/admin";
export const POST = api(async (req, { params }) => {
  const a = assertAdmin(await getSession());
  const key = idempotencyKey(req);
  const b = await parseBody(req, createItemSchema);
  const p = await params;
  void p; void parseBody;
  const r = await admin.createPantryItem(a, b, key);
  return json(r.status, r.body);
});

export const GET = api(async () => {
  assertAdmin(await getSession());
  return json(200, { items: await admin.listPantry() });
});
