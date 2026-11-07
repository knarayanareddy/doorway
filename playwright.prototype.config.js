import { defineConfig, devices } from '@playwright/test';

// The design prototype in prototype/ (React + Vite). Separate from the Door's own suite in
// playwright.config.js: it builds the prototype, serves the build, and checks what the page does.
export default defineConfig({
  testDir: 'prototype/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:5199', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npx vite build && npx vite preview --port 5199 --host 127.0.0.1 --strictPort',
    cwd: 'prototype',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
