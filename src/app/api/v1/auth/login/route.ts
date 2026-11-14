import { api, json, parseBody } from "@/server/http";
import { login, setSessionCookie } from "@/server/auth/session";
import { loginSchema } from "@/lib/schemas";
export const POST = api(async (req) => {
  const b = await parseBody(req, loginSchema);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  const r = await login(b.username, b.password, b.portal, ip);
  await setSessionCookie(r.token);
  return json(200, { user: r.user });
});
