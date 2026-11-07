import { test, expect } from '@playwright/test';
import { resetDb, readDb, waitForAgg, frameOf, act, trigger, openPage, stubHelpSites, PLATFORM, settle } from './helpers.js';

test.beforeEach(async ({ request }) => { await resetDb(request); });
test.afterEach(async ({ page }) => { await settle(page); });

const cardKind = (page) => frameOf(page).locator('[data-core-card]').getAttribute('data-core-card');
const cardText = (page) => frameOf(page).locator('[role="dialog"], .quiet-text').first().innerText();

test('the first exposure is a gate with neutral copy, an independent-service attribution, and an equal-weight exit', async ({ page }) => {
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  expect(await cardKind(page)).toBe('gate');
  const text = await cardText(page);
  expect(text).toMatch(/onafhankelijk/i);
  expect(text).not.toMatch(/anoniem|vertrouwelijk|confidential|anonymous|artikel 252|strafbaar/i);
  expect(text).toMatch(/Hulp, gratis\./);
  const [a, b] = await Promise.all([act(page, 'primary').boundingBox(), act(page, 'secondary').boundingBox()]);
  expect(Math.abs(a.width - b.width)).toBeLessThan(2);
  expect(b.height).toBeGreaterThanOrEqual(44);
});

test('the primary action opens the allow-listed service, detached, and is counted as a click', async ({ page, request, context }) => {
  await stubHelpSites(context);
  await openPage(page);
  await trigger(page);
  const popup = context.waitForEvent('page');
  await act(page, 'primary').click();
  const p = await popup;
  expect(p.url()).toBe('https://offlimits.nl/?src=doorway');
  expect(await p.evaluate(() => window.opener)).toBeNull();
  await p.close();
  const db = await waitForAgg(request, (d) => d.agg.length > 0);
  expect(db.agg).toHaveLength(1);
  expect(db.agg[0]).toMatchObject({ outcome: 'clicked_help', route: 'nl-offlimits', format: 'gate', bucket: '1', trigger: 'search', variant: 'legal-01' });
  expect(db.agg[0].count).toBe(1);
});

test('keyboard only: Tab reaches both actions and Enter on the exit is a "continued"', async ({ page, request }) => {
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  // Let focus settle: a keystroke 20 ms after the dialog opens is not something a person does,
  // and Chromium can drop a Tab that arrives that early.
  await page.waitForTimeout(250);
  // Safari does not Tab to buttons by default (Option+Tab does); that is the browser's
  // setting, not a missing tab stop.
  await page.keyboard.press(test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(act(page, 'secondary')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('iframe')).toHaveCount(0);
  const db = await waitForAgg(request, (d) => d.agg.length > 0);
  expect(db.agg.map((r) => r.outcome)).toEqual(['continued']);
});

test('Escape dismisses, focus returns to the page, and the person is counted once', async ({ page, request }) => {
  await openPage(page);
  await page.locator('#search-input').focus();
  await trigger(page);
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('#search-input')).toBeFocused();
  const db = await waitForAgg(request, (d) => d.agg.length > 0);
  expect(db.agg.reduce((n, r) => n + r.count, 0)).toBe(1);
  expect(db.agg[0].outcome).toBe('dismissed');
});

test('320px: the card fits the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  const box = await frameOf(page).locator('[role="dialog"]').boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
});

