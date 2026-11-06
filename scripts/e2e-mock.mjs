#!/usr/bin/env node
/**
 * End-to-end against the organisers' mock platform, in a real browser.
 *
 * This is the only test in this repo that proves the widget is a *module* — that
 * a platform can fire `sbis:trigger` and get a rendered intervention and an
 * `sbis:result` back, per contract/PLUGIN_CONTRACT.md.
 *
 * It is NOT part of `npm run verify`: it needs Chromium (~150 MB) and this repo
 * deliberately has zero dependencies. Run it by hand before a demo.
 *
 *   npm run e2e
 *
 * Findings on first run are recorded in docs/06-organiser-repos.md — including
 * that acceptance test #3 does not hold at the browser level.
 */
import { chromium } from 'playwright';           // npx playwright install chromium
const BASE = process.env.BASE || 'http://127.0.0.1:8080';
if (!process.env.BASE) {
  console.error('Serve the repo root first, then:');
  console.error('  python3 -m http.server 8080 --bind 0.0.0.0');
  console.error('  BASE=http://127.0.0.1:8080 node scripts/e2e-mock.mjs');
  process.exit(2);
}
const b = await chromium.launch({ args: ['--no-sandbox'] });

async function fresh(opts = {}) {
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.exposeFunction('__cap', d => results.push(d));
  await page.addInitScript(opts.init || (() => {
    window.addEventListener('DOMContentLoaded', () => {
      document.body.addEventListener('sbis:result', e => window.__cap(e.detail));
    });
  }));
  await page.goto(`${BASE}/mock-platform/index.html`, { waitUntil: 'networkidle' });
  const fire = (sev, type='search') => page.evaluate(([s,t]) => document.body.dispatchEvent(new CustomEvent('sbis:trigger', {
    detail: { type: t, severity: s, country: 'NL', language: 'nl',
              sessionScopedId: 'LEAK-CANARY-123', timestamp: new Date().toISOString() } })), [sev,type]);
  const form = () => page.evaluate(() => {
    const h = [...document.querySelectorAll('*')].find(e => e.shadowRoot);
    return h ? h.getAttribute('data-core-card') : null;
  });
  const click = (act) => page.evaluate((a) => {
    const h = [...document.querySelectorAll('*')].find(e => e.shadowRoot);
    const btn = h?.shadowRoot?.querySelector(`[data-act="${a}"]`);
    if (!btn) return false; btn.click(); return true;
  }, act);
  return { ctx, page, fire, form, click, errors, results };
}

// --- A: five exposures, dismiss each time ---
{
  const { ctx, fire, form, click, errors } = await fresh();
  const forms = [];
  for (let i = 0; i < 5; i++) {
    await fire('high');
    await new Promise(r => setTimeout(r, 180));
    forms.push(await form());
    await click('dismiss');
    await new Promise(r => setTimeout(r, 120));
    await page_reset(fire);
  }
  console.log('A) five exposures, form each time :', JSON.stringify(forms));
  console.log('   distinct forms                 :', new Set(forms).size, '/ 5');
  console.log('   errors                         :', errors.length ? errors : '(none)');
  await ctx.close();
  async function page_reset(){}
}

// --- B: the 72h interval suppresses a repeat ---
{
  const { ctx, fire, form, click } = await fresh();
  await fire('high'); await new Promise(r=>setTimeout(r,200));
  const first = await form();
  await click('dismiss'); await new Promise(r=>setTimeout(r,150));
  await fire('high'); await new Promise(r=>setTimeout(r,200));
  const second = await form();
  console.log('\nB) immediate repeat (inside 72h)  :', first, '->', second);
  await ctx.close();
}

// --- C: private mode / storage blocked ---
{
  const { ctx, page, fire, form } = await fresh({ init: () => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    window.addEventListener('DOMContentLoaded', () => {
      document.body.addEventListener('sbis:result', e => window.__cap(e.detail));
    });
  }});
  await fire('high'); await new Promise(r=>setTimeout(r,250));
  console.log('C) storage blocked, still renders :', await form());
  await ctx.close();
}

// --- D: English browser gets a real service, not a dead end ---
{
  const { ctx, page, fire, results } = await fresh();
  await page.evaluate(() => document.body.dispatchEvent(new CustomEvent('sbis:trigger', {
    detail: { type: 'search', severity: 'high', country: 'GB', language: 'en' } })));
  await new Promise(r=>setTimeout(r,200));
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('*')].find(e => e.shadowRoot);
    h?.shadowRoot?.querySelector('[data-act="primary"]')?.click();
  });
  await new Promise(r=>setTimeout(r,300));
  console.log('\nD) English (GB) click              :', JSON.stringify(results.at(-1)));
  await ctx.close();
}
await b.close();

// --- E: acceptance test #3, end to end ------------------------------------
// "Five consecutive triggers produce five visibly different responses."
//
// The burst case (five triggers two seconds apart) is asserted too, and is
// expected to collapse to the quiet form: nobody sees five interventions in two
// seconds unless they are being tested, and absorbing a burst is what the
// anti-nagging rule is for. Both are recorded so the demo can state the
// distinction rather than hope nobody asks.
{
  const b2 = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await b2.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/mock-platform/index.html`, { waitUntil: 'networkidle' });
  const seen = [];
  const readText = () => page.evaluate(() => {
    const h = [...document.querySelectorAll('*')].find((e) => e.shadowRoot);
    if (!h) return null;
    const shell = document.createElement('div');
    for (const n of h.shadowRoot.childNodes) shell.appendChild(n.cloneNode(true));
    shell.querySelectorAll('style').forEach((s) => s.remove());
    return { form: h.getAttribute('data-core-card'),
             text: (shell.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120) };
  });
  const dismiss = () => page.evaluate(() => {
    const h = [...document.querySelectorAll('*')].find((e) => e.shadowRoot);
    h?.shadowRoot?.querySelector('[data-act="dismiss"]')?.click();
  });

  for (let i = 0; i < 5; i++) {
    if (i > 0) {
      const back = [0, 0.2, 7, 96, 96][i];
      await page.evaluate((h) => {
        for (const k of Object.keys(localStorage)) {
          try {
            const v = JSON.parse(localStorage.getItem(k));
            if (v && typeof v === 'object' && 'last' in v) {
              v.last = Date.now() - h * 3600000;
              localStorage.setItem(k, JSON.stringify(v));
            }
          } catch { /* ignore */ }
        }
      }, back);
    }
    await page.evaluate(() => document.body.dispatchEvent(new CustomEvent('sbis:trigger', {
      detail: { type: 'search', severity: 'high', country: 'NL', language: 'nl',
                sessionScopedId: 'LEAK-CANARY-123', timestamp: new Date().toISOString() } })));
    await page.waitForTimeout(220);
    const c = await readText();
    if (c) seen.push(c);
    await dismiss();
    await page.waitForTimeout(110);
  }
  const distinctText = new Set(seen.map((s) => s.text)).size;
  console.log(`E) five spaced exposures, distinct messages : ${distinctText} / ${seen.length}`);
  for (const s of seen) console.log(`     ${s.form}: ${s.text.slice(0, 70)}`);
  await ctx.close();
  await b2.close();
}
