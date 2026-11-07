import { test, expect } from '@playwright/test';

/*
 * The Desk's live mode, against the REAL Door. The platform origin serves the built app at /app/ and
 * passes GET /__desk/agg through to the Door's /v1/agg. The Door is the oracle: every number the page
 * shows is compared with a direct call to /v1/agg with the same token.
 *
 * Needs: the demo servers running (npm run demo:app, or scripts/dev.mjs with a built app), with the
 * seeded demo install inst_demo001 and its public token desk-demo-token.
 */

const DOOR = process.env.DOOR_ORIGIN || 'http://127.0.0.1:8788';
const TOKEN = 'desk-demo-token';
const INSTALL = 'inst_demo001';
// Table cells show the short form; the full wording is the cell's title and aria-label.
const HIDDEN = 'hidden (<10)';
const HIDDEN_FULL = 'hidden: fewer than 10';

const LABEL = {
  gate: 'Gate (what is this?)',
  card: 'Card (why it matters)',
  hallway: 'Hallway (before you reach out)',
  door: 'Open door (still open?)',
  quiet: 'Quiet line',
  fork: 'Fork',
  wave: 'Wave',
};

const directAgg = async (request, days = 30) => {
  const res = await request.get(`${DOOR}/v1/agg?i=${INSTALL}&days=${days}`, { headers: { authorization: `Bearer ${TOKEN}` } });
  expect(res.status()).toBe(200);
  return res.json();
};

const openDesk = async (page) => {
  await page.goto('/app/');
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: 'The Desk' }).click();
  await expect(page.getByRole('heading', { name: 'The Desk' })).toBeVisible();
};

// The Desk loads nothing until asked: the token starts empty, and the demo button fills it and loads the numbers.
const openDeskLoaded = async (page) => {
  await openDesk(page);
  await page.getByRole('button', { name: 'Use the demo token' }).click();
};

// The name cell starts with the label (Fork/Wave add a 'labs' tag). Anchored, because 'researcher' contains 'search'.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rowFor = (page, label) => page.getByRole('row').filter({ has: page.getByRole('cell', { name: new RegExp(`^${escapeRe(label)}`) }) });

/** Expected text of one table row, from the Door's own values. */
const expectRow = async (page, label, { exposures, clicked, rate }) => {
  const row = rowFor(page, label);
  await expect(row).toHaveCount(1);
  const cells = row.getByRole('cell');
  await expect(cells.nth(1)).toHaveText(typeof exposures === 'number' ? String(exposures) : HIDDEN);
  await expect(cells.nth(2)).toHaveText(typeof clicked === 'number' ? String(clicked) : HIDDEN);
  const rateText = typeof rate === 'number' && typeof clicked === 'number' && typeof exposures === 'number'
    ? `${(rate * 100).toFixed(1)}% (${clicked} of ${exposures})`
    : HIDDEN;
  await expect(cells.nth(3)).toHaveText(rateText);
};

test('live numbers match a direct call to the Door (headline, shape, trigger, wording)', async ({ page, request }) => {
  const direct = await directAgg(request);
  await openDeskLoaded(page);

  await expect(page.getByTestId('stat-exposures')).toHaveText(String(direct.summary.exposures));
  const ct = direct.summary.clickThrough;
  await expect(page.getByTestId('stat-rate')).toHaveText(`${(ct.rate * 100).toFixed(1)}%`);
  await expect(page.getByText(direct.summary.label, { exact: true }).first()).toBeVisible();

  for (const f of direct.byFormat) {
    await expectRow(page, LABEL[f.format], f);
  }

  const search = direct.byTrigger.find((r) => r.key === 'search');
  await expectRow(page, 'Search', search);
  const control = direct.variantArms.find((r) => r.key === 'control');
  await expectRow(page, 'Control wording (offers the way out)', control);

  await expect(page.getByText(`${direct.droppedEvents} events could not be sent`)).toBeVisible();
});

test('suppressed cells read as hidden, never as 0', async ({ page, request }) => {
  const direct = await directAgg(request);
  const suppressed = direct.byFormat.filter((f) => f.clicked === null);
  expect(suppressed.length).toBeGreaterThan(0);
  await openDeskLoaded(page);
  for (const f of suppressed) {
    const cell = rowFor(page, LABEL[f.format]).getByRole('cell').nth(2);
    await expect(cell).toHaveText(HIDDEN);
    // The title sits on the span inside the cell (prototype/src/components/desk/parts.tsx), not on the td.
    await expect(cell.locator('[title]')).toHaveAttribute('title', HIDDEN_FULL);
  }
  // No cell in the by-shape table may show a bare 0 for a suppressed value.
  await expect(page.getByRole('table').filter({ hasText: 'Shape' }).getByRole('cell', { name: /^0$/ })).toHaveCount(0);
});

test('the days table highlights the flagged days and names the reasons', async ({ page, request }) => {
  const direct = await directAgg(request);
  const flagged = direct.days.filter((d) => d.flagged);
  expect(flagged.length).toBe(2);
  await openDeskLoaded(page);
  await expect(page.getByTestId('flagged-day')).toHaveCount(flagged.length);
  for (const d of flagged) {
    const reasons = direct.summary.flaggedDays.find((f) => f.day === d.day).reasons.join('; ');
    await expect(page.getByTestId('flagged-day').filter({ hasText: d.day })).toContainText(`flagged: ${reasons}`);
  }
});

