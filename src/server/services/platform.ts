/** Audit logging (FR-40) and idempotency (FR-39, D-12), both inside the caller's transaction. */
import "server-only";
import type { Tx } from "../db/client";
import { DomainError } from "../domain/errors";
import { Prisma } from "@/generated/prisma/client";

export async function audit(tx: Tx, actorId: string | null, action: string, entityType: string, entityId: string, data: unknown = {}) {
  await tx.auditLog.create({ data: { actorId, action, entityType, entityId, data: data as Prisma.InputJsonValue } });
}

/**
 * Claim (userId,key) first; a concurrent duplicate blocks on the PK until the first commits,
 * then sees the stored response. Failed mutations roll back the claim so retries are allowed.
 */
export async function runIdempotent<T>(
  tx: Tx,
  userId: string,
  key: string,
  route: string,
  fn: () => Promise<{ status: number; body: T }>,
): Promise<{ status: number; body: T; replayed: boolean }> {
  const claimed = await tx.$queryRaw<{ key: string }[]>`
    INSERT INTO "IdempotencyRecord" ("userId","key","route","status","body")
    VALUES (${userId}::uuid, ${key}, ${route}, 0, '{}'::jsonb)
    ON CONFLICT ("userId","key") DO NOTHING RETURNING "key"`;
  if (claimed.length === 0) {
    const rec = await tx.idempotencyRecord.findUnique({ where: { userId_key: { userId, key } } });
    if (!rec) throw new DomainError("INTERNAL", "Idempotency record missing.");
    if (rec.route !== route) throw new DomainError("IDEMPOTENCY_KEY_REUSED", "This request key was already used for a different action.");
    return { status: rec.status, body: rec.body as T, replayed: true };
  }
  const res = await fn();
  await tx.idempotencyRecord.update({
    where: { userId_key: { userId, key } },
    data: { status: res.status, body: JSON.parse(JSON.stringify(res.body)) as Prisma.InputJsonValue },
  });
  return { ...res, replayed: false };
}
