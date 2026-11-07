import { test, expect } from '@playwright/test';
import { DOOR, PLATFORM, resetDb, readDb, waitForAgg, frameOf, act, settle } from '../../test/e2e/helpers.js';

// The Live prototype tab, against the REAL loader and the REAL Door (the edge Worker on DOOR, served with the
// platform at PLATFORM/app/, built with DEMO_ROUTES=1 by `npm run demo:app`). Every press of "Fire a trigger"
// shows the next shape of the Door's `advance` lab, whatever the last exposure did. These tests press, close
// the Door with its own controls, and read what the page and the edge did. Selectors mirror the real specs
// (test/e2e/escalate.spec.js, test/e2e/door-panel.spec.js, test/e2e/labs.spec.js).
const APP = '/app/';
const SHAPES = ['gate', 'fork', 'wave', 'hallway', 'door'];
const LABELS = ['Gate', 'Fork', 'Wave', 'Hallway', 'Door'];
const ALLOWED_FIELDS = ['e', 'f', 'i', 'o', 'r', 't', 'v'];
const FIRE = /Fire a trigger/;
const NEXT_DOOR = 'Next: Door. It stays on the Door from here.';
const ALREADY_OPEN = 'The Door is already open. This press was not counted.';
// Saturday 2026-11-07: 11:00 in Amsterdam is inside the demo hours (09:30-18:00).
const SAT_OPEN = new Date('2026-11-07T10:00:00Z');

test.setTimeout(120_000);
test.beforeEach(async ({ request }) => { await resetDb(request); });
test.afterEach(async ({ page }) => { await settle(page); });

// The Live prototype is the default tab (no ?tab parameter).
const openApp = async (page) => {
  await page.goto(PLATFORM + APP);
  await expect(page.getByRole('button', { name: FIRE })).toBeEnabled({ timeout: 15_000 });
  await page.waitForFunction(() => typeof window.doorway?.trigger === 'function');
};
const fire = (page) => page.getByRole('button', { name: FIRE }).click();
const card = (page) => frameOf(page).locator('[data-core-card]');
const cardKind = (page) => card(page).getAttribute('data-core-card');
const pressCount = (page) => page.getByTestId('press-count').textContent();
const currentStep = (page) => page.locator('[data-step][aria-current="step"]').getAttribute('data-step');
const reached = (page) => page.locator('[data-reached="true"]').count();
const nextHint = (page) => page.locator('[aria-live="polite"]').filter({ hasText: /^Next:/ });
// Escape reaches the Door only when the Door's frame has focus (the platform's own keydown listener is on the parent).
const closeDoor = async (page) => {
  await page.locator('iframe').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
};
// Each Door ends with one record. Waiting for it keeps a late beacon out of the next test's database.
const recorded = (request, outcome, n = 1) => waitForAgg(request, (d) => d.agg.filter((r) => r.outcome === outcome).length >= n, 6000);
const sessionCount = (page) => page.evaluate(() => sessionStorage.getItem('doorway.demo.presses'));

test('the real loader is injected from /dist/latest, and window.doorway is that loader', async ({ page }) => {
  await openApp(page);
  const src = await page.evaluate(() => {
    const s = document.querySelector('script[src="/dist/latest/doorway.min.js"]');
    return s && { install: s.dataset.install, country: s.dataset.country, legal: s.dataset.legalJurisdiction, labs: s.dataset.labs, wave: s.dataset.waveSeconds };
  });
  expect(src).toEqual({ install: 'inst_demo001', country: 'NL', legal: 'NL', labs: 'fork,wave,preview,advance', wave: '15' });
  await expect(page.getByText('Loaded from /dist/latest')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Fire a trigger shows the real Door, on the Door origin, at the gate, and the timeline follows', async ({ page }) => {
  await openApp(page);
  await fire(page);
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('iframe')).toHaveAttribute('src', new RegExp(`^${DOOR.replace(/\./g, '\\.')}/v1/`));
  await expect(card(page)).toHaveCount(1);
  expect(await cardKind(page)).toBe('gate');
  expect(await currentStep(page)).toBe('1');
  expect(await reached(page)).toBe(1);
  expect(await pressCount(page)).toBe('1');
  await expect(nextHint(page)).toHaveText('Next: Fork');
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await closeDoor(page);
  // Closing the Door does not move the count: the next press is the next shape, whatever happened here.
  expect(await pressCount(page)).toBe('1');
  await expect(nextHint(page)).toHaveText('Next: Fork');
});

