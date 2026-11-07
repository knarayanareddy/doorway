import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  retries: 0, // CI does not retry: a flaky test is fixed or quarantined by name (BUILD.md), never retried silently
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:8789', locale: 'nl-NL', trace: 'retain-on-failure' },
  projects: [
    // Platform and Door are both on loopback here, which Chrome's Local Network Access
    // check would otherwise treat as a private-network request. Production origins are public.
    { name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults'] } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: { command: 'node scripts/dev.mjs', url: 'http://127.0.0.1:8788/v1/status?i=inst_demo001', reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
