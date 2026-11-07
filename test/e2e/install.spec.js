import { test, expect } from '@playwright/test';
import { resetDb, readDb, waitForAgg, act, PLATFORM, settle } from './helpers.js';

test.beforeEach(async ({ request }) => { await resetDb(request); });
test.afterEach(async ({ page }) => { await settle(page); });

const manifest = (page) => page.evaluate(async () => (await fetch('/dist/v0.2.0/manifest.json')).json());

async function inject(page, attrs) {
  return page.evaluate((a) => new Promise((resolve) => {
    const s = document.createElement('script');
    for (const [k, v] of Object.entries(a)) s.setAttribute(k, v);
    s.defer = true;
    s.onload = () => resolve('loaded');
    s.onerror = () => resolve('blocked');
    document.head.appendChild(s);
  }), attrs);
}

test('the script tag installs with data attributes only — no JavaScript authored by the installer', async ({ page }) => {
  await page.goto(PLATFORM + '/test/e2e/blank.html');
  const m = await manifest(page);
  expect(m.tag).toMatch(/^<script src="[^"]+doorway\.min\.js" integrity="sha384-[^"]+" crossorigin="anonymous" data-install="inst_xxxxxx" data-trigger-event="doorway:flag" defer><\/script>$/);
  expect(await inject(page, { src: '/dist/v0.2.0/doorway.min.js', integrity: m.integrity, crossorigin: 'anonymous', 'data-install': 'inst_demo001', 'data-trigger-event': 'doorway:flag' })).toBe('loaded');
  expect(await page.evaluate(() => typeof window.doorway.trigger)).toBe('function');

  // the platform's only integration code: fire its own event with a trigger KIND
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('doorway:flag', { detail: { type: 'search' } })));
  await expect(act(page, 'primary')).toBeVisible();
});

test('a tampered loader is refused by the browser (SRI)', async ({ page }) => {
  await page.goto(PLATFORM + '/test/e2e/blank.html');
  const bad = 'sha384-' + 'A'.repeat(64);
  expect(await inject(page, { src: '/dist/v0.2.0/doorway.min.js', integrity: bad, crossorigin: 'anonymous', 'data-install': 'inst_demo001' })).toBe('blocked');
  expect(await page.evaluate(() => typeof window.doorway)).toBe('undefined');
});

test('the built loader is one classic file: no import attributes, no module syntax', async ({ page }) => {
  await page.goto(PLATFORM + '/test/e2e/blank.html');
  const src = await page.evaluate(async () => (await fetch('/dist/v0.2.0/doorway.min.js')).text());
  expect(src).not.toMatch(/\bimport\s*(\(|[{*\w])|\bexport\s|with\s*\{\s*type:\s*["']json/);
  expect(src.length).toBeLessThan(20_000);
});

test('the generated WordPress plugin and Discourse tag carry the real SRI hash', async ({ page }) => {
  await page.goto(PLATFORM + '/test/e2e/blank.html');
  const m = await manifest(page);
  const wp = await page.evaluate(async () => (await fetch('/dist/wordpress/doorway/doorway.php')).text());
  const dc = await page.evaluate(async () => (await fetch('/dist/discourse/common/head_tag.html')).text());
  for (const f of [wp, dc]) { expect(f).toContain(m.integrity); expect(f).not.toContain('{{'); }
});

test('no outcome is lost when the platform triggers through the script-tag event', async ({ page, request }) => {
  await page.goto(PLATFORM + '/test/e2e/blank.html');
  const m = await manifest(page);
  await inject(page, { src: '/dist/v0.2.0/doorway.min.js', integrity: m.integrity, crossorigin: 'anonymous', 'data-install': 'inst_demo001', 'data-trigger-event': 'doorway:flag' });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('doorway:flag', { detail: { type: 'chat' } })));
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await page.keyboard.press('Escape');
  const db = await waitForAgg(request, (d) => d.agg.length > 0);
  expect(db.agg[0]).toMatchObject({ trigger: 'chat', outcome: 'dismissed' });
  expect((await readDb(request)).heartbeats).toEqual([]);
});