test('reduced motion: the door still renders and works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('storage blocked: a card, not the legal gate, and still no crash (L2, accepted trade)', async ({ page }) => {
  await page.addInitScript(() => {
    if (location.port === '8788') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  expect(await cardKind(page)).toBe('card');
});

test('counter-abandon: leaving the page without acting is counted as left_page', async ({ page, request }) => {
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  await page.goto('about:blank');
  const db = await waitForAgg(request, (d) => d.agg.length > 0);
  expect(db.agg).toHaveLength(1);
  expect(db.agg[0]).toMatchObject({ outcome: 'left_page', count: 1 });
});

test('counter-navtype: a "navigation" trigger is recorded as nav, not silently dropped', async ({ page, request }) => {
  await openPage(page);
  await trigger(page, 'navigation');
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await page.keyboard.press('Escape');
  const db = await waitForAgg(request, (d) => d.agg.length > 0);
  expect(db.agg[0].trigger).toBe('nav');
  expect(db.heartbeats).toEqual([]);
});

test('shift-burst: an immediate retry after leaving is escalated in place, not answered with a pill', async ({ page }) => {
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  await page.goto(PLATFORM + '/mock-platform/index.html');
  await page.waitForFunction(() => !!window.doorway);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  expect(await cardKind(page)).toBe('card');
  expect(await cardKind(page)).not.toBe('quiet');
});

test('quiet-copy: after the person has acted, a repeat is the quiet pill with its own short copy', async ({ page }) => {
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  await trigger(page);
  await expect.poll(() => frameOf(page).locator('[data-core-card]').count()).toBe(1);
  expect(await cardKind(page)).toBe('quiet');
  expect((await cardText(page)).trim()).toBe('Hulp is er.');
});

test('the mock platform flow: a trigger term opens the door; a low-severity term does not', async ({ page }) => {
  await openPage(page);
  await page.fill('#search-input', 'test-trigger-green');
  await page.click('.search-btn');
  await page.waitForTimeout(500);
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.goto(PLATFORM + '/mock-platform/index.html');
  await page.fill('#search-input', 'test-trigger-red');
  await page.click('.search-btn');
  await expect(act(page, 'primary')).toBeVisible();
});

// ── installer-facing error states (B5) ─────────────────────────────────────
async function withInstall(page, install) {
  await page.route('**/mock-platform/index.html', async (route) => {
    const r = await route.fetch();
    let body = await r.text();
    body = install === null ? body.replace(' data-install="inst_demo001"', '') : body.replace('inst_demo001', install);
    await route.fulfill({ response: r, body });
  });
}

for (const [name, install, expected] of [
  ['an unverified install', 'inst_unverif', /not been verified/],
  ['an unregistered install id', 'inst_nosuch1', /not registered/],
  ['a registered install embedded on the wrong domain (frame-ancestors)', 'inst_otherdom', /did not start/],
]) {
  test(`installer error: ${name} leaves no layer over the page and says how to fix it`, async ({ page }) => {
    const logs = [];
    page.on('console', (m) => logs.push(m.text()));
    await withInstall(page, install);
    await page.goto(PLATFORM + '/mock-platform/index.html');
    await page.waitForFunction(() => !!window.doorway);
    await trigger(page);
    await expect.poll(() => logs.join('\n'), { timeout: 12_000 }).toMatch(expected);
    await expect(page.locator('iframe')).toHaveCount(0);
    await page.locator('#search-input').fill('still usable');
  });
}

test('installer error: a missing install id is reported at load, with the one-line fix', async ({ page }) => {
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await withInstall(page, null);
  await page.goto(PLATFORM + '/mock-platform/index.html');
  await page.waitForFunction(() => !!window.doorway);
  expect(logs.join('\n')).toMatch(/data-install="inst_xxxxxx"/);
  await trigger(page);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('the Door cannot be embedded by a site that is not the install\'s domain', async ({ page }) => {
  // localhost is a different origin from the install's 127.0.0.1:8789.
  await page.goto('http://localhost:8789/mock-platform/index.html');
  const blocked = await page.evaluate(() => new Promise((res) => {
    const f = document.createElement('iframe');
    f.src = 'http://127.0.0.1:8788/v1/?i=inst_demo001';
    f.onload = () => res(true);
    document.body.appendChild(f);
  }));
  expect(blocked).toBe(true);
  const frame = page.frames().find((fr) => fr.url().includes(':8788') || fr.url().startsWith('chrome-error'));
  expect(await frame?.evaluate(() => !!document.querySelector('script[src="/v1/door.js"]')).catch(() => false)).toBeFalsy();
});

test.afterAll(async ({ request }) => { await readDb(request); });

test('H4: a visitor can report a mistaken warning in one click, without saying who they are', async ({ page, request }) => {
  await openPage(page);
  await trigger(page, 'chat');
  const report = frameOf(page).locator('[data-act="tertiary"]');
  await expect(report).toBeVisible();
  await expect(report).toHaveText('Deze waarschuwing is onterecht');
  const box = await report.boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await report.click();
  await expect(page.locator('iframe')).toHaveCount(0);
  const db = await waitForAgg(request, (d) => d.reports.length > 0 && d.agg.length > 0);
  expect(db.reports).toHaveLength(1);
  expect(db.reports[0]).toMatchObject({ install: 'inst_demo001', trigger: 'chat', reason: 'other', pack: '2026.11.07', count: 1 });
  expect(Object.keys(db.reports[0]).sort()).toEqual(['count', 'day', 'install', 'pack', 'reason', 'trigger']);
  expect(db.agg.map((r) => r.outcome)).toEqual(['continued']);
});
