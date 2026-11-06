import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel: "chrome",
    viewport: { width: 1600, height: 1050 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
  },
});