test('the adoption ladder is honest: Level 3 of 3 measured, two rungs not measured and not ticked', async ({ page }) => {
  await openDeskLoaded(page);
  await expect(page.getByRole('heading', { name: 'Level 3 of 3 measured' })).toBeVisible();
  await expect(page.getByTestId('badge-level')).toHaveText('Doorway · Level 3 of 3 measured');

  const rungs = page.getByTestId('rung');
  await expect(rungs).toHaveCount(3);
  for (const name of ['Installed', 'Gate on', 'Shift on']) {
    await expect(rungs.filter({ hasText: `${name}: done` })).toHaveCount(1);
  }

  const unmeasured = page.getByTestId('not-measured');
  await expect(unmeasured).toHaveCount(2);
  await expect(unmeasured.filter({ hasText: 'Routes current' })).toContainText('NOT MEASURED BY THE DESK');
  await expect(unmeasured.filter({ hasText: 'Glass audited' })).toContainText('NOT MEASURED BY THE DESK');
  for (const li of await unmeasured.all()) {
    await expect(li.locator('svg.lucide-check')).toHaveCount(0);
  }
  // No public badge and no fabricated level 5 in live mode.
  await expect(page.getByText('Level 5', { exact: false })).toHaveCount(0);
  await expect(page.getByText(/^Public badge/)).toHaveCount(0);
});

test('a wrong token is refused in plain words, and no numbers are shown', async ({ page }) => {
  await openDesk(page);
  await page.getByLabel('Desk token').fill('not-the-token');
  await page.getByRole('button', { name: 'Show numbers' }).click();
  await expect(page.getByRole('alert')).toContainText('token not accepted');
  await expect(page.getByTestId('stat-exposures')).toHaveCount(0);
});

test('the Door being down says so in plain words, without a stack trace', async ({ page }) => {
  await page.route('**/__desk/agg**', (route) => route.abort());
  await openDeskLoaded(page);
  await expect(page.getByRole('alert')).toContainText('the demo servers are not running: npm run demo:app');
  await expect(page.getByRole('alert')).not.toContainText('TypeError');
});

test('a 502 from the proxy gets the same plain message', async ({ page }) => {
  await page.route('**/__desk/agg**', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: '{"error":"door unreachable"}' }));
  await openDeskLoaded(page);
  await expect(page.getByRole('alert')).toContainText('the demo servers are not running: npm run demo:app');
});

test('an older Door without some keys shows "not reported", and does not crash', async ({ page, request }) => {
  await page.route('**/__desk/agg**', async (route) => {
    const search = new URL(route.request().url()).search;
    const res = await request.get(`${DOOR}/v1/agg${search}`, { headers: { authorization: `Bearer ${TOKEN}` } });
    const j = await res.json();
    delete j.byFormat;
    delete j.days;
    delete j.droppedEvents;
    delete j.falsePositiveReports;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(j) });
  });
  await openDeskLoaded(page);
  await expect(page.getByTestId('stat-exposures')).toBeVisible();
  await expect(page.getByText('not reported by this Door', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('not reported by this Door.', { exact: true })).toHaveCount(4);
});

test('synthetic mode is labelled SYNTHETIC and shows no live numbers', async ({ page }) => {
  await openDesk(page);
  await page.getByRole('button', { name: 'Synthetic 20,000-member forum' }).click();
  await expect(page.getByRole('button', { name: 'Synthetic 20,000-member forum' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('SYNTHETIC — not from any Door')).toBeVisible();
  await expect(page.getByText('SYNTHETIC ILLUSTRATION')).toBeVisible();
  await expect(page.getByText('Illustrative badge', { exact: false })).toBeVisible();
  await expect(page.getByTestId('stat-exposures')).toHaveCount(0);
  // The synthetic view has no counter of its own: no 'live from this browser' tally and no clear button.
  await expect(page.getByText('Live from this browser')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear demo counts' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Live demo install' }).click();
  await page.getByRole('button', { name: 'Use the demo token' }).click();
  await expect(page.getByTestId('stat-exposures')).toBeVisible();
});

test('nothing loads until asked: the token starts empty and no Desk request leaves before a click', async ({ page }) => {
  const agg = [];
  page.on('request', (r) => { if (r.url().includes('/__desk/agg')) agg.push(r.url()); });
  await openDesk(page);
  await expect(page.getByLabel('Desk token')).toHaveValue('');
  await expect(page.getByText('Demo install: the demo token is desk-demo-token (public on purpose)')).toBeVisible();
  await expect(page.getByTestId('stat-exposures')).toHaveCount(0);
  expect(agg).toEqual([]);
});

test('no request leaves for another origin, and the token never reaches the URL or storage', async ({ page, baseURL }) => {
  const seen = [];
  const auth = [];
  page.on('request', (r) => {
    seen.push(r.url());
    if (r.url().includes('/__desk/agg')) auth.push(r.headers().authorization ?? '');
  });
  await openDesk(page);
  await page.getByLabel('Desk token').fill(TOKEN);
  await page.getByRole('button', { name: 'Show numbers' }).click();
  await expect(page.getByTestId('stat-exposures')).toBeVisible();

  const origin = new URL(baseURL).origin;
  expect(seen.some((u) => u.includes('/__desk/agg'))).toBe(true);
  const foreign = seen.filter((u) => !/^(data|blob):/.test(u) && new URL(u).origin !== origin);
  expect(foreign).toEqual([]);
  expect(seen.some((u) => u.includes(TOKEN))).toBe(false);
  expect(auth.every((h) => h === `Bearer ${TOKEN}`)).toBe(true);

  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(stored).not.toContain(TOKEN);
});

test('screenshot of the live Desk, full page', async ({ page }, testInfo) => {
  await openDeskLoaded(page);
  await expect(page.getByTestId('stat-exposures')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('desk-live-full.png'), fullPage: true });
});
