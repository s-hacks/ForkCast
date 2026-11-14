import { api, json } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertAdmin } from "@/server/auth/guards";
import { itemTransactions } from "@/server/services/admin";
export const GET = api(async (_req, { params }) => {
  assertAdmin(await getSession());
  return json(200, await itemTransactions((await params).id));
});
