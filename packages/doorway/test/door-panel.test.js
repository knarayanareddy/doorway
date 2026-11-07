import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { doorPanel, hallwaySections } from '../src/panels.js';
import { DOOR, DEMO_TAG, LABELS, LANGS } from '../src/copy.js';
import { buildCard, render, CSS } from '../../shared/card.js';
import { isAllowedDestination, DESTINATION_ALLOWLIST } from '../../core/src/route.js';
import { verifyBundle } from '../../core/src/bundle.js';
import { PUBLIC_KEY_RAW_B64U } from '../src/pubkey.js';
import { longSentences } from '../../shared/a11y.js';

const readJson = (f) => JSON.parse(fs.readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'));
const PROD = readJson('routes.nl.json');
const DEMO = readJson('routes.demo.json');
const prodRoute = PROD.byLanguage.nl.default;
const demoRoute = DEMO.byLanguage.nl.default;
const selfhelp = PROD.byLanguage.nl.alternatives[0];

const OPEN = Date.parse('2026-11-07T10:00:00Z');    // Saturday 11:00 in Amsterdam: 09:30-18:00, open
const CLOSED = Date.parse('2026-11-07T21:00:00Z');  // Saturday 22:00 in Amsterdam: closed, opens 09:30
const verifiedProd = { ...prodRoute, verifiedAt: '2026-10-20T00:00:00Z' }; // a verified, NOT demo, record (test only)

const panel = (o = {}) => {
  const opened = [];
  const d = doorPanel({ lang: 'nl', route: demoRoute, selfhelp, now: OPEN, n: 5, onOpen: (u) => opened.push(u), ...o });
  return { d, opened };
};
const clickPrimary = (d, opened) => { if (d.primary.onSelect) d.primary.onSelect(); return opened; };

// ── open, closed, unknown ─────────────────────────────────────────────────
test('open hours with a number: a call button (tel:) and a chat link, and nothing else leaves the Door', () => {
  for (const L of LANGS) {
    const { d, opened } = panel({ lang: L });
    assert.equal(d.primary.label, `${DOOR[L].callOpen} 0800 266 64 36`);
    assert.equal(d.primary.href, 'tel:08002666436');
    assert.equal(d.primary.outcome, 'clicked_help', 'a call is a help click');
    assert.equal(d.primary.routeId, 'nl-offlimits');
    assert.equal(d.primary.onSelect, undefined, 'the tel: link needs no handler: the browser dials');
    assert.equal(d.chat.label, DOOR[L].chat);
    assert.equal(d.chat.closes, true);
    assert.equal(d.chat.outcome, 'clicked_help');
    d.chat.onSelect();
    assert.deepEqual(opened, [demoRoute.url]);
  }
});

test('closed hours: one primary link to self-help that says when the line opens, and no call', () => {
  const { d, opened } = panel({ now: CLOSED });
  assert.equal(d.primary.label, DOOR.nl.closed('09:30'));
  assert.equal(d.primary.href, undefined);
  assert.equal(d.chat, null);
  clickPrimary(d, opened);
  assert.deepEqual(opened, [selfhelp.url], 'the self-help service, not the closed line');
  assert.equal(d.primary.routeId, selfhelp.id);
});

test('closed hours with no self-help route: a plain "see help" link to the service, never an "opens at" claim', () => {
  const { d, opened } = panel({ now: CLOSED, selfhelp: null });
  assert.equal(d.primary.label, LABELS.primary.nl);
  clickPrimary(d, opened);
  assert.deepEqual(opened, [demoRoute.url]);
});

test('unknown hours (the production record, not verified): no open, no closed, no number, one plain link', () => {
  const { d, opened } = panel({ route: prodRoute, selfhelp: null });
  assert.equal(d.primary.label, LABELS.primary.nl);
  assert.equal(d.primary.href, undefined);
  assert.equal(d.chat, null);
  assert.equal(d.tag, null, 'nothing from a demo record is shown');
  clickPrimary(d, opened);
  assert.deepEqual(opened, [prodRoute.url]);
  assert.doesNotMatch(JSON.stringify(d.primary), /tel:|Bel nu|Call now|Jetzt anrufen|opens at|opent om|Open now|Closed now/i);
});

test('the production record is never shown as open, even at an open hour', () => {
  const { d } = panel({ route: prodRoute, now: OPEN });
  assert.equal(d.primary.href, undefined, 'the shipped route has no verified hours, so no call button');
});

// ── tel: only with a number ───────────────────────────────────────────────
test('a call is offered only for a route with a dialable number', () => {
  for (const phone of [undefined, '', 'call us', '0800-ABC', '12']) {
    const { d } = panel({ route: { ...demoRoute, phone } });
    assert.equal(d.primary.href, undefined, `phone ${JSON.stringify(phone)} must not become a tel: link`);
    assert.doesNotMatch(JSON.stringify(d), /tel:/);
  }
  const { d: intl } = panel({ route: { ...demoRoute, phone: '+31 800 266 64 36' } });
  assert.equal(intl.primary.href, 'tel:+318002666436', 'an international number keeps its plus');
});

// ── the Demo data tag ──────────────────────────────────────────────────────
test('"Demo data" appears only when the hours or number come from the demo record', () => {
  for (const L of LANGS) {
    assert.equal(panel({ lang: L }).d.tag, DEMO_TAG[L]);
    assert.equal(panel({ lang: L, now: CLOSED }).d.tag, DEMO_TAG[L]);
  }
  assert.equal(panel({ route: verifiedProd }).d.tag, null, 'a verified record that is not the demo is not tagged');
  assert.equal(panel({ route: verifiedProd }).d.primary.href, 'tel:08002666436', 'and its number still works');
  assert.equal(panel({ route: prodRoute }).d.tag, null);
});

test('the hallway says "Demo data" only for the demo record', () => {
  const text = (route) => JSON.stringify(hallwaySections({ lang: 'en', route, selfhelp, now: OPEN, onAlt() {} }));
  assert.match(text(demoRoute), new RegExp(DEMO_TAG.en));
  assert.doesNotMatch(text(verifiedProd), new RegExp(DEMO_TAG.en));
});

// ── the rotating line ──────────────────────────────────────────────────────
test('the headline rotates with the exposure count: titles[(n-5) % length], and the first three are the first title', () => {
  const titles = DOOR.en.titles;
  const at = (n) => panel({ lang: 'en', n }).d.headline;
  for (const n of [1, 2, 3, 4, 5]) assert.equal(at(n), titles[0], `n=${n}`);
  assert.equal(at(6), titles[1]);
  assert.equal(at(7), titles[2]);
  assert.equal(at(8), titles[0]);
  assert.equal(at(20), titles[0], '(20-5) % 3 = 0');
  for (const L of LANGS) assert.equal(panel({ lang: L, n: 6 }).d.headline, DOOR[L].titles[1]);
});

// ── links only to the allow-list ───────────────────────────────────────────
test('every followed link is on the allow-list, and no URL is written into the data itself', () => {
  for (const [route, now] of [[demoRoute, OPEN], [demoRoute, CLOSED], [prodRoute, OPEN]]) {
    const { d, opened } = panel({ route, now, selfhelp });
    if (d.chat) d.chat.onSelect();
    clickPrimary(d, opened);
    for (const u of opened) {
      assert.ok(isAllowedDestination(u), u);
      assert.ok(DESTINATION_ALLOWLIST.includes(new URL(u).hostname), u);
    }
    assert.doesNotMatch(JSON.stringify({ ...d, primary: { ...d.primary, onSelect: undefined } }), /https?:/, 'the data holds no URL; only the callbacks do');
  }
});

test('a route that is not on the allow-list gets no link at all', () => {
  const { d, opened } = panel({ route: { ...demoRoute, url: 'https://evil.example/' } });
  assert.equal(d.primary.onSelect, undefined);
  assert.equal(d.chat, null);
  assert.equal(d.primary.label, LABELS.close.nl, 'a plain close, not a link');
  assert.deepEqual(opened, []);
});

// ── the card as the Door builds and renders it ─────────────────────────────
const cardFor = (o) => {
  const d = panel(o).d;
  return buildCard({
    variant: 'door', lang: 'nl', kicker: d.kicker, tag: d.tag, headline: d.headline, body: d.body,
    primary: d.primary, secondary: { label: DOOR.nl.carryOn, kind: 'secondary', outcome: 'dismissed' },
    tertiary: { label: LABELS.report.nl, kind: 'tertiary' },
    sections: d.chat ? [{ blocks: [d.chat] }] : [],
    attribution: 'Getoond door deze site', footnote: 'Hulp, gratis.',
  });
};

test('the door card validates, and renders as a dialog with one primary action and the demo tag', () => {
  const html = render(cardFor({}));
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-labelledby="doorway-card-title"/);
  assert.match(html, /<a class="cta" data-act="primary" href="tel:08002666436">Bel nu 0800 266 64 36<\/a>/);
  assert.match(html, /<span class="drg">Demodata<\/span>/);
  assert.equal((html.match(/data-act="primary"/g) || []).length, 1, 'one big action');
  assert.match(html, /data-act="secondary"[^>]*>Verder naar de resultaten</, 'carry on is a real button');
  assert.match(html, /data-act="tertiary"/, 'the report control stays where it was');
});

