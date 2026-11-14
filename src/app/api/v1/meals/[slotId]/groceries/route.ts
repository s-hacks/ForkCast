import { api, json, parseBody, idempotencyKey } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertVolunteer } from "@/server/auth/guards";
import { grocerySchema } from "@/lib/schemas";
import { commitGroceries } from "@/server/services/commitments";
export const POST = api(async (req, { params }) => {
  const s = assertVolunteer(await getSession());
  const key = idempotencyKey(req);
  const b = await parseBody(req, grocerySchema);
  const p = await params;
  const r = await commitGroceries(s, p.slotId, b.lines, key);
  return json(r.status, r.body);
});
