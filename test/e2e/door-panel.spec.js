import { test, expect } from '@playwright/test';
import { resetDb, readDb, waitForAgg, frameOf, act, trigger, openPage, stubHelpSites, settle, PLATFORM } from './helpers.js';

// The Door shape from exposure 5 ("Is it still open?"), as a person sees it. Most tests use the labs page's
// `preview` lab, which shows the shape without counting an exposure. The shipped build has no verified hours, so
// the panel must make no open or closed claim and show no number. The demo tests need a Door built with
// DEMO_ROUTES=1, which labels its record "Demo data". They run in playwright.demo.config.js (npm run e2e:demo)
// and skip in the normal run. In that CI demo run, a guard test at the end fails if any demo test was skipped.
const LABS_PAGE = '/mock-platform/labs.html';
const DEMO = process.env.DEMO_ROUTES === '1';
const demoRan = [];
// Saturday 2026-11-07: 11:00 in Amsterdam is inside the demo hours (09:30-18:00), 22:00 is after closing.
const SAT_OPEN = new Date('2026-11-07T10:00:00Z');
const SAT_CLOSED = new Date('2026-11-07T21:00:00Z');

test.beforeEach(async ({ request }) => { await resetDb(request); });
test.afterEach(async ({ page }) => { await settle(page); });

const openLabs = async (page) => {
  await page.goto(PLATFORM + LABS_PAGE);
  await page.waitForFunction(() => !!window.doorway);
};
const preview = (page, shape) => page.evaluate((s) => { window.doorway.trigger('search', { preview: s }); }, shape);
const dialog = (page) => frameOf(page).locator('[role="dialog"]');
const cardKind = (page) => frameOf(page).locator('[data-core-card]').getAttribute('data-core-card');

/** Put this device's Door state at "seen the Door n times, long ago" (the same seed as shapes.spec.js). */
const seen = (page, n) => page.addInitScript((count) => {
  if (location.port !== '8788' || !count) return;
  if (sessionStorage.getItem('__seeded')) return;
  sessionStorage.setItem('__seeded', '1');
  const seenIds = ['legal-01', 'harm-01', 'control-01', 'control-02', 'control-03'].slice(0, count);
  localStorage.setItem('doorway:v1', JSON.stringify({ n: count, last: Date.now() - 200 * 3.6e6, seen: seenIds }));
}, n);

// ── the shipped build: no claim about the line ─────────────────────────────
test('the fifth shape is a dark door panel with a kicker, one line, and one primary action', async ({ page }) => {
  await openLabs(page);
  await preview(page, 'door');
  await expect(act(page, 'primary')).toBeVisible();
  expect(await cardKind(page)).toBe('door');
  await expect(dialog(page)).toHaveAttribute('aria-labelledby', 'doorway-card-title');
  await expect(frameOf(page).getByRole('heading', { level: 2 })).toBeVisible();
  expect((await frameOf(page).locator('[data-act="primary"]').count())).toBe(1);
  await expect(frameOf(page).locator('.drk')).toContainText('Is de deur nog open?');
});

test('the shipped build makes no claim about the line: no open, no closed, no number, no tel: link', async ({ page }) => {
  test.skip(DEMO, 'a demo Door has verified hours by design');
  await openLabs(page);
  await preview(page, 'door');
  await expect(act(page, 'primary')).toBeVisible();
  await expect(act(page, 'primary')).toHaveText('Bekijk hulp');
  expect(await dialog(page).innerText()).not.toMatch(/0800|opent om|Bel nu|Nu open|Nu gesloten|geopend|Demodata/i);
  await expect(frameOf(page).locator('a[href^="tel:"]')).toHaveCount(0);
  await expect(frameOf(page).locator('a[href]')).toHaveCount(0);
});

test('the headline rotates with the exposure count', async ({ page }) => {
  await seen(page, 4);
  await openLabs(page);
  await preview(page, 'door');
  await expect(act(page, 'primary')).toBeVisible();
  await expect(frameOf(page).getByRole('heading', { level: 2 })).toHaveText('Je bent hier eerder geweest. Dit is geen oordeel.');
});

