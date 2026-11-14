import { api } from "@/server/http";
import { clearSession } from "@/server/auth/session";
export const POST = api(async () => {
  await clearSession();
  return new Response(null, { status: 204 });
});
