import { test, expect } from '@playwright/test';
import { resetDb, readDb, waitForAgg, act, trigger, openPage } from './helpers.js';

// Review B1. The host page is declared an adversary. This page wraps fetch, XHR,
// sendBeacon, Storage, postMessage and watches the DOM, then tries to reach into
// the frame. It must learn nothing beyond "ready" and "settled".

test.beforeEach(async ({ request, context }) => {
  await resetDb(request);
  await context.route('https://**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>help</title>' }));
});

async function run(page, request, click) {
  await openPage(page, '/test/e2e/hostile.html');

  // Sanity: the instrumentation really works, so an empty capture below means something.
  await page.evaluate(() => { fetch('/test/e2e/hostile.html'); localStorage.setItem('own', '1'); localStorage.removeItem('own'); });
  expect((await page.evaluate(() => window.__captured.fetch)).length).toBe(1);
  
  await page.evaluate(() => { window.__captured.fetch.length = 0; window.__captured.storageWrites.length = 0; window.__captured.storageReads.length = 0; window.__captured.domAdded.length = 0; });

  await trigger(page, 'navigation');
  await expect(act(page, 'primary')).toBeFocused({ timeout: 3000 });
  const probe = await page.evaluate(() => window.__probe());
  await click(page);
  await expect(page.locator('iframe')).toHaveCount(0);
  await waitForAgg(request, (d) => d.agg.length > 0);
  return { probe, captured: await page.evaluate(() => window.__captured) };
}

test('host-adversary: the host learns that the door opened and closed, and nothing else', async ({ page, request }) => {
  const { probe, captured } = await run(page, request, async (p) => {
    const popup = p.waitForEvent('popup');
    await act(p, 'primary').click();
    await popup.then((x) => x.close()).catch(() => {});
  });

  // The only data that crossed the frame boundary into the host:
  const fromDoor = captured.messages.filter((m) => m.origin === 'http://127.0.0.1:8788').map((m) => m.data);
  expect(fromDoor).toEqual([{ ready: true }, { settled: true }]);

  // Nothing observable through the host's own realm.
  expect(captured.fetch, 'host fetch wrapper saw nothing').toEqual([]);
  expect(captured.xhr).toEqual([]);
  expect(captured.beacon).toEqual([]);
  expect(captured.storageReads.filter((k) => k.startsWith('doorway'))).toEqual([]);
  expect(captured.storageWrites.filter((k) => k.startsWith('doorway'))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);

  // The sbis-style result, if a platform listens, carries no outcome, route or variant.
  for (const d of captured.sbis) {
    expect(d.helpServiceId ?? null).toBeNull();
    expect(JSON.stringify(d)).not.toMatch(/offlimits|clicked_help|legal-|harm-|control-/);
  }

  // Everything the host injected into its own DOM was the frame element itself.
  expect(captured.domAdded.filter((n) => !/^(IFRAME|#text)$/.test(n))).toEqual([]);

  // Reaching into the frame is refused by the browser.
  expect(probe.frame).toBe(true);
  expect(probe.contentDocument).toBe('null');
  for (const k of ['contentDocument.body', 'contentWindow.document', 'contentWindow.localStorage', 'contentWindow.location.href']) {
    expect(probe[k], k).toMatch(/THROWS (SecurityError|TypeError)/);
  }
  expect(probe.sandbox).toBe('allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');

  // The truth did reach the counter — from the Door, not through the host.
  const db = await readDb(page.request);
  expect(db.agg).toHaveLength(1);
  expect(db.agg[0]).toMatchObject({ outcome: 'clicked_help', route: 'nl-offlimits', trigger: 'nav' });
});

test('host-adversary: dismissing is just as opaque', async ({ page, request }) => {
  const { captured } = await run(page, request, (p) => p.keyboard.press('Escape'));
  expect(captured.messages.filter((m) => m.origin === 'http://127.0.0.1:8788').map((m) => m.data)).toEqual([{ ready: true }, { settled: true }]);
  expect(captured.fetch).toEqual([]);
  expect((await readDb(page.request)).agg[0].outcome).toBe('dismissed');
});

test('host-adversary: a host that forges door messages cannot close or fake the door', async ({ page }) => {
  await openPage(page, '/test/e2e/hostile.html');
  await trigger(page);
  await expect(act(page, 'primary')).toBeVisible();
  await page.evaluate(() => { window.postMessage({ settled: true }, '*'); });
  await page.waitForTimeout(200);
  await expect(page.locator('iframe')).toHaveCount(1);
});
