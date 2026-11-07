import { defineConfig, devices } from '@playwright/test';

// The demo Door: the same harness as `npm run demo` (scripts/dev.mjs with DEMO_ROUTES=1 and DOOR_ORIGIN on :8788),
// run against door-panel.spec.js only. Without this run the demo tests in that spec skip, and nothing else
// in CI ever builds the demo Door. The shipped-build tests in the same spec run in playwright.config.js.
// DEMO_ROUTES is set here so the spec (which reads it in the worker) and the demo build both see it.
process.env.DEMO_ROUTES = '1';

export default defineConfig({
  testDir: 'test/e2e',
  testMatch: 'door-panel.spec.js',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0, // a failing test fails the run; see BUILD.md
  reporter: process.env.CI ? [['list'], ['github']] : 'list', // no html report: it would overwrite the main run's
  use: { baseURL: 'http://127.0.0.1:8789', locale: 'nl-NL', trace: 'retain-on-failure' },
  projects: [
    // Same loopback flags as playwright.config.js (Local Network Access would block the loopback requests).
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults'] } } },
  ],
  webServer: {
    command: 'node scripts/dev.mjs',
    env: { DEMO_ROUTES: '1', DOOR_ORIGIN: 'http://127.0.0.1:8788' },
    url: 'http://127.0.0.1:8788/v1/status?i=inst_demo001',
    // Never reuse: a server left over from `npm run e2e` serves the shipped build, and the demo tests would fail for the wrong reason.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
