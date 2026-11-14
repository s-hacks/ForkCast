import { api, json } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertUser } from "@/server/auth/guards";
import { listMyCommitments } from "@/server/services/context";
import { DomainError } from "@/server/domain/errors";
export const GET = api(async (req) => {
  const s = assertUser(await getSession());
  if (s.user.role !== "USER") throw new DomainError("FORBIDDEN", "Volunteer accounts only.");
  const scope = req.nextUrl.searchParams.get("scope") === "past" ? "past" : "upcoming";
  return json(200, { commitments: await listMyCommitments(s.user.id, scope) });
});
