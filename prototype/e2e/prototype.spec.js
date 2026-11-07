import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { DESTINATION_ALLOWLIST, isAllowedDestination } from '../../packages/core/src/route.js';
import { FIELDS } from '../../packages/core/src/counter.js';

const routes = JSON.parse(readFileSync(new URL('../../packages/doorway/src/routes.nl.json', import.meta.url), 'utf8'));

const SHAPES = ['Gate', 'Fork', 'Wave', 'Hallway', 'Open door'];
const SEVEN = ['i', 'v', 'f', 't', 'o', 'r', 'e'];
const BUNDLE_IDS = new Set(Object.values(routes.byLanguage).flatMap((e) => [e.default, ...e.alternatives].map((r) => r.id)));

const FORBIDDEN = ['artikel 252', 'article 252', 'strafbaar', 'criminal offence', 'anoniem', 'anonymous', 'vertrouwelijk', 'confidential', 'politie', 'police', 'helpwanted'];

const T = {
  nl: {
    lang: 'Nederlands',
    leave: 'Terug naar het forum',
    glass: 'Wat verstuurt dit?',
    skip: 'Sla over',
    dontKeep: 'Niet bewaren',
    keep: 'Bewaar tot dit tabblad sluit',
    work: 'Ik ben hier voor werk, onderzoek of zorg.',
    forkOptions: [
      'Ik kwam hier per ongeluk terecht.',
      'Ik heb hiernaar gezocht en ik wil stoppen.',
      'Ik wil stoppen, maar ik weet niet of dat lukt.',
      'Ik maak me zorgen over iemand anders.',
      'Ik ben jonger dan 18.',
      'Ik ben hier voor werk, onderzoek of zorg.',
    ],
  },
  en: {
    lang: 'English',
    leave: 'Back to the forum',
    glass: 'What does this send?',
    skip: 'Skip',
    dontKeep: 'Don’t keep',
    keep: 'Keep until I close this tab',
    work: 'I’m here for work, research or care.',
    forkOptions: [
      'I ended up here by accident.',
      'I’ve been looking, and I want to stop.',
      'I want to stop, but I’m not sure I can.',
      'I’m worried about someone else.',
      'I’m under 18.',
      'I’m here for work, research or care.',
    ],
  },
};

const doorway = (page) => page.getByTestId('doorway');
const tab = (page, name) => page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name }).click();
const shape = (page, label) => page.getByTitle(new RegExp(`^${label}:`)).click();
const fire = (page) => page.getByRole('button', { name: /Fire a trigger/ }).click();
const setLang = (page, lang) => page.getByRole('button', { name: T[lang].lang, exact: true }).click();
const setSynthetic = async (page, on) => {
  const sw = page.getByRole('switch', { name: /Reviewed-claims preview/ });
  if ((await sw.getAttribute('aria-checked')) !== String(on)) await sw.click();
};
const readLocal = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('doorway.local.v3') || 'null'));
const readEvents = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('doorway.demo.events') || '[]'));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__opened = [];
    window.open = (u) => { window.__opened.push(String(u)); return null; };
  });
  await page.goto('/');
  await tab(page, 'Live prototype');
});

/** Open the Glass Door if the shape has one, then return the full text of the rendered Door. */
async function doorText(page, lang) {
  const dw = doorway(page);
  await expect(dw).toBeVisible();
  const g = dw.getByRole('button', { name: T[lang].glass });
  if (await g.count()) await g.click();
  return dw.textContent();
}

/** Every Door state the app can render in one language: five shapes, quiet, banner, the Fork's six paths, the Wave's plan step. */
async function collectTexts(page, lang) {
  const texts = [];
  for (const s of SHAPES) {
    await shape(page, s);
    texts.push(await doorText(page, lang));
  }
  for (const name of ['Quiet', 'Banner']) {
    await page.getByRole('button', { name, exact: true }).click();
    texts.push(await doorText(page, lang));
  }
  for (const option of T[lang].forkOptions) {
    await shape(page, 'Fork');
    await doorway(page).getByRole('button', { name: option }).click();
    texts.push(await doorText(page, lang));
  }
  await shape(page, 'Wave');
  await doorway(page).getByRole('button', { name: T[lang].skip }).first().click();
  texts.push(await doorText(page, lang));
  await doorway(page).getByRole('button', { name: T[lang].dontKeep }).click();
  texts.push(await doorText(page, lang));
  return texts;
}

