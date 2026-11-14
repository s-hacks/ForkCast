import "server-only";
import { hash, verify } from "@node-rs/argon2";

// OWASP minimum Argon2id parameters (D-26): m=19 MiB, t=2, p=1. Algorithm 2 = Argon2id.
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1, algorithm: 2 as const };

export function hashPassword(pw: string): Promise<string> {
  return hash(pw, OPTS);
}

let dummy: Promise<string> | null = null;
/** Verify; when hash is null still burns an Argon2 verify to equalize timing (D-27). */
export async function verifyPassword(hashOrNull: string | null, pw: string): Promise<boolean> {
  if (!hashOrNull) {
    dummy ??= hashPassword("timing-equalizer-not-a-password");
    await verify(await dummy, pw).catch(() => false);
    return false;
  }
  return verify(hashOrNull, pw).catch(() => false);
}