test('the rendered door markup has no script, no inline style, and no link except tel:', () => {
  for (const o of [{}, { now: CLOSED }, { route: prodRoute }]) {
    const html = render(cardFor(o));
    assert.doesNotMatch(html, /<script|style=|on[a-z]+=/i);
    assert.doesNotMatch(html, /https?:\/\//, 'URLs are never in the markup');
    for (const [, href] of html.matchAll(/href="([^"]*)"/g)) assert.match(href, /^tel:\+?\d+$/, href);
  }
});

test('the door styles load from the card itself: no imports, no web fonts, no external URLs', () => {
  const css = CSS;
  assert.doesNotMatch(css, /@import|url\(|https?:/);
  assert.match(css, /\.ovl>div\.dr\{/, 'the dark panel rule exists');
  assert.match(css, /prefers-reduced-motion/);
});

test('the door copy keeps the copy lint rules in every language', () => {
  for (const L of LANGS) {
    const s = [DOOR[L].kicker, DOOR[L].body, DOOR[L].callOpen, DOOR[L].chat, DOOR[L].carryOn, DOOR[L].closed('09:30'), ...DOOR[L].titles];
    for (const t of s) {
      assert.doesNotMatch(t, /anon|confiden|vertrouw|vertraul|police|politie|polizei|strafbaar|crime/i, `${L}: ${t}`);
      assert.deepEqual(longSentences(t), [], `${L}: ${t}`);
    }
  }
});

// ── the demo record is labelled, signed, and the shipped one stays honest ─
test('the production routes file has no demo record and no verified hours', () => {
  assert.doesNotMatch(JSON.stringify(PROD), /"demo"/);
  assert.equal(prodRoute.verifiedAt, null);
  assert.equal(PROD.version, '2026.11.07');
});

test('the demo routes file is signed with the pinned key, marks only the nl route, and differs from production only there', async () => {
  const pub = Uint8Array.from(Buffer.from(PUBLIC_KEY_RAW_B64U, 'base64url'));
  const v = await verifyBundle(DEMO, pub, { now: OPEN });
  assert.equal(v.ok, true, v.reason);
  const marked = [];
  for (const [L, entry] of Object.entries(DEMO.byLanguage)) for (const r of [entry.default, ...(entry.alternatives || [])]) if (r.demo) marked.push(`${L}/${r.id}`);
  assert.deepEqual(marked, ['nl/nl-offlimits']);
  // Undo exactly the demo changes and the rest must be byte-for-byte the shipped bundle.
  const undo = JSON.parse(JSON.stringify(DEMO));
  delete undo.sig; delete undo.byLanguage.nl.default.demo; undo.byLanguage.nl.default.verifiedAt = null; undo.version = PROD.version;
  const shipped = JSON.parse(JSON.stringify(PROD));
  delete shipped.sig;
  assert.deepEqual(undo, shipped);
});
