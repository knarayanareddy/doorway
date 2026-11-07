import { test, expect } from '@playwright/test';
import { resetDb, readDb, waitForAgg, frameOf, act, settle, PLATFORM, DOOR } from './helpers.js';

// Labs: the five parked decisions, built and tested but NOT shipped (docs/11). Every test here
// runs against the labs demo page, which opts in with data-labs on its script tag.
const LABS_PAGE = '/mock-platform/labs.html';

test.beforeEach(async ({ request }) => { await resetDb(request); });
test.afterEach(async ({ page }) => { await settle(page); });

const openLabs = async (page, { waveSeconds } = {}) => {
  if (waveSeconds) {
    await page.route('**' + LABS_PAGE, async (route) => {
      const r = await route.fetch();
      await route.fulfill({ response: r, body: (await r.text()).replace('data-wave-seconds="15"', `data-wave-seconds="${waveSeconds}"`) });
    });
  }
  await page.goto(PLATFORM + LABS_PAGE);
  await page.waitForFunction(() => !!window.doorway);
};
const preview = (page, shape) => page.evaluate((s) => { window.doorway.trigger('search', { preview: s }); }, shape);
const dialog = (page) => frameOf(page).locator('[role="dialog"]');
const kind = (page) => frameOf(page).locator('[data-core-card]').getAttribute('data-core-card');
const doorFrame = (page) => page.frames().find((f) => f.url().startsWith(DOOR + '/v1/'));
const storageOf = (page) => doorFrame(page).evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage) }));

// ── nothing leaks into the shipped Door ────────────────────────────────────
test('labs are off on the normal page: no labs parameters, and the sandbox is the shipped one', async ({ page }) => {
  await page.goto(PLATFORM + '/mock-platform/index.html');
  await page.waitForFunction(() => !!window.doorway);
  await page.evaluate(() => { window.doorway.trigger('search', { preview: 'fork' }); });
  await expect(page.locator('iframe')).toHaveCount(1);
  const f = await page.locator('iframe').evaluate((e) => ({ src: e.src, sandbox: e.getAttribute('sandbox') }));
  expect(f.src).not.toMatch(/[?&](x|p|ws)=/);
  expect(f.sandbox).toBe('allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  await expect(act(page, 'primary')).toBeVisible();
  expect(await kind(page), 'a forced shape is ignored without the preview lab').toBe('gate');
});

test('labs page: the quick-exit permission is granted to the frame, and nothing else is added', async ({ page }) => {
  await openLabs(page);
  await preview(page, 'gate');
  await expect(page.locator('iframe')).toHaveCount(1);
  const sandbox = await page.locator('iframe').getAttribute('sandbox');
  expect(sandbox).toBe('allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation');
});

// ── 1. quick exit ──────────────────────────────────────────────────────────
test('quick exit: a click leaves the page for a neutral site, and Back does not return to the forum', async ({ page, context, request }) => {
  await context.route('https://www.knmi.nl/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Weer</title>' }));
  await page.goto(PLATFORM + '/test/e2e/blank.html');
  await openLabs(page);
  // A real exposure (not a preview, which is never counted): the first visit gives the gate, which has the button.
  await page.evaluate(() => { window.doorway.trigger('search'); });
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).getByRole('button', { name: 'Snel weg' }).click();
  await page.waitForURL('https://www.knmi.nl/');
  await page.goBack();
  expect(page.url()).toBe(PLATFORM + '/test/e2e/blank.html');
  expect(page.url()).not.toContain('labs.html');
  // Counting the exit is best effort: leaving the page is the point, and Firefox and WebKit may cancel the
  // beacon when the top page navigates away. Where it is delivered it must be exactly one left_page.
  const db = await waitForAgg(request, (d) => d.agg.length > 0, 2500);
  if (test.info().project.name === 'chromium') expect(db.agg.map((r) => r.outcome)).toEqual(['left_page']);
  else expect(db.agg.map((r) => r.outcome).filter((o) => o !== 'left_page')).toEqual([]);
});

