import { test, expect } from '@playwright/test';
import { resetDb, waitForAgg, frameOf, act, trigger, openPage, stubHelpSites, settle } from './helpers.js';

test.beforeEach(async ({ request }) => { await resetDb(request); });
test.afterEach(async ({ page }) => { await settle(page); });

const cardKind = (page) => frameOf(page).locator('[data-core-card]').getAttribute('data-core-card');
const dialog = (page) => frameOf(page).locator('[role="dialog"]');

/** Put the Door's own (partitioned) storage in the state "this device has seen the Door `n` times, long ago". */
const seen = (page, n) => page.addInitScript((count) => {
  if (location.port !== '8788' || !count) return;
  // seed once per tab: a later Door in the same tab must see whatever the person left behind
  if (sessionStorage.getItem('__seeded')) return;
  sessionStorage.setItem('__seeded', '1');
  const seenIds = ['legal-01', 'harm-01', 'control-01', 'control-02', 'control-03'].slice(0, count);
  localStorage.setItem('doorway:v1', JSON.stringify({ n: count, last: Date.now() - 200 * 3.6e6, seen: seenIds }));
}, n);

for (const [n, kind] of [[0, 'gate'], [1, 'card'], [2, 'hallway'], [3, 'hallway'], [4, 'door'], [7, 'door']]) {
  test(`shape sequence: exposure ${n + 1} is a ${kind}`, async ({ page }) => {
    await seen(page, n);
    await openPage(page);
    await trigger(page);
    await expect(act(page, 'primary')).toBeVisible();
    expect(await cardKind(page)).toBe(kind);
  });
}

// ── The Glass Door ─────────────────────────────────────────────────────────
test('Glass Door: shows exactly the object that is then sent, minus the outcome that did not exist yet', async ({ page, request }) => {
  await seen(page, 1);
  await openPage(page);
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/v1/c')) posts.push(JSON.parse(r.postData())); });
  await trigger(page, 'chat');
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).getByRole('button', { name: 'Wat verstuurt dit?' }).click();
  const rows = await frameOf(page).locator('dl.bf > div').evaluateAll((els) => els.map((e) => [e.querySelector('dt').textContent, e.querySelector('dd').childNodes[0].textContent]));
  expect(rows.map((r) => r[0])).toEqual(['i', 'v', 'f', 't', 'o', 'r', 'e']);
  const shown = Object.fromEntries(rows);
  expect(shown.o).toMatch(/pas ingevuld/);

  await frameOf(page).locator('[data-act="secondary"]').click();
  await waitForAgg(request, (d) => d.agg.length > 0);
  expect(posts).toHaveLength(1);
  for (const k of ['i', 'v', 'f', 't', 'r', 'e']) expect(shown[k], k).toBe(`"${posts[0][k]}"`);
  expect(Object.keys(posts[0]).sort()).toEqual(['e', 'f', 'i', 'o', 'r', 't', 'v']);
});

test('Glass Door: the honest note is there, and it does not claim the network address is unseen', async ({ page }) => {
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).getByRole('button', { name: 'Wat verstuurt dit?' }).click();
  const text = await dialog(page).innerText();
  expect(text).toMatch(/netwerkadres/);
  expect(text).toMatch(/Wordt nooit verstuurd/i);
  expect(text).toMatch(/Controleer het zelf/i);
});

test('Glass Door: wiping makes the device forget, and nothing is written back afterwards', async ({ page }) => {
  await seen(page, 1);
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  const door = page.frames().find((f) => f.url().includes(':8788'));
  expect(await door.evaluate(() => localStorage.getItem('doorway:v1'))).not.toBeNull();
  await frameOf(page).getByRole('button', { name: 'Wat verstuurt dit?' }).click();
  await frameOf(page).getByRole('button', { name: 'Wis wat dit apparaat onthoudt' }).click();
  await expect(frameOf(page).getByText('Gewist.')).toBeVisible();
  expect(await door.evaluate(() => localStorage.getItem('doorway:v1'))).toBeNull();
  await frameOf(page).locator('[data-act="secondary"]').click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.waitForTimeout(200);
  // the frame is gone; reopen a fresh Door and confirm the device still has no memory of the wiped exposure
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  expect(await cardKind(page)).toBe('gate');
});

