import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glassSection, hallwaySections } from '../src/panels.js';
import { GLASS, HALLWAY_FAQ, HALLWAY, LANGS } from '../src/copy.js';
import { FIELDS, build } from '../../core/src/counter.js';
import { openStatus, parseHours, isRenderableHours } from '../../core/src/hours.js';
import { buildCard } from '../../shared/card.js';
import { longSentences } from '../../shared/a11y.js';

const NOW = Date.parse('2026-11-07T10:00:00Z');   // a Saturday, 11:00 in Amsterdam
const preview = { i: 'inst_abc123', v: 'harm-01', f: 'card', t: 'search', o: null, r: 'nl-offlimits', e: '2' };
const human = { id: 'nl-offlimits', channel: 'chat', url: 'https://offlimits.nl/', hours: 'Mo-Fr 09:00-22:00; Sa-Su 09:30-18:00', verifiedAt: null };
const selfhelp = { id: 'nl-stoppen', channel: 'selfhelp', url: 'https://stoppenismogelijk.eu/' };

const blocksOf = (s) => (s.disclosure ? s.disclosure.blocks : s.blocks);
const allText = (sections) => JSON.stringify(sections);

// ── The Glass Door ─────────────────────────────────────────────────────────
test('the Glass Door lists exactly the counter fields, with the outcome still pending', () => {
  for (const L of LANGS) {
    const g = glassSection({ lang: L, preview, localCount: 2, onWipe() {} });
    const fields = blocksOf(g).find((b) => b.type === 'fields');
    assert.deepEqual(fields.rows.map((r) => r.k), FIELDS, 'the panel and the contract cannot drift apart');
    assert.equal(fields.rows.find((r) => r.k === 'o').v, GLASS.pending[L]);
    assert.equal(fields.rows.find((r) => r.k === 'e').v, '"2"');
    for (const r of fields.rows) assert.ok(r.note.length > 5, `${L}/${r.k} needs an explanation`);
  }
});

test('what the Glass Door shows is a payload the counter would accept once the outcome exists', () => {
  const shown = Object.fromEntries(blocksOf(glassSection({ lang: 'en', preview, localCount: 1, onWipe() {} })).find((b) => b.type === 'fields').rows.map((r) => [r.k, r.v]));
  const sent = { ...preview, o: 'dismissed' };
  assert.equal(build(sent).ok, true);
  for (const k of FIELDS.filter((k) => k !== 'o')) assert.equal(shown[k], `"${sent[k]}"`);
});

test('the Glass Door is honest that the server sees a network address, and says what is stored', () => {
  for (const L of LANGS) {
    assert.match(GLASS.honest[L], /\b(IP|netwerkadres|Netzwerkadresse|network address)\b/i);
    assert.ok(!/no ip|geen ip|zonder ip/i.test(GLASS.honest[L]), 'must not claim the address is never seen');
  }
});

test('wiping is wired to the callback and reports back', () => {
  let wiped = 0;
  const g = glassSection({ lang: 'en', preview, localCount: 3, onWipe: () => { wiped++; } });
  const wipe = blocksOf(g).find((b) => b.type === 'action' && b.id === 'wipe');
  assert.equal(wipe.closes, false, 'wiping does not dismiss the card');
  assert.deepEqual(wipe.onSelect(), { message: GLASS.wiped.en });
  assert.equal(wiped, 1);
});

test('the Glass Door builds into a valid card in every language, and carries no markup through', () => {
  for (const L of LANGS) {
    const card = buildCard({ variant: 'card', headline: 'h', body: 'b', primary: { label: 'x' }, sections: [glassSection({ lang: L, preview: { ...preview, v: '<script>' }, localCount: 1, onWipe() {} })] });
    assert.equal(card.sections.length, 1);
  }
});

// ── The Hallway ────────────────────────────────────────────────────────────
test('hallway: with no verified record, nothing about the service\'s privacy or hours appears', () => {
  const secs = hallwaySections({ lang: 'en', route: human, selfhelp, now: NOW, onAlt() {} });
  const t = allText(secs);
  assert.doesNotMatch(t, /privacy|confiden|anonym|police|open now|closed now|Open now/i);
  assert.match(t, /If one of these is true/);
});

