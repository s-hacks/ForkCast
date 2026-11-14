import { api, json, parseBody, idempotencyKey } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertVolunteer } from "@/server/auth/guards";
import { preparedSchema } from "@/lib/schemas";
import { commitPrepared } from "@/server/services/commitments";
export const POST = api(async (req, { params }) => {
  const s = assertVolunteer(await getSession());
  const key = idempotencyKey(req);
  const b = await parseBody(req, preparedSchema);
  const p = await params;
  const r = await commitPrepared(s, p.slotId, b.servings, key);
  return json(r.status, r.body);
});
