import { defineConfig, devices } from "@playwright/test";

process.loadEnvFile(".env.local");

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
const isCI = Boolean(process.env.CI);
const browserChannel = isCI ? {} : { channel: "msedge" };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? "github" : "list",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], ...browserChannel },
    },
    {
      name: "mobile",
      testMatch: ["core-flows.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        ...browserChannel,
        viewport: { width: 360, height: 780 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
      url: `${BASE_URL}/login`,
      env: { BETTER_AUTH_URL: BASE_URL },
      reuseExistingServer: !isCI,
      timeout: 300_000,
    },
  ],
});
