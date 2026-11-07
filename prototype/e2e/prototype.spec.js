import { test, expect } from '@playwright/test';
import { DOOR, PLATFORM, resetDb, waitForAgg, frameOf, act, settle } from '../../test/e2e/helpers.js';

// The Live prototype tab, against the REAL loader and the REAL Door (the edge Worker on DOOR, served with the
// platform at PLATFORM/app/). These tests press, walk away, answer and preview exactly as a person would, and
// read what the Door and the edge did. Selectors and waits mirror test/e2e/escalate.spec.js.
const APP = '/app/';
const SHAPES = ['gate', 'fork', 'wave', 'hallway', 'door'];
const ALLOWED_FIELDS = ['e', 'f', 'i', 'o', 'r', 't', 'v'];
const FIRE = /Fire a trigger/;
// The walk-away choice, made before pressing (Demo controls). The group is labelled by the visible text.
const choice = (page) => page.getByRole('group', { name: 'When the Door is open:' });
const AUTO = /^Walk away automatically after 10 seconds$/;
const MANUAL = /^I will reload the page myself \(Cmd\+R\)$/;
const MANUAL_LINE = /Leave the Door alone and reload this page \(Cmd\+R \/ Ctrl\+R\) — that is what walking away looks like\. Closing it counts as a response\./;
const pickWalk = (page, name) => choice(page).getByRole('button', { name }).click();

// Automatic walk-away holds 10 s per press, so the five-press walk needs more than the default.
test.setTimeout(180_000);
test.beforeEach(async ({ request }) => { await resetDb(request); });
test.afterEach(async ({ page }) => { await settle(page); });

const openLive = (page) => page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Live prototype' }).click();
const openApp = async (page) => {
  await page.goto(PLATFORM + APP);
  await openLive(page);
  await expect(page.getByRole('button', { name: FIRE })).toBeEnabled({ timeout: 15_000 });
  await page.waitForFunction(() => typeof window.doorway?.trigger === 'function');
};
const fire = (page) => page.getByRole('button', { name: FIRE }).click();
const cardKind = (page) => frameOf(page).locator('[data-core-card]').getAttribute('data-core-card');
const pressCount = (page) => page.getByTestId('press-count').textContent();
const currentStep = (page) => page.locator('[data-step][aria-current="step"]').getAttribute('data-step');
const reached = (page) => page.locator('[data-reached="true"]').count();
const nextHint = (page) => page.locator('[aria-live="polite"]').filter({ hasText: /^Next:/ });
// The page leaves by a real navigation: a marker set in this document is gone after the reload.
const markPage = (page) => page.evaluate(() => { window.__marker = true; });
const left = (page) => page.waitForFunction(() => window.__marker === undefined, undefined, { timeout: 20_000 });
// Each Door ends with one record. Waiting for it keeps a late beacon out of the next test's database.
const recorded = (request, outcome) => waitForAgg(request, (d) => d.agg.some((r) => r.outcome === outcome), 4000);

