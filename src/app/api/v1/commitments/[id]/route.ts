import { api, json, parseBody, idempotencyKey } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertVolunteer } from "@/server/auth/guards";
import { modifySchema } from "@/lib/schemas";
import { modifyPrepared } from "@/server/services/commitments";
export const PATCH = api(async (req, { params }) => {
  const s = assertVolunteer(await getSession());
  const key = idempotencyKey(req);
  const b = await parseBody(req, modifySchema);
  const r = await modifyPrepared(s, (await params).id, b.servings, key);
  return json(200, r.body);
});
