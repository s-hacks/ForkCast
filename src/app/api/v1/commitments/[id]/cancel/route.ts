import { api, json, idempotencyKey } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertVolunteer } from "@/server/auth/guards";
import { cancelCommitment } from "@/server/services/commitments";
export const POST = api(async (req, { params }) => {
  const s = assertVolunteer(await getSession());
  const key = idempotencyKey(req);
  const r = await cancelCommitment(s, (await params).id, key);
  return json(200, r.body);
});