test('the real loader is injected from /dist/latest, and window.doorway is that loader', async ({ page }) => {
  await openApp(page);
  const src = await page.evaluate(() => {
    const s = document.querySelector('script[src="/dist/latest/doorway.min.js"]');
    return s && { install: s.dataset.install, country: s.dataset.country, legal: s.dataset.legalJurisdiction, labs: s.dataset.labs, wave: s.dataset.waveSeconds };
  });
  expect(src).toEqual({ install: 'inst_demo001', country: 'NL', legal: 'NL', labs: 'fork,wave,preview', wave: '15' });
  await expect(page.getByText('Loaded from /dist/latest')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Fire a trigger shows the real Door, on the Door origin, at the gate', async ({ page }) => {
  await openApp(page);
  await fire(page);
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('iframe')).toHaveAttribute('src', new RegExp(`^${DOOR.replace(/\./g, '\\.')}/v1/`));
  await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
  expect(await cardKind(page)).toBe('gate');
  expect(await currentStep(page)).toBe('1');
  expect(await pressCount(page)).toBe('1');
  await expect(nextHint(page)).toHaveText('Next: Fork');
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('the walk-away choice is visible before pressing: automatic by default, and the manual line shows only in manual mode', async ({ page }) => {
  await openApp(page);
  await expect(choice(page).getByRole('button', { name: AUTO })).toHaveAttribute('aria-pressed', 'true');
  await expect(choice(page).getByRole('button', { name: MANUAL })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText(MANUAL_LINE)).toHaveCount(0);
  await pickWalk(page, MANUAL);
  await expect(choice(page).getByRole('button', { name: MANUAL })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(MANUAL_LINE)).toBeVisible();
  await pickWalk(page, AUTO);
  await expect(choice(page).getByRole('button', { name: AUTO })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(MANUAL_LINE)).toHaveCount(0);
});

test('manual mode: the page never moves on by itself, and the person reloading it moves the Shift on', async ({ page, request }) => {
  await openApp(page);
  await pickWalk(page, MANUAL);
  await markPage(page);
  await fire(page);
  await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
  expect(await cardKind(page)).toBe('gate');
  // Longer than the automatic hold: nothing reloads the page, and the Door stays open.
  await page.waitForTimeout(11_500);
  expect(await page.evaluate(() => window.__marker), 'the page was not reloaded by the demo').toBe(true);
  expect(await cardKind(page)).toBe('gate');
  // The person reloads the page (Cmd+R in a browser). The step is kept in the URL, so the next press escalates.
  await page.reload();
  await page.waitForFunction(() => !!window.doorway);
  await expect(page.getByRole('button', { name: FIRE })).toBeEnabled();
  expect(await pressCount(page)).toBe('1');
  expect(await currentStep(page)).toBe('1');
  await fire(page);
  await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
  expect(await cardKind(page)).toBe('fork');
  expect(await pressCount(page)).toBe('2');
  await recorded(request, 'left_page');
});

test('the walk-away choice survives a reload, and lasts for this tab only (sessionStorage, not localStorage)', async ({ page }) => {
  await openApp(page);
  await pickWalk(page, MANUAL);
  await page.reload();
  await page.waitForFunction(() => !!window.doorway);
  await expect(choice(page).getByRole('button', { name: MANUAL })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(MANUAL_LINE)).toBeVisible();
  const stored = await page.evaluate(() => ({
    session: sessionStorage.getItem('doorway.demo.walkAway'),
    local: Object.keys(localStorage).filter((k) => k.includes('walk')),
  }));
  expect(stored).toEqual({ session: 'manual', local: [] });
});

test('walking away and pressing again: fork, wave, hallway, door in order, and the timeline follows', async ({ page, request }) => {
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
    await markPage(page);
    await fire(page);
    await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
    seen.push(await cardKind(page));
    expect(await currentStep(page), `timeline highlights step ${i + 1}`).toBe(String(i + 1));
    expect(await reached(page)).toBe(i + 1);
    // Nobody answers: the page leaves after its hold, which the Door records as left_page.
    await left(page);
    await page.waitForFunction(() => !!window.doorway);
    expect(new URL(page.url()).searchParams.get('step')).toBe(String(i + 1));
    expect(await currentStep(page), 'the timeline survives the page moving on').toBe(String(i + 1));
    expect(await reached(page)).toBe(i + 1);
  }
  expect(seen).toEqual(SHAPES);
  await expect(nextHint(page)).toHaveText('Next: Door. It stays on the Door from here.');

  expect([...hosts], 'no request went to any origin but the platform and the Door').toEqual([]);
  expect(posts.filter((p) => p.path !== '/v1/c'), 'no POST other than the counter').toEqual([]);
  // Playwright does not always expose a beacon's body (the left_page sends), so only readable bodies are checked here.
  // The edge's own table is checked below and is the authority on what was counted.
  const counted = posts.filter((p) => p.path === '/v1/c');
  const records = counted.filter((p) => p.body != null).map((p) => JSON.parse(p.body));
  expect(records.length, 'every readable counter body').toBe(counted.filter((p) => p.body != null).length);
  for (const rec of records) expect(Object.keys(rec).sort()).toEqual(ALLOWED_FIELDS);

  const db = await waitForAgg(request, (d) => d.agg.filter((r) => r.outcome === 'left_page').length >= SHAPES.length);
  expect(db.agg.filter((r) => r.outcome === 'left_page').map((r) => r.format).sort()).toEqual([...SHAPES].sort());
});

test('a press while the Door is open is not counted, and the step moves on exactly once', async ({ page, request }) => {
  await openApp(page);
  await markPage(page);
  await fire(page);
  await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
  const first = await cardKind(page);
  // The button sits under the Door for a person; a script can still press it.
  await page.getByRole('button', { name: FIRE }).evaluate((b) => { b.click(); b.click(); });
  await expect(page.getByText('The Door is already open. This press was not counted.')).toBeVisible();
  expect(await pressCount(page)).toBe('1');
  expect(await cardKind(page)).toBe(first);
  await left(page);
  expect(new URL(page.url()).searchParams.get('step')).toBe('1');
  await recorded(request, 'left_page');
});

test('answering the Door is a response: the step stays, the timeline says so, and the next press shows the quiet line', async ({ page, request }) => {
  await openApp(page);
  await fire(page);
  await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByText('closed before this page moved on')).toBeVisible();
  expect(await pressCount(page)).toBe('1');
  await expect(nextHint(page)).toHaveText('Next: the Door decides. After an answer it shows the quiet line, not the next shape.');
  expect(new URL(page.url()).searchParams.get('a')).toBe('1');
  await recorded(request, 'dismissed');

  // Walking away after an answer keeps the answer: the Door remembers it, and the page must too.
  await markPage(page);
  await page.getByRole('button', { name: 'Walk away and come back' }).evaluate((b) => b.click());
  await left(page);
  await page.waitForFunction(() => !!window.doorway);
  await expect(nextHint(page)).toHaveText('Next: the Door decides. After an answer it shows the quiet line, not the next shape.');

  await markPage(page);
  await fire(page);
  await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
  expect(await cardKind(page)).toBe('quiet');
  expect(await pressCount(page)).toBe('2');
  // The quiet line has no buttons: it clears by itself (about 9 s) and the Door records a timeout. That is not a
  // response, so the page stays and the timeline still says the Door decides.
  await expect(page.locator('iframe')).toHaveCount(0, { timeout: 15_000 });
  await expect(nextHint(page)).toHaveText('Next: the Door decides. After an answer it shows the quiet line, not the next shape.');
  expect(await pressCount(page)).toBe('2');
  const db = await waitForAgg(request, (d) => d.agg.some((r) => r.format === 'quiet'));
  expect(db.agg.filter((r) => r.format === 'quiet').length).toBeGreaterThan(0);
});

