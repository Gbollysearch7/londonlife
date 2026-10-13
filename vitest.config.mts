import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    fileParallelism: false,
    // Some integration tests replay months of game time against Postgres; 5s is too tight on a busy machine.
    testTimeout: 20_000,
    // TEST_DATABASE_URL lets parallel work use separate databases.
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://london:london@localhost:5432/london_life_test" },
  },
});
