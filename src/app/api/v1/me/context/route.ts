import { api, json, parseBody } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertUser } from "@/server/auth/guards";
import { contextSchema } from "@/lib/schemas";
import { selectContext } from "@/server/services/context";
export const PUT = api(async (req) => {
  const s = assertUser(await getSession());
  const b = await parseBody(req, contextSchema);
  return json(200, { context: await selectContext(s, b) });
});
