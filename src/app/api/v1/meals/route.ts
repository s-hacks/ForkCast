import { api, json } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertUser } from "@/server/auth/guards";
import { listSlots } from "@/server/services/meals";
import { viewerOf } from "@/server/services/commitments";
import { DomainError } from "@/server/domain/errors";
import { isDateString } from "@/server/domain/dates";
export const GET = api(async (req) => {
  const s = assertUser(await getSession());
  if (s.user.role === "USER" && !s.context) throw new DomainError("CONTEXT_REQUIRED", "Choose how you are participating first.");
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!isDateString(from) || !isDateString(to) || to < from) throw new DomainError("VALIDATION_ERROR", "from/to must be YYYY-MM-DD", { fieldErrors: { from: ["Invalid"] } });
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 62) throw new DomainError("VALIDATION_ERROR", "Range too large (max 62 days).");
  return json(200, { slots: await listSlots(from, to, viewerOf(s)) });
});