test('a) no request ever leaves the prototype origin: three tabs, five shapes, both languages', async ({ page, baseURL }) => {
  const seen = [];
  page.on('request', (r) => seen.push(r.url()));
  page.on('websocket', (w) => seen.push(w.url()));

  for (const lang of ['nl', 'en']) {
    await setLang(page, lang);
    await collectTexts(page, lang);
  }
  await tab(page, 'The Desk');
  await tab(page, 'Review & answers');
  await page.reload();
  await tab(page, 'Live prototype');

  expect(seen.length).toBeGreaterThan(0);
  const foreign = seen.filter((u) => !/^(data|blob|about):/.test(u) && new URL(u).origin !== new URL(baseURL).origin);
  expect(foreign).toEqual([]);
});

test('b) no legal, penalty, confidentiality or police wording in any Door state, in both languages (preview OFF)', async ({ page }) => {
  for (const lang of ['nl', 'en']) {
    await setLang(page, lang);
    const texts = await collectTexts(page, lang);
    expect(texts.length).toBeGreaterThan(14);
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const word of FORBIDDEN) expect(lower, `"${word}" in: ${text.slice(0, 120)}`).not.toContain(word);
    }
  }
});

test('b) with the reviewed-claims preview ON the synthetic claims appear, marked synthetic', async ({ page }) => {
  await setSynthetic(page, true);

  await shape(page, 'Gate');
  let text = await doorText(page, 'nl');
  expect(text).toContain('[SYNTHETIC]');
  expect(text).toContain('SYNTHETISCH record, beoordeeld door Demo Reviewer (synthetic)');
  expect(text).toContain('Reviewed-claims preview (SYNTHETIC)');
  expect(text).toContain('geen juridisch advies');

  await shape(page, 'Hallway');
  text = await doorText(page, 'nl');
  expect(text).toContain('[SYNTHETIC — not from Offlimits]');
  expect(text).toContain('Bevestigd door Demo Reviewer (synthetic)');
  expect(text).toMatch(/Nu open, tot \d\d:\d\d|Nu gesloten, opent om \d\d:\d\d/);

  await shape(page, 'Open door');
  text = await doorText(page, 'nl');
  expect(text).toMatch(/Nu open, tot \d\d:\d\d|Nu gesloten, opent om \d\d:\d\d/);

  await setLang(page, 'en');
  await shape(page, 'Gate');
  text = await doorText(page, 'en');
  expect(text).toContain('[SYNTHETIC]');
  expect(text).toContain('SYNTHETIC record, reviewed by Demo Reviewer (synthetic)');
  expect(text).toContain('not legal advice');

  await setSynthetic(page, false);
  await shape(page, 'Gate');
  text = await doorText(page, 'en');
  expect(text).not.toContain('SYNTHETIC');
});

test('b) by default no opening hours are shown and the gate is neutral', async ({ page }) => {
  await shape(page, 'Hallway');
  expect(await doorText(page, 'nl')).not.toMatch(/Nu open|Nu gesloten/);
  await shape(page, 'Open door');
  expect(await doorText(page, 'nl')).not.toMatch(/Nu open|Nu gesloten/);
  await shape(page, 'Gate');
  await expect(doorway(page)).toContainText('Dit materiaal is misbruik van een kind');
  await expect(doorway(page)).toContainText('Wij vragen niet wie je bent.');
});

test('c) every link and window.open target is on the destination allow-list', async ({ page }) => {
  const hrefs = new Set();
  const collect = async () => {
    for (const h of await page.locator('a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href')))) hrefs.add(h);
  };
  for (const synthetic of [false, true]) {
    await setSynthetic(page, synthetic);
    for (const lang of ['nl', 'en']) {
      await setLang(page, lang);
      for (const s of SHAPES) {
        await shape(page, s);
        await collect();
      }
      for (const name of ['Quiet', 'Banner']) {
        await page.getByRole('button', { name, exact: true }).click();
        await collect();
      }
      for (const option of T[lang].forkOptions) {
        await shape(page, 'Fork');
        await doorway(page).getByRole('button', { name: option }).click();
        await collect();
      }
    }
  }
  await tab(page, 'The Desk');
  await collect();

  const external = [...hrefs].filter((h) => !h.startsWith('#'));
  expect(external.length).toBeGreaterThan(0);
  for (const h of external) {
    expect(isAllowedDestination(h), h).toBe(true);
    expect(DESTINATION_ALLOWLIST).toContain(new URL(h).hostname);
  }
  expect(await page.evaluate(() => window.__opened)).toEqual([]);
});

