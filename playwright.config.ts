import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:5199", ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } },
  webServer: [
    {
      command: "npx vite --port 5199 --strictPort",
      url: "http://localhost:5199",
      reuseExistingServer: !process.env.CI,
    },
    {
      // Production build served statically: the offline e2e (e2e/offline.spec.ts) needs the real service worker.
      command: "npx vite build && npx vite preview --port 5198 --strictPort",
      url: "http://localhost:5198",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
