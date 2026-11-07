import { test, expect } from '@playwright/test';

// The hosted demo: the platform (localhost:9111) and the Door (127.0.0.1:9112) are separate processes on
// separate origins. Nothing here resets data: the hosted servers have no /__test endpoints. Each test
// opens its own page and must not depend on the others.

const PLATFORM = 'http://localhost:9111';
const DOOR = 'http://127.0.0.1:9112';
const LABS = PLATFORM + '/mock-platform/labs.html';
const TOKEN = 'desk-demo-token';
const EVIL = 'https://evil.example';

const frameOf = (page) => page.frameLocator('iframe');

const openFork = async (page) => {
  await page.goto(LABS);
  await page.waitForFunction(() => !!window.doorway);
  await page.evaluate(() => { window.doorway.trigger('search', { preview: 'fork' }); });
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(frameOf(page).locator('[role="dialog"]')).toBeVisible();
};

test('the Door is a cross-origin iframe with a Door-origin src and the quick-exit sandbox, showing the Fork', async ({ page }) => {
  await openFork(page);
  await expect(page.locator('iframe')).toHaveAttribute('src', new RegExp('^' + DOOR.replace(/\./g, '\\.') + '/v1/'));
  const sandbox = await page.locator('iframe').getAttribute('sandbox');
  expect(sandbox.split(' ')).toContain('allow-top-navigation-by-user-activation');
  await expect(frameOf(page).locator('.cb')).toHaveCount(6);
});

test('the page cannot reach into the Door: no contentDocument, and its localStorage throws', async ({ page }) => {
  await openFork(page);
  const reach = await page.evaluate(() => {
    const frame = document.querySelector('iframe');
    let storageThrew = false;
    try { void frame.contentWindow.localStorage; } catch { storageThrew = true; }
    return { docIsNull: frame.contentDocument === null, storageThrew };
  });
  expect(reach).toEqual({ docIsNull: true, storageThrew: true });
});

test('end to end: a choice made in the Door reaches the Desk aggregate, which is labelled unauthenticated', async ({ page, request }) => {
  await openFork(page);
  await frameOf(page).locator('.cb').first().click();
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);

  const res = await request.get(`${DOOR}/v1/agg?i=inst_demo001`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.label).toMatch(/unauthenticated/);
  expect(body.byFormat.map((f) => f.format)).toContain('fork');
  expect(body.summary.exposures).toBeGreaterThanOrEqual(2000);
});

test('test endpoints and the repository are not exposed on the hosted servers', async ({ request }) => {
  expect((await request.get(`${DOOR}/__test/db`)).status()).toBe(404);
  expect((await request.get(`${DOOR}/__test/reset`)).status()).toBe(404);
  expect((await request.get(`${PLATFORM}/package.json`)).status()).toBe(404);
  expect((await request.get(`${PLATFORM}/edge/c.js`)).status()).toBe(404);
});

test('writes from a foreign origin, or from the platform origin, are refused; the Door origin is accepted', async ({ request }) => {
  const data = JSON.stringify({ i: 'inst_demo001', v: 'harm-01', f: 'fork', t: 'search', o: 'dismissed', r: 'nl-offlimits', e: '2' });
  const post = (origin) => request.post(`${DOOR}/v1/c`, { headers: { origin, 'content-type': 'application/json' }, data });
  expect((await post(EVIL)).status()).toBe(403);
  expect((await post(PLATFORM)).status()).toBe(403);
  expect((await post(DOOR)).status()).toBe(204);
});

test('the Desk shows the By shape table with a Fork (labs) row after logging in', async ({ page }) => {
  await page.goto(DOOR + '/desk');
  await page.fill('#inst', 'inst_demo001');
  await page.fill('#tok', TOKEN);
  await page.click('#login button');
  await expect(page.locator('#out')).toBeVisible();
  await expect(page.locator('#shapes tbody tr', { hasText: 'Fork (labs)' })).toHaveCount(1);
});
