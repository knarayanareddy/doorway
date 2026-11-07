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
