import { defineConfig, devices } from "@playwright/test";

// Preview UI smoke tests only. These do not satisfy the BE-23/BE-24 real-API
// closure gate. See DRIVER_EXECUTION.md for the outstanding integration gate.
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.DRIVER_UI_BASE_URL ?? "http://localhost:3100",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: process.env.DRIVER_UI_BASE_URL ? undefined : {
    command: "npm run dev -- --hostname localhost --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