test('quick exit: Enter on the focused button works (it is a real activation); Escape only closes the Door', async ({ page, context }) => {
  await context.route('https://www.knmi.nl/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Weer</title>' }));
  await openLabs(page);
  await preview(page, 'gate');
  await expect(act(page, 'primary')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  expect(page.url()).toContain('labs.html');
  await preview(page, 'gate');
  await expect(act(page, 'primary')).toBeVisible();
  const quit = frameOf(page).getByRole('button', { name: 'Snel weg' });
  await quit.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL('https://www.knmi.nl/');
});

test('quick exit: a hostile host learns nothing but that the page went away', async ({ page, context }) => {
  await context.route('https://www.knmi.nl/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Weer</title>' }));
  await page.route('**/test/e2e/hostile.html', async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text()).replace('data-country="NL"', 'data-country="NL" data-labs="quick-exit,preview"') });
  });
  await page.goto(PLATFORM + '/test/e2e/hostile.html');
  await page.waitForFunction(() => !!window.doorway);
  await page.evaluate(() => { window.__captured.fetch.length = 0; window.doorway.trigger('search', { preview: 'gate' }); });
  await expect(act(page, 'primary')).toBeVisible();
  const before = await page.evaluate(() => window.__captured);
  expect(before.messages.filter((m) => m.origin === DOOR).map((m) => m.data)).toEqual([{ ready: true }]);
  await frameOf(page).getByRole('button', { name: 'Snel weg' }).click();
  await page.waitForURL('https://www.knmi.nl/');
});

// ── 2. holding results ─────────────────────────────────────────────────────
test('holding results: the platform blurs, always reveals when the Door settles, and is told nothing about the choice', async ({ page }) => {
  await openLabs(page);
  await page.fill('#search-input', 'test-trigger-red');
  await page.click('.search-btn');
  const main = page.locator('.main-content');
  await expect(main).toHaveClass(/dw-held/);
  await expect(main).toHaveAttribute('aria-busy', 'true');
  await expect(act(page, 'primary')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(main).not.toHaveClass(/dw-held/);
  await expect(main).not.toHaveAttribute('aria-busy', 'true');
  const told = await page.locator('#told-log li').allInnerTexts();
  const joined = told.join('\n');
  expect(joined).toMatch(/"outcome":"continued"/);
  expect(joined).toMatch(/"helpServiceId":null/);
  expect(joined).not.toMatch(/offlimits|clicked_help|dismissed|legal-|harm-|control-/i);
});

test('holding results: whichever way the person leaves, the same thing is revealed and the same thing is reported', async ({ browser }) => {
  const reported = [];
  for (const how of ['escape', 'exit', 'help']) {
    // a fresh context each time: this device must not have been warned before (a repeat would be the quiet pill)
    const context = await browser.newContext({ locale: 'nl-NL' });
    await context.route('https://**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>help</title>' }));
    const page = await context.newPage();
    await openLabs(page);
    await page.fill('#search-input', 'test-trigger-red');
    await page.click('.search-btn');
    await expect(act(page, 'primary')).toBeVisible();
    if (how === 'escape') await page.keyboard.press('Escape');
    else if (how === 'exit') await frameOf(page).locator('[data-act="secondary"]').click();
    else { const pop = context.waitForEvent('page'); await act(page, 'primary').click(); (await pop).close().catch(() => {}); }
    await expect(page.locator('.main-content')).not.toHaveClass(/dw-held/);
    reported.push((await page.locator('#told-log li').allInnerTexts()).join('|').replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z|\d{1,2}:\d{2}:\d{2}(\.\d+)?/g, 'T'));
    await context.close();
  }
  expect(new Set(reported).size, 'the platform cannot tell the three apart').toBe(1);
});

