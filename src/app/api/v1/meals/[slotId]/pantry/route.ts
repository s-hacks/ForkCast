import { api, json, parseBody, idempotencyKey } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertVolunteer } from "@/server/auth/guards";
import { pantrySchema } from "@/lib/schemas";
import { usePantry } from "@/server/services/commitments";
export const POST = api(async (req, { params }) => {
  const s = assertVolunteer(await getSession());
  const key = idempotencyKey(req);
  await parseBody(req, pantrySchema);
  const p = await params;
  const r = await usePantry(s, p.slotId, key);
  return json(r.status, r.body);
});
