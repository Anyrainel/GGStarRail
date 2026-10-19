import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 30_000,
  outputDir: "test-results/e2e",
  reporter: [["list"]],
  use: {
    baseURL,
    // Most workflows start after the welcome flow. Startup tests explicitly
    // replace this with empty storage to exercise a first visit and updates.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [
            {
              name: "ggstarrail:greeting:v1",
              value: JSON.stringify({
                version: 1,
                state: { buildPromptSeen: true, lastSeenUpdate: "2099-12-31" },
              }),
            },
          ],
        },
      ],
    },
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 60_000,
      },
});
