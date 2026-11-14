import { api, json, idempotencyKey } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertVolunteer } from "@/server/auth/guards";
import { bookServing } from "@/server/services/commitments";
export const POST = api(async (req, { params }) => {
  const s = assertVolunteer(await getSession());
  const key = idempotencyKey(req);
  const r = await bookServing(s, (await params).slotId, key);
  return json(r.status, r.body);
});
