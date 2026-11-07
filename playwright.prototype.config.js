import { defineConfig, devices } from '@playwright/test';

// The design prototype in prototype/ (React + Vite), served the way a demo is served: the real edge Worker
// (the Door, port 8788) and the platform origin (port 8789) that serves the built app at /app/ and the real
// loader at /dist/latest. `npm run demo:app` builds the app, then starts both. Nothing is faked: the Live tab
// talks to the real loader and the real Door, and the counts land in the real edge's database.
const DOOR_PORT = Number(process.env.DOOR_PORT || 8788);
const PLATFORM_PORT = Number(process.env.PLATFORM_PORT || 8789);

export default defineConfig({
  testDir: 'prototype/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${PLATFORM_PORT}`, locale: 'nl-NL', trace: 'retain-on-failure' },
  projects: [
    // The Desk's live spec reads the demo data the server seeds at start (SEED=1). The prototype spec resets the
    // database before each test, so the Desk spec runs first in every browser, before any reset. It only reads.
    // Platform and Door are both on loopback here, which Chrome's Local Network Access check would otherwise
    // treat as a private-network request. Production origins are public. Same flags as playwright.config.js.
    { name: 'desk-chromium', testMatch: /desk-live\.spec\.js$/, use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults'] } } },
    { name: 'desk-firefox', testMatch: /desk-live\.spec\.js$/, use: { ...devices['Desktop Firefox'] } },
    { name: 'desk-webkit', testMatch: /desk-live\.spec\.js$/, use: { ...devices['Desktop Safari'] } },
    { name: 'chromium', testIgnore: /desk-live\.spec\.js$/, use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults'] } } },
    { name: 'firefox', testIgnore: /desk-live\.spec\.js$/, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testIgnore: /desk-live\.spec\.js$/, use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    // build:prototype, then the harness with SEED=1 (mock data in the Desk). Always start fresh: a server left
    // over from an earlier build would serve an old app.
    command: 'npm run demo:app',
    url: `http://127.0.0.1:${PLATFORM_PORT}/app/`,
    env: { DOOR_PORT: String(DOOR_PORT), PLATFORM_PORT: String(PLATFORM_PORT) },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