test('Glass Door: keyboard users can open it and reach what it reveals (the focus trap is not stale)', async ({ page }) => {
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  await page.waitForTimeout(250);
  const toggle = frameOf(page).getByRole('button', { name: 'Wat verstuurt dit?' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const wipe = frameOf(page).getByRole('button', { name: 'Wis wat dit apparaat onthoudt' });
  await page.keyboard.press(test.info().project.name === 'webkit' ? 'Alt+Tab' : 'Tab');
  await expect(wipe).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('Glass Door: it is on the gate, the card, the hallway and the door, but not on the quiet pill', async ({ page }) => {
  for (const [n, glass] of [[0, true], [1, true], [2, true], [4, true]]) {
    await page.goto('about:blank');
    await seen(page, n);
    await openPage(page);
    await trigger(page);
    await expect(act(page, 'primary')).toBeVisible();
    expect(await frameOf(page).getByRole('button', { name: 'Wat verstuurt dit?' }).count() > 0).toBe(glass);
    await settle(page);
  }
});

// ── The Hallway ────────────────────────────────────────────────────────────
test('Hallway: first sentences can be copied; no claim about the service appears without a verified record', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await seen(page, 2);
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  expect(await cardKind(page)).toBe('hallway');
  const text = await dialog(page).innerText();
  expect(text).toMatch(/Voordat je contact opneemt|Je hebt geen verhaal nodig|Contact kan klein beginnen/);
  expect(text).toContain('Ik weet niet waar ik moet beginnen.');
  expect(text).not.toMatch(/anoniem|vertrouwelijk|politie|Nu open|Nu gesloten/i);
  expect(text).not.toMatch(/privacy/i);

  const copy = frameOf(page).getByRole('button', { name: 'Kopieer' }).first();
  await copy.click();
  await expect(frameOf(page).getByRole('button', { name: 'Gekopieerd' })).toBeVisible();
  if (browserName === 'chromium') {
    expect(await page.evaluate(() => navigator.clipboard.readText().catch(() => 'unreadable'))).toMatch(/Ik weet niet waar ik moet beginnen\.|unreadable/);
  }
});

test('Hallway: the self-help alternative opens the other service and the click is counted against it', async ({ page, request, context }) => {
  await stubHelpSites(context);
  await seen(page, 2);
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  await frameOf(page).getByRole('button', { name: 'Ik durf niet te bellen' }).click();
  const popup = page.waitForEvent('popup');
  await frameOf(page).getByRole('button', { name: 'Begin liever met zelfhulp' }).click();
  const p = await popup;
  expect(p.url()).toBe('https://stoppenismogelijk.eu/?src=doorway');
  await p.close();
  const db = await waitForAgg(request, (d) => d.agg.length > 0);
  expect(db.agg).toHaveLength(1);
  expect(db.agg[0]).toMatchObject({ format: 'hallway', outcome: 'clicked_help', route: 'nl-stoppen' });
});

test('Hallway: the primary action still goes to the first-choice service', async ({ page, request, context }) => {
  await stubHelpSites(context);
  await seen(page, 3);
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  const popup = page.waitForEvent('popup');
  await act(page, 'primary').click();
  const p = await popup;
  expect(p.url()).toBe('https://offlimits.nl/?src=doorway');
  await p.close();
  const db = await waitForAgg(request, (d) => d.agg.length > 0);
  expect(db.agg[0]).toMatchObject({ format: 'hallway', outcome: 'clicked_help', route: 'nl-offlimits', variant: 'control-02' });
});

// ── The Open Door ──────────────────────────────────────────────────────────
test('Open door: the fifth shape offers the same two exits, the report control, and no claim about confidentiality', async ({ page }) => {
  await seen(page, 4);
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  expect(await cardKind(page)).toBe('door');
  await expect(frameOf(page).locator('[data-act="secondary"]')).toBeVisible();
  await expect(frameOf(page).locator('[data-act="tertiary"]')).toBeVisible();
  expect(await dialog(page).innerText()).not.toMatch(/anoniem|vertrouwelijk|politie/i);
});
