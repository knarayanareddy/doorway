import { test, expect } from '@playwright/test';
import { resetDb, DOOR, settle } from './helpers.js';

const ev = (o, extra = {}) => ({ i: 'inst_demo001', v: 'legal-01', f: 'gate', t: 'search', o, r: 'nl-offlimits', e: '1', ...extra });
const send = (request, data) => request.post(`${DOOR}/v1/c`, { headers: { origin: DOOR }, data });

test.beforeEach(async ({ request }) => { await resetDb(request); });
test.afterEach(async ({ page }) => { await settle(page); });

test('desk-denominator: the Desk shows exposures including those who left, labelled unauthenticated', async ({ page, request }) => {
  for (let i = 0; i < 12; i++) await send(request, ev('clicked_help'));
  for (let i = 0; i < 30; i++) await send(request, ev('dismissed'));
  for (let i = 0; i < 18; i++) await send(request, ev('left_page'));
  await send(request, ev('timeout'));

  await page.goto(`${DOOR}/desk`);
  await page.fill('#inst', 'inst_demo001');
  await page.fill('#tok', 'desk-demo-token');
  await page.click('#login button');
  await expect(page.locator('#label')).toHaveText(/Self-reported by the install's page, unauthenticated/);
  await expect(page.locator('#headline')).toContainText('61 exposures');
  await expect(page.locator('#headline')).toContainText('12 of 61');
  // the single timeout is under k, so it is hidden — and so is a second cell, so it cannot be subtracted
  const hidden = await page.locator('#outcomes td.sup').count();
  expect(hidden).toBe(2);
  await expect(page.locator('#headline')).toContainText('12 of 61');
});

test('the Desk rejects a wrong token, and a report can be filed without any text', async ({ page, request }) => {
  await page.goto(`${DOOR}/desk`);
  await page.fill('#inst', 'inst_demo001');
  await page.fill('#tok', 'nope');
  await page.click('#login button');
  await expect(page.locator('#err')).toHaveText(/Wrong install id or token/);

  await page.fill('#tok', 'desk-demo-token');
  await page.click('#login button');
  await expect(page.locator('#out')).toBeVisible();
  await page.selectOption('#reason', 'journalist');
  await page.click('#report button');
  await expect(page.locator('#rmsg')).toHaveText('Recorded.');
  const db = await (await request.get(`${DOOR}/__test/db`)).json();
  expect(db.reports).toHaveLength(1);
  expect(Object.keys(db.reports[0]).sort()).toEqual(['count', 'day', 'install', 'pack', 'reason', 'trigger']);
});

test('desk panels: breakdowns, outcome bar, ladder and caveat render from the same numbers, with small cells hidden', async ({ page, request }) => {
  for (let i = 0; i < 12; i++) await send(request, ev('clicked_help'));
  for (let i = 0; i < 18; i++) await send(request, ev('dismissed'));
  for (let i = 0; i < 12; i++) await send(request, ev('left_page', { f: 'card', v: 'harm-01', t: 'chat', e: '2', r: 'nl-stoppen' }));
  for (let i = 0; i < 2; i++) await send(request, ev('clicked_help', { f: 'hallway', v: 'control-02', t: 'nav', e: '3', r: 'xx-none' }));

  await page.goto(`${DOOR}/desk`);
  await page.fill('#inst', 'inst_demo001');
  await page.fill('#tok', 'desk-demo-token');
  await page.click('#login button');
  await expect(page.locator('#level')).toHaveText('Level 2 of 3 measured');

  // outcome bar: three visible outcomes, drawn and named
  await expect(page.locator('#bar span')).toHaveCount(3);
  await expect(page.locator('#barkey')).toContainText('Asked for help 14');

  // triggers: navigation (2) is under k and its neighbour (chat) is hidden too
  await expect(page.locator('#triggers')).toContainText('Search');
  await expect(page.locator('#triggers')).toContainText('hidden: fewer than 10');
  expect(await page.locator('#triggers td.sup').count()).toBeGreaterThanOrEqual(2);

  // routes: xx-none is named as no route shown, never as a place
  await expect(page.locator('#routes')).toContainText('No route shown');
  await expect(page.locator('#routes')).not.toContainText('xx-none');
  await expect(page.locator('#routes')).toContainText('hidden: fewer than 10');

  // escalation: step 3 is under k, step 2 goes with it
  await expect(page.locator('#escalation')).toContainText('Step 1');
  await expect(page.locator('#escalation')).toContainText('40.0% (12 of 30)');
  expect(await page.locator('#escalation td.sup').count()).toBeGreaterThanOrEqual(2);

  // wording: the control arm has two exposures, so it and the other arm are hidden
  await expect(page.locator('#arms')).toContainText('Control wording (offers the way out)');
  expect(await page.locator('#arms td.sup').count()).toBeGreaterThanOrEqual(2);

  // ladder: two rungs the counter cannot see are listed, and never ticked
  await expect(page.locator('#ladder li.unmeasured')).toHaveCount(2);
  await expect(page.locator('#ladder')).toContainText('Routes current: NOT MEASURED BY THE DESK');
  await expect(page.locator('#ladder')).toContainText('Glass audited: NOT MEASURED BY THE DESK');
  await expect(page.locator('#ladder')).not.toContainText('☑ Routes current');

  // caveat box is on the page, and the page still has no inline script
  await expect(page.locator('#caveat')).toContainText('There is no time of day');
  expect(await page.locator('script:not([src])').count()).toBe(0);
});

test('the Desk page cannot be framed and talks only to its own origin', async ({ request }) => {
  const r = await request.get(`${DOOR}/desk`);
  expect(r.headers()['content-security-policy']).toMatch(/frame-ancestors 'none'/);
  expect(r.headers()['content-security-policy']).toMatch(/connect-src 'self'/);
});
