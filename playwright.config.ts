import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// E2E runs against a production build on port 3200 using the dedicated firehouse_e2e database.
const env = config({ path: ".env.e2e", override: true }).parsed ?? {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: "http://localhost:3200", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  globalSetup: "./tests/e2e/global-setup.ts",
  webServer: {
    command: "npx next start -p 3200",
    url: "http://localhost:3200/api/health",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env, ...env } as Record<string, string>,
  },
});
