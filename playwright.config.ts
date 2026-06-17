import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * E2E harness for the block-autofit-height feature. Boots the REAL
 * server (PORT 3210, throwaway temp DB so the dev库 is never touched)
 * and the REAL web dev server (vite 5173, /api proxied to 3210), then
 * drives chromium against the editor + published pages exactly as a
 * human author would. Credentials/ports match apps/server/scripts/*.
 */
const E2E_DB = join(tmpdir(), 'shckb-e2e', 'e2e.db');
const ADMIN_EMAIL = 'admin@local.dev';
const ADMIN_PASSWORD = 'dev-admin-password';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command:
        `SHCKB_AUTH_SECRET=e2e-secret-at-least-32-characters-long ` +
        `SHCKB_ADMIN_EMAIL=${ADMIN_EMAIL} ` +
        `SHCKB_ADMIN_PASSWORD=${ADMIN_PASSWORD} ` +
        `SHCKB_BASE_URL=http://localhost:5173 ` +
        `SHCKB_DB_PATH=${E2E_DB} ` +
        `PORT=3210 bun apps/server/src/index.ts`,
      url: 'http://localhost:3210/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `SHCKB_API_TARGET=http://localhost:3210 bun x vite --port 5173`,
      cwd: './apps/web',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
