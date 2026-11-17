/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { offlineServiceWorker } from "./scripts/sw-plugin.mjs";

export default defineConfig({
  plugins: [react(), offlineServiceWorker()],
  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["e2e/**", "node_modules/**"],
    // Several tests assert right after a click and are timing-sensitive; files in parallel flake under CPU load.
    fileParallelism: false,
    setupFiles: ["./src/test/setup.ts"],
  },
});