test('the rotation moves on: the sixth exposure shows the second line', async ({ page }) => {
  await seen(page, 5);
  await openLabs(page);
  await preview(page, 'door');
  await expect(act(page, 'primary')).toBeVisible();
  await expect(frameOf(page).getByRole('heading', { level: 2 })).toHaveText('Nog steeds hier? Dan staat de deur ook nog steeds open.');
});

test('the Glass Door opens from the door panel and lists what leaves the browser', async ({ page }) => {
  await openLabs(page);
  await preview(page, 'door');
  await expect(act(page, 'primary')).toBeVisible();
  const toggle = frameOf(page).getByRole('button', { name: 'Wat verstuurt dit?' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(frameOf(page).getByText('Verlaat jouw browser')).toBeVisible();
  await expect(frameOf(page).getByText('"door"')).toBeVisible();
});

test('carry on closes the door panel, and a preview sends nothing', async ({ page, request }) => {
  await openLabs(page);
  await preview(page, 'door');
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).getByRole('button', { name: 'Verder naar de resultaten' }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  const db = await readDb(request);
  expect(db.agg).toHaveLength(0);
});

test('Escape closes the door panel', async ({ page }) => {
  await openLabs(page);
  await preview(page, 'door');
  await expect(act(page, 'primary')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
});

// ── the demo build: verified hours and a number, labelled as demo data ─────
test('demo, open hours: the call button is a tel: link with the number, and the panel says Demo data', async ({ page, context, request }) => {
  test.skip(!DEMO, 'needs the demo Door: npm run e2e:demo');
  demoRan.push('open hours');
  await stubHelpSites(context);
  await page.clock.setFixedTime(SAT_OPEN);
  await seen(page, 4);
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  expect(await cardKind(page)).toBe('door');
  await expect(act(page, 'primary')).toHaveAttribute('href', 'tel:08002666436');
  await expect(act(page, 'primary')).toHaveText('Bel nu 0800 266 64 36');
  await expect(frameOf(page).locator('.drg')).toHaveText('Demodata');
  await expect(frameOf(page).locator('a[href^="tel:"]')).toHaveCount(1);
  await expect(frameOf(page).locator('a[href]')).toHaveCount(1);

  // The chat link is a help click to the allow-listed service, counted once as the door shape.
  const popup = context.waitForEvent('page');
  await frameOf(page).getByRole('button', { name: 'Of chat' }).click();
  const p = await popup;
  expect(p.url()).toBe('https://offlimits.nl/?src=doorway');
  await p.close();
  const db = await waitForAgg(request, (d) => d.agg.length > 0);
  expect(db.agg).toHaveLength(1);
  expect(db.agg[0]).toMatchObject({ format: 'door', outcome: 'clicked_help', route: 'nl-offlimits' });
});

test('demo, closed hours: one link to self-help that says when the line opens, and no call', async ({ page, context, request }) => {
  test.skip(!DEMO, 'needs the demo Door: npm run e2e:demo');
  demoRan.push('closed hours');
  await stubHelpSites(context);
  await page.clock.setFixedTime(SAT_CLOSED);
  await seen(page, 4);
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  await expect(act(page, 'primary')).toHaveText('De lijn opent om 09:30. Begin nu met zelfhulp →');
  await expect(act(page, 'primary')).not.toHaveAttribute('href');
  await expect(frameOf(page).locator('a[href^="tel:"]')).toHaveCount(0);
  const popup = context.waitForEvent('page');
  await act(page, 'primary').click();
  const p = await popup;
  expect(p.url()).toBe('https://stoppenismogelijk.eu/?src=doorway');
  await p.close();
  const db = await waitForAgg(request, (d) => d.agg.length > 0);
  expect(db.agg[0]).toMatchObject({ format: 'door', outcome: 'clicked_help', route: 'nl-stoppen' });
});

// Guard: the CI demo run must execute every demo test. A skip, or a grep that drops one, fails here instead of going green.
test('guard: every demo test ran in the CI demo run', () => {
  test.skip(!(DEMO && process.env.CI), 'checked only in the CI demo run (npm run e2e:demo)');
  expect(demoRan.sort()).toEqual(['closed hours', 'open hours']);
});