test('pressing again in ONE page walks gate, fork, wave, hallway, door, and then stays on the door', async ({ page, request }) => {
  await openApp(page);
  const hosts = new Set();
  const posts = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.origin !== new URL(PLATFORM).origin && u.origin !== DOOR) hosts.add(u.origin);
    if (u.origin === DOOR && r.method() !== 'GET') posts.push({ path: u.pathname, body: r.postData() });
  });

  const seen = [];
  for (let i = 0; i < SHAPES.length; i++) {
    await fire(page);
    await expect(card(page)).toHaveCount(1);
    seen.push(await cardKind(page));
    expect(await pressCount(page)).toBe(String(i + 1));
    expect(await currentStep(page), `timeline highlights step ${i + 1}`).toBe(String(i + 1));
    expect(await reached(page)).toBe(i + 1);
    await closeDoor(page);
    expect(await currentStep(page), 'the timeline stays after the Door closes').toBe(String(i + 1));
    const next = i + 1 < SHAPES.length ? `Next: ${LABELS[i + 1]}` : NEXT_DOOR;
    await expect(nextHint(page)).toHaveText(next);
  }
  expect(seen).toEqual(SHAPES);

  // Press six: the Door stays on the door shape, and the timeline says so.
  await fire(page);
  await expect(card(page)).toHaveCount(1);
  expect(await cardKind(page)).toBe('door');
  expect(await pressCount(page)).toBe('6');
  expect(await reached(page)).toBe(5);
  await closeDoor(page);
  await expect(nextHint(page)).toHaveText(NEXT_DOOR);

  expect(new URL(page.url()).searchParams.has('step'), 'the page does not write a step to the URL').toBe(false);
  expect([...hosts], 'no request went to any origin but the platform and the Door').toEqual([]);
  expect(posts.filter((p) => p.path !== '/v1/c'), 'no POST other than the counter').toEqual([]);
  // Playwright does not always expose a beacon's body, so only readable bodies are checked; the edge's table is the authority.
  const counted = posts.filter((p) => p.path === '/v1/c');
  const readable = counted.filter((p) => p.body != null).map((p) => JSON.parse(p.body));
  for (const rec of readable) expect(Object.keys(rec).sort()).toEqual(ALLOWED_FIELDS);

  const db = await recorded(request, 'dismissed', 6);
  expect(db.agg.filter((r) => r.outcome === 'dismissed').map((r) => r.format).sort()).toEqual(['door', 'door', 'gate', 'fork', 'hallway', 'wave'].sort());
});

