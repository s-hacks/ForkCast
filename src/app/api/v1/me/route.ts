import { api, json } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertUser } from "@/server/auth/guards";
import { listMyOrganizations } from "@/server/services/context";
export const GET = api(async () => {
  const s = assertUser(await getSession());
  return json(200, { user: s.user, context: s.context, organizations: await listMyOrganizations(s.user.id) });
});