test('c) routes come from the bundle: no Helpwanted, and the under-18 path offers no link', async ({ page }) => {
  await shape(page, 'Fork');
  await doorway(page).getByRole('button', { name: T.nl.forkOptions[4] }).click();
  await expect(doorway(page)).toContainText('docs/11');
  await expect(doorway(page)).toContainText('geverifieerde route voor jongeren');
  expect(await doorway(page).locator('a[href]').count()).toBe(0);

  await shape(page, 'Hallway');
  const hrefs = await doorway(page).locator('a[href]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  const bundleUrls = Object.values(routes.byLanguage).flatMap((e) => [e.default, ...e.alternatives].map((r) => r.url));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const h of hrefs) expect(bundleUrls).toContain(h);
});

test('d) the Glass Door shows exactly the seven Counter fields, and only those are stored', async ({ page }) => {
  expect(FIELDS).toEqual(SEVEN);
  await shape(page, 'Gate');
  await doorway(page).getByRole('button', { name: T.nl.glass }).click();
  const shown = await doorway(page).locator('[data-testid="glass-fields"] [data-field]').evaluateAll((els) => els.map((e) => e.getAttribute('data-field')));
  expect(shown).toEqual(SEVEN);
  expect(shown).not.toContain('b');
  await expect(doorway(page)).not.toContainText('uur van de dag');

  // act through every shape (demo mode: every fire advances the Shift)
  await fire(page);
  await doorway(page).getByRole('button', { name: T.nl.leave }).click();
  await fire(page);
  await doorway(page).getByRole('button', { name: T.nl.work }).click();
  await doorway(page).getByRole('button', { name: 'Toon de resultaten' }).click();
  await fire(page);
  await doorway(page).getByRole('button', { name: T.nl.skip }).first().click();
  await doorway(page).getByRole('button', { name: T.nl.dontKeep }).click();
  await doorway(page).getByRole('button', { name: T.nl.leave }).click();
  await fire(page);
  await doorway(page).getByRole('button', { name: T.nl.leave }).click();
  await fire(page);
  await doorway(page).getByRole('button', { name: 'Verder naar de resultaten' }).click();

  await expect.poll(async () => (await readEvents(page)).length).toBe(5);
  const events = await readEvents(page);
  expect(events.map((e) => e.f)).toEqual(['gate', 'fork', 'wave', 'hallway', 'door']);
  for (const e of events) {
    expect(Object.keys(e).sort()).toEqual([...SEVEN].sort());
    expect(e.v).toMatch(/^(legal|harm|control)-0[1-3]$/);
    expect(BUNDLE_IDS.has(e.r) || e.r === 'xx-none', e.r).toBe(true);
    expect(e.i).toMatch(/^inst_[a-z0-9]{6,}$/);
  }
  expect(events.map((e) => e.o)).toEqual(['left_page', 'continued', 'left_page', 'left_page', 'dismissed']);
  expect(events.map((e) => e.e)).toEqual(['1', '2', '3', '4', '5+']);
});

test('e) realistic mode escalates in place instead of going quiet, and goes quiet only after the person acted', async ({ page }) => {
  await page.getByRole('button', { name: 'Realistic', exact: true }).click();

  await fire(page);
  await expect(doorway(page)).toHaveAttribute('data-shape', 'gate');
  await expect.poll(async () => (await readLocal(page))?.n).toBe(1);
  const first = await readLocal(page);
  expect(first.last).toBeGreaterThan(0);
  expect(first.acted).toBeUndefined();

  await fire(page);
  await expect(doorway(page)).toHaveAttribute('data-shape', 'fork');
  await expect(doorway(page)).toContainText('in-place escalatie');
  await expect.poll(async () => (await readLocal(page))?.n).toBe(2);
  const second = await readLocal(page);
  expect(second.last).toBe(first.last);
  expect(second.acted).toBeUndefined();

  // the person acts (continues), then an immediate retry is the quiet pill
  await doorway(page).getByRole('button', { name: T.nl.work }).click();
  await doorway(page).getByRole('button', { name: 'Toon de resultaten' }).click();
  await expect.poll(async () => (await readLocal(page))?.acted).toBeGreaterThan(0);
  await fire(page);
  await expect(doorway(page)).toHaveAttribute('data-shape', 'quiet');
  expect((await readLocal(page)).last).toBe(first.last);
});

test('f) the Wave has no free text; the chosen preset lives in sessionStorage only and the wipe clears it', async ({ page }) => {
  await shape(page, 'Wave');
  const dw = doorway(page);
  await expect(dw).toContainText('Gereserveerde vorm — klinische toetsing volgt; niet in de uitgeleverde reeks');
  await expect(dw).toContainText('een vaardigheid, geen behandeling');
  await dw.getByRole('button', { name: T.nl.skip }).first().click();

  expect(await dw.locator('textarea').count()).toBe(0);
  expect(await dw.locator('input:not([type=radio])').count()).toBe(0);
  expect(await dw.locator('input[type=radio]').count()).toBe(4);

  const preset = 'bel ik iemand die ik vertrouw';
  await dw.getByRole('radio', { name: preset }).check();
  await dw.getByRole('button', { name: T.nl.keep }).click();
  await expect(dw).toContainText('Bewaard tot je dit tabblad sluit');

  const stored = await page.evaluate(() => ({
    session: Object.values({ ...sessionStorage }).join('|'),
    local: Object.values({ ...localStorage }).join('|'),
  }));
  expect(stored.session).toContain(preset);
  expect(stored.local).not.toContain(preset);

  await dw.getByRole('button', { name: T.nl.glass }).click();
  await expect(dw).toContainText(`Jouw plan (tot je dit tabblad sluit): “${preset}”`);
  await dw.getByRole('button', { name: 'Wis wat dit apparaat onthoudt' }).click();
  expect(await page.evaluate(() => Object.values({ ...sessionStorage }).join('|'))).not.toContain(preset);
});

test('f) Fork and Wave are tagged reserved, and the held-results note states the open decision', async ({ page }) => {
  await shape(page, 'Fork');
  await expect(doorway(page)).toContainText('gereserveerd, niet uitgeleverd');
  await expect(page.getByText('Open decision (docs/11): holding results conflicts with treating the host as an adversary')).toBeVisible();
  await shape(page, 'Wave');
  await expect(doorway(page)).toContainText('gereserveerd, niet uitgeleverd');
  await shape(page, 'Gate');
  await expect(doorway(page)).not.toContainText('gereserveerd');
});

test('quick exit: the demo note is an honest open decision', async ({ page }) => {
  await shape(page, 'Gate');
  await doorway(page).getByRole('button', { name: 'Snel weg' }).click();
  await expect(page.getByText('Open decision (docs/11): in the real sandboxed Door a frame cannot navigate the host page')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('removes the Doorway page from back-history');
});

test('g) stale claims are gone from the whole app, and the baseline note is on the Verdict page', async ({ page }) => {
  const stale = ['72 tests', 'eight fields', 'eight-field', 'zero screens built', 'hour of day', 'ported, not imported'];
  const bodies = [];
  await tab(page, 'Review & answers');
  await expect(page.getByTestId('baseline')).toContainText('3fbd10b');
  await expect(page.getByTestId('baseline')).toContainText('PR #4');
  bodies.push(await page.locator('body').innerText());
  await tab(page, 'Live prototype');
  await fire(page);
  await doorway(page).getByRole('button', { name: T.nl.glass }).click();
  await doorway(page).getByRole('button', { name: T.nl.leave }).click();
  bodies.push(await page.locator('body').innerText());
  await tab(page, 'The Desk');
  bodies.push(await page.locator('body').innerText());

  for (const body of bodies) {
    const lower = body.toLowerCase();
    for (const s of stale) expect(lower, s).not.toContain(s);
  }
  expect(bodies[0]).toContain('scored at 3fbd10b');
  expect(bodies[2]).toContain('data-trigger-event="doorway:flag"');
  expect(bodies[2]).toContain("document.dispatchEvent(new CustomEvent('doorway:flag'");
  expect(bodies[2]).toContain('never the query');
  expect(bodies[2]).toContain('to be checked with counsel');
  expect(bodies[2]).not.toContain('DSA risk reports');
});
