import { defineConfig } from "playwright/test";

const FRONTEND_PORT = Number(process.env.PLAYWRIGHT_FRONTEND_PORT || 5173);
const FRONTEND_URL = process.env.PLAYWRIGHT_FRONTEND_URL || `http://127.0.0.1:${FRONTEND_PORT}`;
const BACKEND_URL = process.env.PLAYWRIGHT_BACKEND_URL || "http://localhost:4000";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: FRONTEND_URL,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run backend:dev",
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: `npx cross-env VITE_ALLOW_OFFLINE_DEMO_FALLBACK=false npm run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT}`,
      url: FRONTEND_URL,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
