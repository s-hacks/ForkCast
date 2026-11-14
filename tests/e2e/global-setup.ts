import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Migrate + seed the e2e database before the server starts. Fixed commands, no user input. */
export default function setup() {
  const env = { ...process.env, ...(config({ path: ".env.e2e", override: true }).parsed ?? {}) };
  if (!env.DATABASE_URL?.includes("firehouse_e2e")) throw new Error("E2E must use firehouse_e2e");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env });
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env });
}