// ── 3. the Fork ────────────────────────────────────────────────────────────
test('fork: six honest paths, each leads somewhere different, and nothing about the choice is sent or stored', async ({ page, request }) => {
  await openLabs(page);
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST') posts.push({ path: new URL(r.url()).pathname, body: r.postData() }); });
  await preview(page, 'fork');
  await expect(act(page, 'primary')).toBeVisible();
  expect(await kind(page)).toBe('fork');
  const options = await frameOf(page).locator('.cb').allInnerTexts();
  expect(options).toHaveLength(6);
  const headlines = {};
  for (const [i, opt] of options.entries()) {
    await frameOf(page).locator('.cb', { hasText: opt }).click();
    headlines[opt] = await frameOf(page).locator('h2').innerText();
    if (i < options.length - 1) {
      // go back to the question by opening a fresh Door
      await page.keyboard.press('Escape');
      await expect(page.locator('iframe')).toHaveCount(0);
      await preview(page, 'fork');
      await expect(act(page, 'primary')).toBeVisible();
    }
  }
  expect(new Set(Object.values(headlines)).size, 'each answer leads to its own place').toBe(6);
  expect(Object.values(headlines).join(' ')).not.toMatch(/artikel|strafbaar|anoniem|politie/i);
  expect(await storageOf(page)).toEqual({ local: [], session: [] });
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  // A preview is a demonstration: six previews, and not one of them is counted or sends a counter request.
  expect(posts.filter((x) => x.path === '/v1/c'), 'no counter request for a preview').toEqual([]);
  const db = await readDb(request);
  expect(db.agg).toEqual([]);
});

test('fork: under 18 offers no link (no verified youth service), and "here for work" is not counted nor reported for a preview', async ({ page, context, request }) => {
  await context.route('https://**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>help</title>' }));
  await openLabs(page);
  await preview(page, 'fork');
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).locator('.cb', { hasText: 'jonger dan 18' }).click();
  await expect(frameOf(page).locator('h2')).toHaveText('Je zit niet in de problemen omdat je dit vraagt.');
  await expect(frameOf(page).locator('[data-act="secondary"]')).toHaveCount(0);
  expect(await frameOf(page).locator('a').count()).toBe(0);
  await frameOf(page).locator('[data-act="primary"]').click();
  await expect(page.locator('iframe')).toHaveCount(0);

  await preview(page, 'fork');
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).locator('.cb', { hasText: 'voor werk' }).click();
  await frameOf(page).locator('[data-act="primary"]').click();
  await expect(page.locator('iframe')).toHaveCount(0);
  const db = await readDb(request);
  expect(db.agg, 'the preview answer is not counted').toEqual([]);
  expect(db.reports, 'the preview report is not filed').toEqual([]);
});

test('fork: the help paths open the allow-listed service, and a preview help click is not counted', async ({ page, context, request }) => {
  await context.route('https://**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>help</title>' }));
  await openLabs(page);
  await preview(page, 'fork');
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).locator('.cb', { hasText: 'wil stoppen.' }).first().click();
  const pop = context.waitForEvent('page');
  await frameOf(page).locator('[data-act="primary"]').click();
  const p = await pop;
  expect(p.url()).toBe('https://offlimits.nl/?src=doorway');
  await p.close();
  const db = await readDb(request);
  expect(db.agg, 'a preview help click is not counted').toEqual([]);
});

test('fork: a keyboard user can reach the options and move on', async ({ page }) => {
  await openLabs(page);
  await preview(page, 'fork');
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await page.waitForTimeout(250);
  const first = frameOf(page).locator('.cb').first();
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(frameOf(page).locator('h2')).toHaveText('Dat kan gebeuren.');
  await expect(act(page, 'primary')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
});

// ── real exposures, counted ────────────────────────────────────────────────
// Previews are never counted (above). These drive the REAL loader instead: escalate.html loads the Door with
// data-labs="fork,wave" and no preview. Each Door left unanswered counts as left_page and moves the next press
// on one step, so press k shows shape k. Nothing is forced and nothing is previewed.
const ESCALATE_PAGE = '/mock-platform/escalate.html';
const reachPress = async (page, k) => {
  await page.goto(PLATFORM + ESCALATE_PAGE);
  await page.waitForFunction(() => !!window.doorway);
  for (let i = 1; i <= k; i++) {
    await page.locator('#escalate-press').click();
    await expect(frameOf(page).locator('[data-core-card]')).toHaveCount(1);
    if (i < k) {
      await page.goto(`${PLATFORM}${ESCALATE_PAGE}?step=${i}`);
      await page.waitForFunction(() => !!window.doorway);
    }
  }
};

test('a real fork exposure, through the loader, is counted: one fork row, in bucket 2, with its outcome', async ({ page, request }) => {
  await reachPress(page, 2);
  expect(await kind(page), 'the second real exposure is the Fork').toBe('fork');
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).locator('.cb').first().click();
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  const db = await waitForAgg(request, (d) => d.agg.some((r) => r.format === 'fork'));
  const forks = db.agg.filter((r) => r.format === 'fork');
  expect(forks).toHaveLength(1);
  expect(forks[0]).toMatchObject({ format: 'fork', bucket: '2', trigger: 'search', outcome: 'dismissed' });
});

