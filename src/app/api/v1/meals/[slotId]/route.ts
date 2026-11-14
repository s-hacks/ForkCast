import { api, json } from "@/server/http";
import { getSession } from "@/server/auth/session";
import { assertUser } from "@/server/auth/guards";
import { livePlanIdForSlot, mealDetail } from "@/server/services/meals";
import { viewerOf } from "@/server/services/commitments";
import { prisma } from "@/server/db/client";
import { DomainError } from "@/server/domain/errors";
export const GET = api(async (_req, { params }) => {
  const s = assertUser(await getSession());
  if (s.user.role === "USER" && !s.context) throw new DomainError("CONTEXT_REQUIRED", "Choose how you are participating first.");
  const { slotId } = await params;
  const v = viewerOf(s);
  return json(200, await mealDetail(prisma, await livePlanIdForSlot(prisma, slotId, v), v));
});