test('hallway: a verified confidentiality record shows the service\'s own words, with who confirmed it', () => {
  const route = { ...human, conf: { text: 'Calls are confidential, in the service\'s own words.', basis: 'service-published', sourceUrl: 'https://example.org/p', verifiedBy: 'A. Person, Offlimits', verifiedAt: '2026-10-01', expiresAt: '2027-10-01' } };
  const secs = hallwaySections({ lang: 'en', route, selfhelp: null, now: NOW, onAlt() {} });
  const faq = secs.find((s) => s.disclosure?.label === HALLWAY_FAQ.privacyQ.en);
  assert.ok(faq);
  const text = faq.disclosure.blocks.map((b) => b.text).join(' ');
  assert.match(text, /in the service's own words/);
  assert.match(text, /Confirmed by A\. Person, Offlimits on 2026-10-01/);
  const stale = { ...route, conf: { ...route.conf, expiresAt: '2026-01-01' } };
  assert.ok(!hallwaySections({ lang: 'en', route: stale, selfhelp: null, now: NOW, onAlt() {} }).some((s) => s.disclosure?.label === HALLWAY_FAQ.privacyQ.en));
});

test('hallway: the self-help alternative appears only when it is a different, real route', () => {
  const has = (secs) => secs.some((s) => s.disclosure?.blocks.some((b) => b.id === 'alt'));
  assert.equal(has(hallwaySections({ lang: 'nl', route: human, selfhelp, now: NOW, onAlt() {} })), true);
  assert.equal(has(hallwaySections({ lang: 'nl', route: human, selfhelp: null, now: NOW, onAlt() {} })), false);
  assert.equal(has(hallwaySections({ lang: 'nl', route: selfhelp, selfhelp, now: NOW, onAlt() {} })), false, 'never offer a route as its own alternative');
  const alt = hallwaySections({ lang: 'nl', route: human, selfhelp, now: NOW, onAlt() {} }).flatMap((s) => s.disclosure?.blocks || []).find((b) => b.id === 'alt');
  assert.equal(alt.closes, true);
});

test('hallway: opening hours show only for a route verified within the year', () => {
  const verified = { ...human, verifiedAt: '2026-10-20' };
  const t = allText(hallwaySections({ lang: 'en', route: verified, selfhelp, now: NOW, onAlt() {} }));
  assert.match(t, /Open now, until 18:00/, 'Saturday 11:00 in Amsterdam: the weekend window');
  const night = Date.parse('2026-11-07T21:00:00Z');   // 22:00 Amsterdam, after the Saturday close
  assert.match(allText(hallwaySections({ lang: 'en', route: { ...verified, verifiedAt: '2026-10-20' }, selfhelp, now: night, onAlt() {} })), /Closed now, opens at 09:30/);
  assert.match(allText(hallwaySections({ lang: 'en', route: verified, selfhelp, now: night, onAlt() {} })), /closed\. You can start with self-help/);
  assert.equal(isRenderableHours({ ...human, verifiedAt: '2024-01-01' }, NOW), false);
  assert.equal(isRenderableHours({ ...human, verifiedAt: '2026-10-20', hours: 'garbage' }, NOW), false);
});

test('hallway: every sentence respects the plain-language rule in every language', () => {
  for (const L of LANGS) {
    for (const v of HALLWAY[L]) assert.deepEqual(longSentences(v.b), [], `${L}: ${v.b}`);
    for (const t of [HALLWAY_FAQ.nocallA[L], HALLWAY_FAQ.closedTip[L], HALLWAY_FAQ.privacyBy[L]('A. Person', '2026-10-01'), HALLWAY_FAQ.openUntil[L]('18:00'), HALLWAY_FAQ.closedOpens[L]('09:00')]) {
      assert.deepEqual(longSentences(t), [], `${L}: ${t}`);
    }
  }
});

// ── hours.js ───────────────────────────────────────────────────────────────
test('hours: parsing is strict, and unknown never means closed', () => {
  assert.equal(parseHours('Mo-Fr 09:00-22:00')[2][0].open, 540);
  assert.equal(parseHours('Mo-Fr 09:00-22:00')[5].length, 0);
  for (const bad of ['', 'always', 'Fr-Mo 09:00-10:00', 'Mo 10:00-09:00', 'Mo 09:00-25:00', undefined]) assert.equal(parseHours(bad), null, String(bad));
  assert.equal(openStatus('nonsense', new Date(NOW)), null);
  assert.deepEqual(openStatus('Mo-Fr 09:00-22:00', new Date('2026-11-07T10:00:00Z')), { open: false, opensAt: '09:00', opensDay: 'Mo', tomorrow: false });
  assert.ok(parseHours('Mo-Su 22:00-06:00'), 'overnight span is now supported');
  assert.equal(openStatus('Mo-Su 22:00-06:00', new Date('2026-11-07T22:30:00Z'))?.open, true);
  // N2 regression: overnight every-day must be open at 02:00 on intermediate days
  assert.equal(openStatus('Mo-Su 22:00-06:00', new Date('2026-11-05T01:00:00Z'))?.open, true, 'Wed 02:00 Amsterdam is inside Tue 22-06');
  assert.equal(openStatus('Mo-Su 22:00-06:00', new Date('2026-11-04T01:00:00Z'))?.open, true, 'Tue 02:00 Amsterdam is inside Mon 22-06');
});

test('hours: evaluated in the service\'s timezone, across the DST change', () => {
  const spec = 'Mo-Su 09:00-22:00';
  assert.equal(openStatus(spec, new Date('2026-07-01T07:30:00Z')).open, true, '09:30 in summer time (UTC+2)');
  assert.equal(openStatus(spec, new Date('2026-12-01T08:30:00Z')).open, true, '09:30 in winter time (UTC+1)');
  assert.equal(openStatus(spec, new Date('2026-12-01T07:30:00Z')).open, false, '08:30 local in winter is still before opening');
});