test('a real wave exposure, through the loader, is counted in bucket 3 (the Wave is never started here)', async ({ page, request }) => {
  await reachPress(page, 3);
  expect(await kind(page), 'the third real exposure is the Wave').toBe('wave');
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
  const db = await waitForAgg(request, (d) => d.agg.some((r) => r.format === 'wave'));
  expect(db.agg.filter((r) => r.format === 'wave')).toEqual([expect.objectContaining({ format: 'wave', bucket: '3', trigger: 'search', outcome: 'dismissed' })]);
});

// ── 4. the Wave ────────────────────────────────────────────────────────────
test('wave: a guided exercise, a plan chosen from presets only, kept as a number in this tab only', async ({ page }) => {
  await openLabs(page, { waveSeconds: 10 });
  await preview(page, 'wave');
  await expect(act(page, 'primary')).toBeVisible();
  expect(await kind(page)).toBe('wave');
  const text = await dialog(page).innerText();
  expect(text, 'no labs or review caveat inside the card').not.toMatch(/Labs:|nog niet klinisch beoordeeld/);
  expect(text).toMatch(/een vaardigheid, geen behandeling/);
  expect(await frameOf(page).locator('textarea, input[type="text"], input:not([type])').count(), 'there is no free-text input anywhere').toBe(0);

  await frameOf(page).getByRole('button', { name: /^Begin/ }).click();
  await expect(frameOf(page).getByText('De golf stijgt. Adem in.')).toBeVisible();
  await expect(frameOf(page).getByText('De golf is gezakt.', { exact: false })).toBeVisible({ timeout: 14_000 });

  await frameOf(page).locator('.cb').nth(1).click();
  await expect(frameOf(page).getByText('Bewaard tot je dit tabblad sluit.')).toBeVisible();
  expect(await storageOf(page)).toEqual({ local: [], session: ['doorway:wave:v1'] });
  expect(await doorFrame(page).evaluate(() => sessionStorage.getItem('doorway:wave:v1'))).toBe('1');
  // the host cannot see it (different origin), and the labs page's own observer saw nothing
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  await expect(page.locator('#observed-count')).toHaveText(/: 0$/);
});

test('wave: the Glass Door says where the plan lives, and wiping removes it', async ({ page }) => {
  await openLabs(page, { waveSeconds: 10 });
  await preview(page, 'wave');
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).locator('.cb').first().click();
  expect((await storageOf(page)).session).toEqual(['doorway:wave:v1']);
  await frameOf(page).getByRole('button', { name: 'Wat verstuurt dit?' }).click();
  await expect(frameOf(page).getByText('Het is een nummer, geen tekst.')).toBeVisible();
  await frameOf(page).getByRole('button', { name: 'Wis wat dit apparaat onthoudt' }).click();
  await expect(frameOf(page).getByText('Gewist.')).toBeVisible();
  expect((await storageOf(page)).session).toEqual([]);
});

test('wave: the timer has no animation to switch off, and works with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLabs(page, { waveSeconds: 10 });
  await preview(page, 'wave');
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).getByRole('button', { name: /^Begin/ }).click();
  await expect(frameOf(page).getByText('Nog', { exact: false }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
});

