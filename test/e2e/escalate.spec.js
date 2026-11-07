import { test, expect } from '@playwright/test';
import { resetDb, waitForAgg, frameOf, act, settle, PLATFORM, DOOR } from './helpers.js';

// The escalation demo: one button, pressed repeatedly, on a page that is the platform. The Door is real and
// is loaded with data-labs="fork,wave" only. The page leaves after each Door (a visitor who walks away), so
// the Door records that as left_page, not as a choice, and escalates on the next press.
const ESCALATE = '/mock-platform/escalate.html';
const SHAPES = ['gate', 'fork', 'wave', 'hallway', 'door'];
const ALLOWED_FIELDS = ['e', 'f', 'i', 'o', 'r', 't', 'v'];

// Five presses, each held for the Door's 6 s before the page moves on: longer than the default 30 s.
test.setTimeout(120_000);
test.beforeEach(async ({ request }) => { await resetDb(request); });
test.afterEach(async ({ page }) => { await settle(page); });

const openEscalate = async (page) => {
  // Shorter Wave, as labs.spec.js does. The wave timer is never started here, so this only keeps the demo honest.
  await page.route(/\/mock-platform\/escalate\.html(\?.*)?$/, async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text()).replace('data-wave-seconds="15"', 'data-wave-seconds="10"') });
  });
  await page.goto(PLATFORM + ESCALATE);
  await page.waitForFunction(() => !!window.doorway);
};
const press = (page) => page.locator('#escalate-press').click();
const cardKind = (page) => frameOf(page).locator('[data-core-card]').getAttribute('data-core-card');
const current = (page) => page.locator('#escalate-steps li[aria-current="step"]').getAttribute('data-step');
const reached = (page) => page.locator('#escalate-steps li.reached').count();
const movedOn = (page, n) => page.waitForURL(new RegExp(`/mock-platform/escalate\\.html\\?step=${n}$`), { timeout: 15_000 });
// Each Door ends with one record. Waiting for it keeps a late beacon out of the next test's database.
const recorded = (request, outcome) => waitForAgg(request, (d) => d.agg.some((r) => r.outcome === outcome), 4000);

test('keep pressing: the real Door shows gate, fork, wave, hallway, door in order, and the timeline follows', async ({ page, request }) => {
  await openEscalate(page);
  const posts = [];
  const hosts = new Set();
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin === DOOR) {
      if (r.method() === 'POST') posts.push({ path: u.pathname, body: r.postData() });
      else if (r.method() !== 'GET') posts.push({ path: u.pathname, method: r.method() });
    } else if (u.origin !== PLATFORM) hosts.add(u.origin);
    else if (r.method() !== 'GET') posts.push({ path: u.pathname, method: r.method() });
  });

  const seen = [];
  for (let i = 0; i < SHAPES.length; i++) {
    await press(page);
    await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
    seen.push(await cardKind(page));
    expect(await current(page), `timeline highlights step ${i + 1}`).toBe(String(i + 1));
    expect(await reached(page)).toBe(i + 1);
    await movedOn(page, i + 1);
    await page.waitForFunction(() => !!window.doorway);
    expect(await current(page), 'the timeline survives the page moving on').toBe(String(i + 1));
  }
  expect(seen).toEqual(SHAPES);

  // Only the Door's own loading and its one allowed POST leave the page. Every POST is the seven-field record.
  expect([...hosts], 'no request went to any other origin').toEqual([]);
  expect(posts.filter((p) => p.path !== '/v1/c'), 'no POST other than the counter').toEqual([]);
  const counted = posts.filter((p) => p.path === '/v1/c');
  // WebKit does not expose the body of a beacon, so only there may a body be unreadable.
  const records = counted.filter((p) => p.body != null).map((p) => JSON.parse(p.body));
  if (test.info().project.name !== 'webkit') expect(records.length, 'every counter POST body was readable').toBe(counted.length);
  for (const rec of records) expect(Object.keys(rec).sort()).toEqual(ALLOWED_FIELDS);
  // Each page move leaves a left_page record (chromium only: other engines may cancel the beacon on unload).
  if (test.info().project.name === 'chromium') {
    const db = await waitForAgg(request, (d) => d.agg.filter((r) => r.outcome === 'left_page').length >= SHAPES.length);
    expect(db.agg.filter((r) => r.outcome === 'left_page').map((r) => r.format).sort()).toEqual([...SHAPES].sort());
  }
});

test('presses while the Door is open are not counted: the step does not move', async ({ page, request }) => {
  await openEscalate(page);
  await press(page);
  await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
  const first = await cardKind(page);
  // The button sits under the overlay for a person, but a script (or a keyboard that reaches it) can still press it.
  await page.evaluate(() => document.getElementById('escalate-press').click());
  await page.evaluate(() => document.getElementById('escalate-press').click());
  await expect(page.locator('#escalate-note')).toHaveText('The Door is already open. This press was not counted.');
  await expect(page.locator('#escalate-count')).toHaveText('Presses so far: 1');
  expect(await cardKind(page)).toBe(first);
  // It still moves on exactly one step, not three.
  await movedOn(page, 1);
  if (test.info().project.name === 'chromium') await recorded(request, 'left_page');
});

test('closing the Door yourself is reported as a response, and the step is not moved on', async ({ page, request }) => {
  await openEscalate(page);
  await press(page);
  await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('#escalate-note')).toContainText('closed before this page moved on');
  await expect(page.locator('#escalate-count')).toHaveText('Presses so far: 1');
  expect(page.url()).not.toMatch(/\?step=/);
  await recorded(request, 'dismissed');
});

test('start again: the timeline goes back to the start, and the page says what it cannot clear', async ({ page, request }) => {
  await openEscalate(page);
  await press(page);
  await movedOn(page, 1);
  await expect(page.locator('#escalate-count')).toHaveText('Presses so far: 1');
  await page.locator('#escalate-reset').click();
  await page.waitForURL(/escalate\.html\?step=0$/);
  await expect(page.locator('#escalate-count')).toHaveText('Presses so far: 0');
  await expect(page.locator('#escalate-next')).toHaveText('Next: gate');
  expect(await reached(page)).toBe(0);
  await expect(page.locator('body')).toContainText('The Door keeps its own memory of this browser, and this page cannot reach it.');
  if (test.info().project.name === 'chromium') await recorded(request, 'left_page');
});