test('a preview shows the chosen shape without moving the step or the Door memory', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: 'Fork', exact: true }).click();
  await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
  expect(await cardKind(page)).toBe('fork');
  expect(await pressCount(page)).toBe('0');
  expect(new URL(page.url()).searchParams.get('step'), 'a preview does not write a step').toBeNull();
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(await pressCount(page)).toBe('0');
  await expect(nextHint(page)).toHaveText('Next: Gate');

  // Every preview the Door accepts appears, and each one is a real card.
  for (const [label, kind] of [['Gate', 'gate'], ['Card', 'card'], ['Hallway', 'hallway'], ['Door', 'door'], ['Quiet line', 'quiet']]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
    expect(await cardKind(page), label).toBe(kind);
    await page.keyboard.press('Escape');
    await expect(page.locator('iframe')).toHaveCount(0);
  }
  expect(await pressCount(page)).toBe('0');
});

test('the forum search fires on test-trigger- and never passes the text to the Door', async ({ page }) => {
  const doorBodies = [];
  page.on('request', (r) => { if (new URL(r.url()).origin === DOOR) doorBodies.push(`${r.url()} ${r.postData() ?? ''}`); });
  await openApp(page);

  const box = page.getByPlaceholder(/Zoek op het forum|Search the forum/);
  await box.fill('modelbouw');
  await box.press('Enter');
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(await pressCount(page)).toBe('0');

  await box.fill('test-trigger-red');
  await box.press('Enter');
  await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
  expect(await cardKind(page)).toBe('gate');
  expect(await pressCount(page)).toBe('1');
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  for (const body of doorBodies) expect(body, 'the search text never reaches the Door').not.toContain('red');
});

test('nothing the Live tab offers pretends to be the Door: no banner arm, no realistic toggle, no reset, no language switch', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('button', { name: 'Reset device' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Banner/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Realistic/ })).toHaveCount(0);
  await expect(page.getByRole('switch')).toHaveCount(0);
  await expect(page.getByText('Reviewed-claims preview')).toHaveCount(0);
  await expect(page.getByText('This page cannot read or clear it.')).toBeVisible();
  await expect(page.getByText('No switch exists.')).toBeVisible();
});

test('with the loader unavailable the tab says so with the exact command, and fires nothing', async ({ page }) => {
  await page.route(/\/dist\/latest\/doorway\.min\.js$/, (r) => r.abort());
  await page.goto(PLATFORM + APP);
  await openLive(page);
  await expect(page.getByRole('alert')).toContainText('npm run demo:app');
  await expect(page.getByRole('button', { name: FIRE })).toBeDisabled();
  expect(await page.evaluate(() => typeof window.doorway)).toBe('undefined');
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('the Review page can preview a shape in the real Door', async ({ page }) => {
  await page.goto(PLATFORM + APP);
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Review & answers' }).click();
  await page.getByRole('button', { name: 'Walk the hallway' }).click();
  await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1, { timeout: 15_000 });
  expect(await cardKind(page)).toBe('hallway');
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  // Coming back to the Live tab must not open the same preview again.
  await openLive(page);
  await expect(page.getByRole('button', { name: FIRE })).toBeEnabled();
  await page.waitForTimeout(800);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('no request leaves for any origin but the platform and the Door, across the whole app', async ({ page }) => {
  const seen = [];
  page.on('request', (r) => seen.push(r.url()));
  page.on('websocket', (w) => seen.push(w.url()));
  await openApp(page);
  await fire(page);
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'The Desk' }).click();
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Review & answers' }).click();
  expect(seen.length).toBeGreaterThan(0);
  const allowed = new Set([new URL(PLATFORM).origin, DOOR]);
  const foreign = seen.filter((u) => !/^(data|blob|about):/.test(u) && !allowed.has(new URL(u).origin));
  expect(foreign).toEqual([]);
});

test('the Review page keeps its baseline note and carries no stale claims', async ({ page }) => {
  const stale = ['72 tests', 'eight fields', 'eight-field', 'zero screens built', 'hour of day', 'ported, not imported'];
  await page.goto(PLATFORM + APP);
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'Review & answers' }).click();
  await expect(page.getByTestId('baseline')).toContainText('3fbd10b');
  await expect(page.getByTestId('baseline')).toContainText('PR #4');
  const body = (await page.locator('body').innerText()).toLowerCase();
  for (const s of stale) expect(body, s).not.toContain(s);
});
