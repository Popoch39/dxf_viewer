import { defineConfig, devices } from "@playwright/test";

// Runs against the real API, like its own tests: `bun infra:up` first, and
// `apps/api/.env` with `VIEWER_URL=http://localhost:5173`.
const VIEWER_URL = "http://localhost:5173";

const API_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  reporter: "list",
  use: {
    baseURL: VIEWER_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: [
    {
      command: "bun run start",
      cwd: "../api",
      url: `${API_URL}/health`,
      reuseExistingServer: true,
    },
    {
      command: "bun run dev",
      url: VIEWER_URL,
      reuseExistingServer: true,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
