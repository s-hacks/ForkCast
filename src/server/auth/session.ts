import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "../db/client";
import { config } from "../config";
import { DomainError } from "../domain/errors";
import { verifyPassword } from "./password";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const COOKIE_NAME = process.env.NODE_ENV === "production" ? "__Host-fh_session" : "fh_session";

export type SessionUser = {
  sessionId: string;
  user: { id: string; username: string; displayName: string; role: "USER" | "ADMIN" };
  context: { type: "SOLO" } | { type: "ORGANIZATION"; organizationId: string; organizationName: string } | null;
};

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const hashIp = (ip: string) => createHmac("sha256", config().SESSION_SECRET).update(ip).digest("hex").slice(0, 32);

export function newToken(): string {
  return randomBytes(20).toString("base64url"); // 160 bits
}

export async function createSession(userId: string): Promise<string> {
  const token = newToken();
  await prisma.session.create({ data: { id: sha256(token), userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
  return token;
}

export async function validateToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const id = sha256(token);
  const s = await prisma.session.findUnique({ where: { id }, include: { user: true, organization: true } });
  if (!s || !s.user.isActive) return null;
  if (s.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }
  // Sliding renewal when less than half the TTL remains.
  if (s.expiresAt.getTime() - Date.now() < SESSION_TTL_MS / 2) {
    await prisma.session.update({ where: { id }, data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
  }
  let context: SessionUser["context"] = null;
  if (s.contextType === "SOLO") context = { type: "SOLO" };
  else if (s.contextType === "ORGANIZATION" && s.organization) context = { type: "ORGANIZATION", organizationId: s.organization.id, organizationName: s.organization.name };
  return {
    sessionId: id,
    user: { id: s.user.id, username: s.user.username, displayName: s.user.displayName, role: s.user.role },
    context,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  return validateToken(jar.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE_NAME);
}

// ---- Login with throttling (D-27) ----
const WINDOW_MS = 15 * 60 * 1000;
const USER_LIMIT = 5;
const IP_LIMIT = 30;
const GENERIC = "Invalid username or password.";

export async function login(usernameRaw: string, password: string, portal: "user" | "admin", ip: string) {
  const username = usernameRaw.trim().toLowerCase();
  const uKey = `u:${username}`;
  const iKey = `ip:${hashIp(ip)}`;
  const since = new Date(Date.now() - WINDOW_MS);
  const [uFails, iFails] = await Promise.all([
    prisma.loginAttempt.count({ where: { key: uKey, success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { key: iKey, success: false, createdAt: { gte: since } } }),
  ]);
  if (uFails >= USER_LIMIT || iFails >= IP_LIMIT) {
    throw new DomainError("TOO_MANY_ATTEMPTS", GENERIC, { retryAfter: WINDOW_MS / 1000 });
  }
  const user = await prisma.user.findUnique({ where: { username } });
  const ok = await verifyPassword(user?.isActive ? user.passwordHash : null, password);
  const roleOk = user && (portal === "admin" ? user.role === "ADMIN" : user.role === "USER");
  if (!ok || !user || !roleOk) {
    await prisma.loginAttempt.createMany({ data: [{ key: uKey, success: false }, { key: iKey, success: false }] });
    throw new DomainError("INVALID_CREDENTIALS", GENERIC);
  }
  await prisma.loginAttempt.create({ data: { key: uKey, success: true } });
  await prisma.auditLog.create({ data: { actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, data: { portal } } });
  const token = await createSession(user.id);
  return { token, user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role } };
}
