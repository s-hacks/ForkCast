import "server-only";
import { redirect } from "next/navigation";
import { DomainError } from "../domain/errors";
import { getSession, type SessionUser } from "./session";

export type VolunteerSession = SessionUser & { context: NonNullable<SessionUser["context"]> };

/** API guards: throw DomainError (401/403). Role always comes from the DB user row. */
export function assertUser(s: SessionUser | null): SessionUser {
  if (!s) throw new DomainError("UNAUTHENTICATED", "Please sign in.");
  return s;
}
export function assertAdmin(s: SessionUser | null): SessionUser {
  const u = assertUser(s);
  if (u.user.role !== "ADMIN") throw new DomainError("FORBIDDEN", "Administrator access required.");
  return u;
}
export function assertVolunteer(s: SessionUser | null): VolunteerSession {
  const u = assertUser(s);
  if (u.user.role !== "USER") throw new DomainError("FORBIDDEN", "Administrators manage meals and inventory; they do not book commitments.");
  if (!u.context) throw new DomainError("CONTEXT_REQUIRED", "Choose how you are participating first.");
  return u as VolunteerSession;
}

/** Page guards: redirect instead of throwing. */
export async function pageUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
export async function pageAdmin(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login?as=admin");
  if (s.user.role !== "ADMIN") redirect("/calendar");
  return s;
}
export async function pageVolunteer(): Promise<VolunteerSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.user.role === "ADMIN") redirect("/admin");
  if (!s.context) redirect("/context");
  return s as VolunteerSession;
}
