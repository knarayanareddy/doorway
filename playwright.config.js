import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:8789', locale: 'nl-NL', trace: 'retain-on-failure' },
  // Platform and Door are both on loopback here, which Chrome's Local Network Access
// check would otherwise treat as a private-network request. Production origins are public.
projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults'] } } }],
  webServer: { command: 'node scripts/dev.mjs', url: 'http://127.0.0.1:8788/v1/status?i=inst_demo001', reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
