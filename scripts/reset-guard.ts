/** Demo reset safety guard (platform-foundation: Safe demo reset). */
export function assertResetAllowed(databaseUrl: string, env: Record<string, string | undefined>): void {
  if (env.NODE_ENV === "production") throw new Error("Refusing demo reset: NODE_ENV=production.");
  let host = "";
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("Refusing demo reset: DATABASE_URL is not a valid URL.");
  }
  const local = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (!local && env.ALLOW_DEMO_RESET !== "true") {
    throw new Error(`Refusing demo reset: database host "${host}" is not local (set ALLOW_DEMO_RESET=true to override on a non-production demo database).`);
  }
}