test('the door shape at step 5+ is a dark panel with the call button "Bel nu", a tel: link, and the Demodata chip', async ({ page, request }) => {
  await page.clock.setFixedTime(SAT_OPEN);
  await openApp(page);
  for (let i = 0; i < 5; i++) {
    await fire(page);
    await expect(card(page)).toHaveCount(1);
    if (i < 4) await closeDoor(page);
  }
  expect(await cardKind(page)).toBe('door');
  await expect(act(page, 'primary')).toBeVisible();
  await expect(act(page, 'primary')).toHaveAttribute('href', 'tel:08002666436');
  await expect(act(page, 'primary')).toHaveText('Bel nu 0800 266 64 36');
  await expect(frameOf(page).locator('.drg')).toHaveText('Demodata');
  await expect(frameOf(page).locator('a[href^="tel:"]')).toHaveCount(1);
  await expect(frameOf(page).locator('[data-act="primary"]')).toHaveCount(1);
  // The Door's own "carry on" control closes it. Not a help click: nothing is sent to a service.
  await frameOf(page).getByRole('button', { name: 'Verder naar de resultaten' }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(await pressCount(page)).toBe('5');
  await expect(nextHint(page)).toHaveText(NEXT_DOOR);
  await recorded(request, 'dismissed', 5);
});

test('a press while the Door is open is not counted, and the next press moves on exactly one step', async ({ page }) => {
  await openApp(page);
  await fire(page);
  await expect(card(page)).toHaveCount(1);
  const first = await cardKind(page);
  // The button sits under the Door for a person; a script can still press it. Both presses are the same promise.
  await page.getByRole('button', { name: FIRE }).evaluate((b) => { b.click(); b.click(); });
  await expect(page.getByText(ALREADY_OPEN)).toBeVisible();
  expect(await pressCount(page)).toBe('1');
  expect(await cardKind(page)).toBe(first);
  await closeDoor(page);
  await fire(page);
  await expect(card(page)).toHaveCount(1);
  expect(await cardKind(page)).toBe('fork');
  expect(await pressCount(page)).toBe('2');
  await closeDoor(page);
});

test('previews show each shape without moving the timeline, and add no row to the edge', async ({ page, request }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await expect(card(page)).toHaveCount(1);
  expect(await cardKind(page)).toBe('fork');
  expect(await pressCount(page)).toBe('0');
  expect(new URL(page.url()).searchParams.has('step'), 'a preview does not write a step').toBe(false);
  await closeDoor(page);
  expect(await pressCount(page)).toBe('0');
  await expect(nextHint(page)).toHaveText('Next: Gate');

  // Every preview the Door accepts appears, and each one is a real card.
  for (const [label, kind] of [['Gate', 'gate'], ['Card', 'card'], ['Wave', 'wave'], ['Hallway', 'hallway'], ['Door', 'door'], ['Quiet line', 'quiet']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(card(page)).toHaveCount(1);
    expect(await cardKind(page), label).toBe(kind);
    await closeDoor(page);
  }
  expect(await pressCount(page)).toBe('0');
  expect((await readDb(request)).agg, 'a preview never counts').toHaveLength(0);
});

test('start again goes back to 0 with a note, and the count persists across reload in sessionStorage', async ({ page }) => {
  await openApp(page);
  for (let i = 0; i < 2; i++) {
    await fire(page);
    await expect(card(page)).toHaveCount(1);
    await closeDoor(page);
  }
  expect(await pressCount(page)).toBe('2');
  expect(await sessionCount(page)).toBe('2');

  await page.reload();
  await page.waitForFunction(() => !!window.doorway);
  await expect(page.getByRole('button', { name: FIRE })).toBeEnabled();
  expect(await pressCount(page), 'the count survives a reload').toBe('2');
  expect(await currentStep(page)).toBe('2');

  await page.getByRole('button', { name: 'Start the timeline again' }).click();
  expect(await pressCount(page)).toBe('0');
  expect(await sessionCount(page)).toBe('0');
  await expect(page.getByText('This timeline is back at 0.')).toBeVisible();
  await expect(nextHint(page)).toContainText("Next: wherever this browser's Door has got to");
  expect(await reached(page)).toBe(0);

  await page.reload();
  await page.waitForFunction(() => !!window.doorway);
  expect(await pressCount(page), 'the reset is kept across reload').toBe('0');
  await fire(page);
  await expect(card(page)).toHaveCount(1);
  // Start again resets the PAGE count only. The Door keeps its own memory of this browser (localStorage, on its
  // origin): two exposures were counted before the reset, so the Door's next shape is wave. The DemoPage note says so.
  // The hint says so too: after a reset it no longer promises the gate.
  expect(await cardKind(page)).toBe('wave');
  expect(await pressCount(page)).toBe('1');
  await closeDoor(page);
});

test('the forum search fires only for test-trigger-* and the typed text never reaches the Door', async ({ page }) => {
  const doorRequests = [];
  page.on('request', (r) => { if (new URL(r.url()).origin === DOOR) doorRequests.push(`${r.url()} ${r.postData() ?? ''}`); });
  await openApp(page);

  const box = page.getByPlaceholder(/Zoek op het forum|Search the forum/);
  await box.fill('modelbouw');
  await box.press('Enter');
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(await pressCount(page)).toBe('0');

  await box.fill('test-trigger-red');
  await box.press('Enter');
  await expect(card(page)).toHaveCount(1);
  expect(await cardKind(page)).toBe('gate');
  expect(await pressCount(page)).toBe('1');
  await closeDoor(page);
  expect(doorRequests.length, 'the Door was reached by the trigger').toBeGreaterThan(0);
  for (const body of doorRequests) expect(body, 'the search text never reaches the Door').not.toMatch(/test-trigger|red/);
});

test('nothing the Live tab offers pretends to be the Door: no banner arm, no realistic toggle, no reset, no walk-away, no language switch', async ({ page }) => {
  await openApp(page);
  const live = page.locator('main');
  await expect(page.getByRole('button', { name: 'Reset device' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Banner/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Realistic/ })).toHaveCount(0);
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'When the Door is open:' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Walk away and come back' })).toHaveCount(0);
  await expect(page.getByText('Reviewed-claims preview')).toHaveCount(0);
  await expect(page.getByText('This page cannot read or clear it.')).toBeVisible();
  await expect(page.getByText('No switch exists.')).toBeVisible();
  // No leftover wording about labs or review status inside the Live tab.
  const text = await live.innerText();
  expect(text).not.toMatch(/unreviewed/i);
  expect(text).not.toMatch(/\blabs?\b/i);
});

test('with the loader unavailable the tab says so with the exact command, and fires nothing', async ({ page }) => {
  await page.route(/\/dist\/latest\/doorway\.min\.js$/, (r) => r.abort());
  await page.goto(PLATFORM + APP);
  await expect(page.getByRole('alert')).toContainText('npm run demo:app');
  await expect(page.getByRole('button', { name: FIRE })).toBeDisabled();
  expect(await page.evaluate(() => typeof window.doorway)).toBe('undefined');
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('the five Door cards look different: gate, fork, wave, hallway and door differ in computed style', async ({ page }) => {
  await openApp(page);
  const looks = [];
  for (let i = 0; i < SHAPES.length; i++) {
    await fire(page);
    await expect(card(page)).toHaveCount(1);
    const kind = await cardKind(page);
    // The card is a shadow-root host (packages/shared/card.js): its box is .ovl > div, its button is .cta.
    const look = await card(page).evaluate((host) => {
      const root = host.shadowRoot;
      const pick = (el) => {
        const s = getComputedStyle(el);
        return [s.borderRadius, s.backgroundImage, s.boxShadow, s.backgroundColor, s.borderTopWidth].join(' | ');
      };
      const box = root?.querySelector('.ovl > div');
      const cta = root?.querySelector('.cta');
      return { box: box ? pick(box) : 'no box', cta: cta ? pick(cta) : 'no cta' };
    });
    looks.push({ kind, ...look });
    await closeDoor(page);
  }
  expect(looks.map((l) => l.kind)).toEqual(SHAPES);
  const combos = new Set(looks.map((l) => `${l.box} || ${l.cta}`));
  expect(combos.size, JSON.stringify(looks, null, 1)).toBeGreaterThanOrEqual(4);
});

test('no request leaves for any origin but the platform and the Door, across the whole app', async ({ page }) => {
  const seen = [];
  page.on('request', (r) => seen.push(r.url()));
  page.on('websocket', (w) => seen.push(w.url()));
  await openApp(page);
  await fire(page);
  await closeDoor(page);
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'The Desk' }).click();
  expect(seen.length).toBeGreaterThan(0);
  const allowed = new Set([new URL(PLATFORM).origin, DOOR]);
  const foreign = seen.filter((u) => !/^(data|blob|about):/.test(u) && !allowed.has(new URL(u).origin));
  expect(foreign).toEqual([]);
});
