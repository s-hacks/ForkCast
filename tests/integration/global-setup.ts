import { execSync } from "node:child_process";
import { config } from "dotenv";

/** Apply migrations to the dedicated test database once per run. */
export default function setup() {
  config({ path: ".env.test", override: true });
  if (!process.env.DATABASE_URL?.includes("firehouse_test")) throw new Error("Integration tests must target firehouse_test");
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
