import { defineConfig, devices } from '@playwright/test';

// The hosted demo, as two processes of scripts/serve-demo.mjs on different ORIGINS (localhost vs 127.0.0.1),
// exactly as a real deployment separates the platform from the Door. Nothing here is reset between tests:
// the hosted servers have no /__test endpoints, so every test must work against the seeded data.
const common = { DOOR_ORIGIN: 'http://127.0.0.1:9112', PLATFORM_ORIGIN: 'http://localhost:9111' };

export default defineConfig({
  testDir: 'test/hosted',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://localhost:9111', locale: 'nl-NL', trace: 'retain-on-failure' },
  projects: [
    // Both origins are loopback, which Chrome's Local Network Access check would otherwise treat as a
    // private-network request. A real deployment's origins are public. Same flags as playwright.config.js.
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults'] } } },
  ],
  webServer: [
    {
      command: 'node scripts/serve-demo.mjs',
      env: { ...common, ROLE: 'door', PORT: '9112', DIST_DIR: 'dist-hosted/door' }, // its own build output: two builds from one checkout must not wipe each other
      url: 'http://127.0.0.1:9112/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'node scripts/serve-demo.mjs',
      env: { ...common, ROLE: 'platform', PORT: '9111', DIST_DIR: 'dist-hosted/platform' },
      url: 'http://localhost:9111/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
