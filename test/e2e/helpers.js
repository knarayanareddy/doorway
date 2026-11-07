export const DOOR = 'http://127.0.0.1:8788';
export const PLATFORM = 'http://127.0.0.1:8789';

export const resetDb = (request) => request.get(`${DOOR}/__test/reset`);
export const readDb = async (request) => (await request.get(`${DOOR}/__test/db`)).json();

/** Poll until the aggregate table satisfies a predicate (events are fire-and-forget). */
export async function waitForAgg(request, pred, ms = 4000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await readDb(request);
    if (pred(last)) return last;
    await new Promise((r) => setTimeout(r, 100));
  }
  return last;
}

export const frameOf = (page) => page.frameLocator('iframe');
export const act = (page, name) => frameOf(page).locator(`[data-act="${name}"]`);

/** Trigger through the public API, the way a platform's own script would. */
export const trigger = (page, type = 'search') => page.evaluate((t) => { window.doorway.trigger(t); }, type);

export const openPage = async (page, path = '/mock-platform/index.html') => {
  await page.goto(PLATFORM + path);
  await page.waitForFunction(() => !!window.doorway);
};

/**
 * Stub the help services so tests never touch a real site. Only call this in a test
 * that clicks through to one: Playwright's request interception makes WebKit cancel
 * in-flight requests on navigation, which would hide the abandon (left_page) beacon.
 */
export const stubHelpSites = (context) =>
  context.route('https://**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>help</title>' }));

/**
 * End a test cleanly. A card left open is (correctly) counted as left_page when its page
 * goes away; that beacon must land before the next test resets the database.
 */
export async function settle(page) {
  await page.goto('about:blank').catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
}