// ── 5. the youth route ─────────────────────────────────────────────────────
test('youth route: the shipped bundle has no youth service, so the under-18 path has no link', async ({ page }) => {
  await openLabs(page);
  await preview(page, 'fork');
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).locator('.cb', { hasText: 'jonger dan 18' }).click();
  expect(await frameOf(page).locator('a, [data-act="secondary"]').count()).toBe(0);
  expect(await dialog(page).innerText()).not.toMatch(/helpwanted/i);
});

// ── the host stays blind through all of it ─────────────────────────────────
test('host-adversary: fork, wave and quick-exit labs change nothing the host can observe', async ({ page }) => {
  await page.route('**/test/e2e/hostile.html', async (route) => {
    const r = await route.fetch();
    await route.fulfill({ response: r, body: (await r.text()).replace('data-country="NL"', 'data-country="NL" data-labs="fork,wave,quick-exit,preview" data-wave-seconds="10"') });
  });
  await page.goto(PLATFORM + '/test/e2e/hostile.html');
  await page.waitForFunction(() => !!window.doorway);
  await page.evaluate(() => { for (const k of Object.keys(window.__captured)) window.__captured[k].length = 0; });
  for (const shape of ['fork', 'wave']) {
    await preview(page, shape);
    await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
    if (shape === 'fork') await frameOf(page).locator('.cb').nth(5).click();
    else await frameOf(page).locator('.cb').first().click();
    await page.keyboard.press('Escape');
    await expect(page.locator('iframe')).toHaveCount(0);
  }
  const c = await page.evaluate(() => window.__captured);
  expect(c.messages.filter((m) => m.origin === DOOR).map((m) => m.data)).toEqual([{ ready: true }, { settled: true }, { ready: true }, { settled: true }]);
  expect(c.fetch).toEqual([]);
  expect(c.xhr).toEqual([]);
  expect(c.beacon).toEqual([]);
  expect(c.storageReads.filter((k) => /doorway/.test(k))).toEqual([]);
  expect(await page.evaluate(() => [Object.keys(localStorage), Object.keys(sessionStorage)])).toEqual([[], []]);
});

// ── the Desk shows it ──────────────────────────────────────────────────────
// The rows below are POSTed straight to the edge, not produced by a visitor's journey: this checks the Desk's table, not the Door.
test('desk: the per-shape table shows labs shapes next to the shipped ones, with small cells hidden (synthetic rows POSTed straight to the edge, not a UI run)', async ({ page, request }) => {
  const ev = (f, v, o, e) => ({ i: 'inst_demo001', v, f, t: 'search', o, r: 'nl-offlimits', e });
  const send = (b) => request.post(`${DOOR}/v1/c`, { headers: { origin: DOOR }, data: b });
  for (let i = 0; i < 40; i++) await send(ev('gate', 'legal-01', i < 8 ? 'clicked_help' : 'left_page', '1'));
  for (let i = 0; i < 30; i++) await send(ev('fork', 'harm-01', i < 12 ? 'clicked_help' : 'dismissed', '2'));
  for (let i = 0; i < 25; i++) await send(ev('hallway', 'control-01', i < 14 ? 'clicked_help' : 'continued', '3'));
  await send(ev('wave', 'control-01', 'clicked_help', '3'));
  await page.goto(`${DOOR}/desk`);
  await page.fill('#inst', 'inst_demo001'); await page.fill('#tok', 'desk-demo-token');
  await page.click('#login button');
  await expect(page.locator('#shapes')).toBeVisible();
  const text = await page.locator('#shapes').innerText();
  expect(text).toMatch(/Gate \(what is this\?\)/);
  expect(text).toMatch(/Fork \(labs\)/);
  expect(text).toMatch(/Hallway/);
  expect(text).toMatch(/Wave \(labs\)[\s\S]*hidden \(under k\)/);
  expect(text).toMatch(/hidden \(under k\)/);
  const db = await readDb(request);
  expect(db.agg.some((r) => r.format === 'fork')).toBe(true);
});
