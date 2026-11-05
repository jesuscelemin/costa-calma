import { defineConfig, devices } from "@playwright/test";

// `npm run test:e2e:prod` runs the suite against a production build, where Next prefetches links
// (the house type morph needs it, see e2e/house-transition.ts); on its own port, so it can run
// beside the dev server. Next.js allows a single dev server per project: it reuses the usual port.
const production = process.env.E2E_PROD === "1";
const PORT = production ? 3100 : 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "es-ES",
    trace: "on-first-retry",
    // On a Mac, the house model's materials, shadows and ambient occlusion are drawn by its GPU:
    // headless Chromium otherwise draws WebGL in software, seconds a frame at 1440×900.
    launchOptions:
      process.platform === "darwin"
        ? { args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"] }
        : {},
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: production
      ? `npm run build && npm run start -- --port ${PORT}`
      : `npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: production ? 300_000 : 120_000,
  },
});
