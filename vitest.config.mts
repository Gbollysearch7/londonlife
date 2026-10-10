import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: "postgresql://london:london@localhost:5432/london_life_test" },
  },
});
