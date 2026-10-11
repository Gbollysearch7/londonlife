import { defineConfig } from "@playwright/test";
import fs from "node:fs";

// PW_CHROMIUM lets a machine use an already-installed Chrome instead of Playwright's download.
const chromium = process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 300_000,
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1280, height: 800 },
    launchOptions: fs.existsSync(chromium)
      ? { executablePath: chromium, args: ["--use-gl=swiftshader", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }
      : { args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  webServer: {
    command: "npx next dev -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      DATABASE_URL: "postgresql://london:london@localhost:5432/london_life_test",
      LL_TIME_SCALE: "60",
    },
  },
});
