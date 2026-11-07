import { test, expect } from '@playwright/test';
import { resetDb, waitForAgg, act, settle } from './helpers.js';

// Runs only when a real WordPress with the generated plugin is serving at WP_URL
// (see docs/09-cms-verification.md). Skipped otherwise, so CI without WordPress stays green.
const WP = process.env.WP_URL;
test.skip(!WP, 'set WP_URL to a WordPress running the generated plugin');

test.beforeEach(async ({ request }) => { await resetDb(request); });
test.afterEach(async ({ page }) => { await settle(page); });

test('WordPress: the plugin emits one SRI-pinned, deferred script tag with the configured install', async ({ page }) => {
  await page.goto(WP);
  const tags = await page.$$eval('script[data-install]', (s) => s.map((e) => ({ src: e.src, integrity: e.integrity, install: e.dataset.install, event: e.dataset.triggerEvent, country: e.dataset.country, defer: e.defer, cross: e.crossOrigin })));
  expect(tags).toHaveLength(1);
  expect(tags[0]).toMatchObject({ install: 'inst_wp0001', event: 'doorway:flag', country: 'NL', defer: true, cross: 'anonymous' });
  expect(tags[0].integrity).toMatch(/^sha384-/);
  expect(await page.evaluate(() => typeof window.doorway.trigger)).toBe('function');
});

test('WordPress: a flag event opens the Door and the outcome is counted for the WordPress install', async ({ page, request }) => {
  await page.goto(WP);
  await page.waitForFunction(() => !!window.doorway);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('doorway:flag', { detail: { type: 'search' } })));
  await expect(act(page, 'primary')).toBeFocused({ timeout: 4000 });
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  const db = await waitForAgg(request, (d) => d.agg.length > 0);
  expect(db.agg[0]).toMatchObject({ install: 'inst_wp0001', outcome: 'dismissed', trigger: 'search' });
});
