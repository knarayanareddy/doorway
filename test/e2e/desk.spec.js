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

test('the Desk page cannot be framed and talks only to its own origin', async ({ request }) => {
  const r = await request.get(`${DOOR}/desk`);
  expect(r.headers()['content-security-policy']).toMatch(/frame-ancestors 'none'/);
  expect(r.headers()['content-security-policy']).toMatch(/connect-src 'self'/);
});
