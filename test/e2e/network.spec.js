import { test, expect } from '@playwright/test';
import { resetDb, waitForAgg, act, trigger, openPage, stubHelpSites, DOOR, PLATFORM, settle } from './helpers.js';

// Review H3 — the EVIDENCE behind the privacy claim: every request the real Door
// makes in a real browser, on the real mock platform.
const FIELDS = ['i', 'v', 'f', 't', 'o', 'r', 'e'];

test.beforeEach(async ({ request }) => { await resetDb(request); });
test.afterEach(async ({ page }) => { await settle(page); });

test('network: one host, POST only for writes, seven fields, no cookies, one storage key', async ({ page, context, request }) => {
  await stubHelpSites(context);
  const seen = [];
  page.on('request', (r) => seen.push({ url: r.url(), method: r.method(), body: r.postData(), headers: r.headers(), frame: r.frame()?.url() }));
  const responses = [];
  page.on('response', async (r) => responses.push({ url: r.url(), headers: await r.allHeaders().catch(() => ({})) }));

  await openPage(page);
  await trigger(page, 'search');
  await expect(act(page, 'primary')).toBeVisible();

  // Storage, while the Door is open: in the Door's own origin, exactly one key,
  // holding counts and variant ids — never a route, an outcome or a query.
  const door = page.frames().find((f) => f.url().startsWith(DOOR));
  expect(await door.evaluate(() => Object.keys(localStorage))).toEqual(['doorway:v1']);
  expect(await door.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  expect(await door.evaluate(() => document.cookie)).toBe('');
  const state = JSON.parse(await door.evaluate(() => localStorage.getItem('doorway:v1')));
  expect(Object.keys(state).sort()).toEqual(['last', 'n', 'seen']);
  expect(JSON.stringify(state)).not.toMatch(/offlimits|nl-|clicked|dismissed/);

  const popup = context.waitForEvent('page');
  await act(page, 'primary').click();
  (await popup).close().catch(() => {});
  await waitForAgg(request, (d) => d.agg.length > 0);

  const hosts = new Set(seen.map((r) => new URL(r.url).origin));
  expect([...hosts].filter((h) => ![PLATFORM, DOOR, 'null'].includes(h) && !h.startsWith('about') && !h.startsWith('data') && !h.startsWith('blob'))).toEqual([]);

  const doorReqs = seen.filter((r) => r.url.startsWith(DOOR));
  const writes = doorReqs.filter((r) => r.method !== 'GET');
  expect(writes.length).toBeGreaterThan(0);
  for (const w of writes) {
    expect(w.method).toBe('POST');
    expect(new URL(w.url).pathname).toMatch(/^\/v1\/(c|heartbeat|report)$/);
    const body = JSON.parse(w.body);
    expect(Object.keys(body).sort()).toEqual((new URL(w.url).pathname === '/v1/c' ? FIELDS : ['d', 'i', 'v']).sort());
    expect(w.headers.cookie).toBeUndefined();
    expect(w.headers.referer ?? '').toBe('');
  }
  expect(doorReqs.filter((r) => r.method === 'GET').map((r) => new URL(r.url).pathname).sort()).toEqual(['/v1/', '/v1/door.js']);

  for (const r of responses.filter((x) => x.url.startsWith(DOOR))) expect(r.headers['set-cookie']).toBeUndefined();
  expect(await context.cookies(PLATFORM, DOOR)).toEqual([]);

  // None of it in the platform's own origin.
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('network: the Door page cannot be told to talk to anyone else (CSP)', async ({ page }) => {
  await openPage(page);
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  const door = page.frames().find((f) => f.url().startsWith(DOOR));
  const outcome = await door.evaluate(async () => {
    const tries = {};
    for (const [k, fn] of Object.entries({
      offdomain: () => fetch('https://example.org/x', { mode: 'no-cors' }),
      sibling: () => fetch('http://127.0.0.1:8789/mock-platform/index.html', { mode: 'no-cors' }),
      img: () => new Promise((res, rej) => { const i = new Image(); i.onload = res; i.onerror = () => rej(new Error('blocked')); i.src = 'http://127.0.0.1:8789/x.gif'; }),
    })) {
      try { await fn(); tries[k] = 'ALLOWED'; } catch { tries[k] = 'blocked'; }
    }
    return tries;
  });
  expect(outcome).toEqual({ offdomain: 'blocked', sibling: 'blocked', img: 'blocked' });
});
