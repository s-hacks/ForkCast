import { api, json } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertAdmin } from "@/server/auth/guards";
import { listIncomingGroceries } from "@/server/services/admin";
export const GET = api(async () => {
  assertAdmin(await getSession());
  return json(200, { lines: await listIncomingGroceries() });
});
