import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

const serverOnlyStub = path.resolve(__dirname, "tests/stubs/server-only.ts");

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: { "server-only": serverOnlyStub } },
  test: {
    projects: [
      { extends: true, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.int.test.ts"],
          environment: "node",
          setupFiles: ["tests/integration/env.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
