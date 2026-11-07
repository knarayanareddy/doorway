import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLabs, sequenceFor, configFor, previewShape, waveSeconds, QUICK_EXIT, quickExit, readWavePlan, saveWavePlan, clearWavePlan, WAVE_KEY, edgeLabsFormats, labsFormats } from '../src/labs.js';
import { FORK, WAVE, labsStrings, LABS_TAG } from '../src/copy-labs.js';
import { pick, advance, variantFor, DEFAULT_CONFIG } from '../../core/src/shift.js';
import { build, deskByFormat } from '../../core/src/counter.js';
import { youthRoute } from '../../core/src/route.js';
import { createDoorway } from '../src/widget.js';
import { longSentences } from '../../shared/a11y.js';

const NOW = Date.parse('2026-11-07T10:00:00Z');

// ── what is on, and what is not ────────────────────────────────────────────
test('labs are off by default and unknown tokens are ignored', () => {
  assert.deepEqual(parseLabs(undefined), []);
  assert.deepEqual(parseLabs(''), []);
  assert.deepEqual(parseLabs('fork, wave ,quick-exit,fork,evil,<script>'), ['fork', 'wave', 'quick-exit']);
  assert.equal(configFor([]), DEFAULT_CONFIG, 'no labs: the shipped config object, untouched');
});

test('the shipped sequence has neither fork nor wave', () => {
  assert.deepEqual([...DEFAULT_CONFIG.sequence], ['gate', 'card', 'hallway', 'hallway', 'door']);
  assert.equal(build({ i: 'inst_abc123', v: 'harm-01', f: 'fork', t: 'search', o: 'dismissed', r: 'xx-none', e: '2' }).ok, false, 'the contract rejects fork');
  assert.equal(build({ i: 'inst_abc123', v: 'control-01', f: 'wave', t: 'search', o: 'dismissed', r: 'xx-none', e: '3' }).ok, false);
});

test('labs change the sequence, and the escalation still never answers a retry with the quiet pill', () => {
  assert.deepEqual(sequenceFor(['fork', 'wave']), ['gate', 'fork', 'wave', 'hallway', 'door']);
  assert.deepEqual(sequenceFor(['fork']), ['gate', 'fork', 'hallway', 'hallway', 'door']);
  assert.deepEqual(sequenceFor(['wave']), ['gate', 'card', 'wave', 'hallway', 'door']);
  assert.deepEqual(sequenceFor(['quick-exit']), ['gate', 'card', 'hallway', 'hallway', 'door']);
  const cfg = configFor(['fork', 'wave']);
  let st = {}; const t0 = NOW; const seen = [];
  for (let i = 0; i < 5; i++) {
    const d = pick(st, cfg, t0 + i * 1000);
    seen.push(d.format);
    st = advance(st, variantFor(d.family, st.seen || []), t0 + i * 1000, { keepClock: d.keepClock });
  }
  assert.deepEqual(seen, ['gate', 'fork', 'wave', 'hallway', 'door'], 'a burst of five escalates through the labs shapes in place');
});

test('labs formats are accepted only where the edge names them', () => {
  assert.deepEqual(edgeLabsFormats({}), []);
  assert.deepEqual(edgeLabsFormats({ LABS_FORMATS: 'fork,wave,quick-exit,card' }), ['fork', 'wave'], 'only formats, never behaviours or existing shapes');
  assert.deepEqual(labsFormats(['quick-exit', 'preview']), []);
});

test('a forced shape needs the preview lab, and must be a real shape', () => {
  assert.equal(previewShape('fork', []), null);
  assert.equal(previewShape('fork', ['fork']), null);
  assert.equal(previewShape('fork', ['preview']), 'fork');
  assert.equal(previewShape('evil', ['preview']), null);
});

test('wave length is clamped', () => {
  assert.equal(waveSeconds(undefined), 90);
  assert.equal(waveSeconds('15'), 15);
  assert.equal(waveSeconds('1'), 10);
  assert.equal(waveSeconds('99999'), 120);
  assert.equal(waveSeconds('abc'), 90);
});

// ── the Wave keeps a number, in the tab, nothing else ──────────────────────
const fakeSession = () => { const m = new Map(); return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('wave plan: only a preset index is stored, under one key, and free text is refused', () => {
  const s = fakeSession();
  assert.equal(readWavePlan(s), null);
  saveWavePlan(s, 2);
  assert.equal(readWavePlan(s), 2);
  assert.deepEqual([...s.m.keys()], [WAVE_KEY]);
  assert.equal(s.m.get(WAVE_KEY), '2');
  for (const bad of ['go for a walk', '4', -1, 1.5, NaN, null, undefined, '<b>']) saveWavePlan(s, bad);
  assert.equal(s.m.get(WAVE_KEY), '2', 'nothing but a valid index ever overwrites it');
  s.m.set(WAVE_KEY, 'I would like to…');
  assert.equal(readWavePlan(s), null, 'a stored string is never read back as a plan');
  clearWavePlan(s);
  assert.equal(s.m.size, 0);
  assert.equal(readWavePlan(null), null);
});

test('wave presets are exactly the four we can name, in every language', () => {
  for (const L of ['nl', 'en', 'de']) assert.equal(WAVE.presets[L].length, 4);
});

// ── quick exit ─────────────────────────────────────────────────────────────
test('quick exit goes to a fixed neutral https site per language, never anywhere the host names', () => {
  for (const [L, url] of Object.entries(QUICK_EXIT)) { assert.match(url, /^https:\/\/[a-z.]+\/$/, L); assert.doesNotMatch(url, /doorway|offlimits/); }
  assert.equal(new Set(Object.values(QUICK_EXIT)).size, 3);
  let went = null;
  const win = { top: { location: { replace: (u) => { went = u; } } } };
  assert.equal(quickExit(win, 'nl'), true);
  assert.equal(went, 'https://www.knmi.nl/');
  quickExit(win, 'xx'); assert.equal(went, QUICK_EXIT.en, 'an unknown language falls back to English');
  assert.equal(quickExit({ top: { location: { replace() { throw new Error('blocked by sandbox'); } } } }, 'nl'), false, 'a refused navigation is reported, not thrown');
});

// ── youth route: a link only with a complete written agreement ─────────────
const youth = (over = {}) => ({ byLanguage: { nl: { default: { id: 'nl-jeugd', audience: 'youth', url: 'https://offlimits.nl/jongeren', reviewBy: '2027-01-01', agreement: { contact: 'A. Jansen, jeugdlijn', okRef: 'e-mail 2026-10-30', okAt: '2026-10-30' }, ...over } } } });
test('youth route: offered only with contact, reference, date, an allow-listed host and an unexpired review', () => {
  assert.equal(youthRoute(youth(), 'nl', NOW).id, 'nl-jeugd');
  for (const bad of [{ agreement: null }, { agreement: { contact: 'A', okRef: 'x', okAt: '2026-10-30' } }, { agreement: { contact: 'A. Jansen', okRef: '', okAt: '2026-10-30' } },
    { agreement: { contact: 'A. Jansen', okRef: 'x', okAt: 'soon' } }, { url: 'https://evil.example/' }, { url: 'http://offlimits.nl/' }, { reviewBy: '2026-01-01' }, { audience: 'adult' }]) {
    assert.equal(youthRoute(youth(bad), 'nl', NOW), null, JSON.stringify(bad));
  }
  assert.equal(youthRoute(youth(), 'de', NOW), null);
});

// ── by-shape read model ────────────────────────────────────────────────────
const cell = (format, outcome, count) => ({ format, outcome, count });
test('by shape: exposures include people who left, and rates are over every exposure', () => {
  const rows = [cell('gate', 'clicked_help', 12), cell('gate', 'left_page', 80), cell('gate', 'dismissed', 28), cell('card', 'clicked_help', 15), cell('card', 'continued', 85)];
  const r = Object.fromEntries(deskByFormat(rows).map((x) => [x.format, x]));
  assert.deepEqual(r.gate, { format: 'gate', exposures: 120, clicked: 12, rate: 0.1, suppressed: false });
  assert.equal(r.card.exposures, 100);
});
test('by shape: small cells are hidden, and a lone hidden cell takes its smallest neighbour with it', () => {
  const rows = [cell('gate', 'clicked_help', 30), cell('gate', 'dismissed', 200), cell('card', 'clicked_help', 20), cell('card', 'dismissed', 100), cell('wave', 'clicked_help', 2), cell('wave', 'dismissed', 30)];
  const r = Object.fromEntries(deskByFormat(rows).map((x) => [x.format, x]));
  assert.equal(r.wave.clicked, null, 'under k');
  assert.equal(r.card.clicked, null, 'the smallest visible click count is hidden too, so wave cannot be derived from a total');
  assert.equal(r.gate.clicked, 30);
  assert.equal(r.wave.rate, null);
  assert.equal(r.wave.suppressed, true);
  assert.deepEqual(deskByFormat([]), []);
});

// ── copy ───────────────────────────────────────────────────────────────────
test('labs copy: every language has the same shape, short sentences, and the reserved tag', () => {
  for (const L of ['nl', 'en', 'de']) {
    assert.equal(FORK.options[L].length, 6);
    assert.deepEqual(FORK.options[L].map((o) => o[0]), FORK.options.nl.map((o) => o[0]));
    assert.deepEqual(Object.keys(FORK.views[L]).sort(), ['accident', 'cantstop', 'other', 'stop', 'work', 'young']);
    assert.match(LABS_TAG.fork[L], /Labs/);
    assert.match(LABS_TAG.wave[L], /Labs/);
  }
  for (const { path, text } of labsStrings()) assert.deepEqual(longSentences(text), [], path);
});
test('the Fork promises only what is true: nothing sent, nothing kept', () => {
  assert.match(FORK.intro.nl.b, /niet verstuurd en niet bewaard/);
  assert.match(FORK.intro.en.b, /not sent and not kept/);
});

// ── the Door uses labs only when told ──────────────────────────────────────
test('createDoorway without labs behaves exactly as shipped', () => {
  const d = createDoorway({ routes: { byLanguage: {} }, install: 'inst_abc123', lang: 'en', win: { navigator: { language: 'en' }, addEventListener() {} }, storage: fakeSession(), session: fakeSession(), sender: { event: async () => true, report: async () => true, heartbeat: async () => true } });
  assert.equal(typeof d.trigger, 'function');
});

// ── the demo-only `advance` token: a Door lab, never a format ─────────────
test('advance is a known lab token, only when spelled exactly; other spellings are ignored', () => {
  assert.deepEqual(parseLabs('advance'), ['advance']);
  assert.deepEqual(parseLabs('ADVANCE, Advance ,advance2,adv,<advance>'), []);
  assert.deepEqual(parseLabs('fork,advance,advance'), ['fork', 'advance'], 'de-duplicated');
});

test('advance is not a format: it never reaches the edge, and the edge never accepts it', () => {
  assert.deepEqual(labsFormats(['advance']), []);
  assert.deepEqual(labsFormats(['advance', 'fork']), ['fork']);
  assert.deepEqual(edgeLabsFormats({ LABS_FORMATS: 'advance,fork,wave' }), ['fork', 'wave']);
});

test('advance does not change the sequence', () => {
  assert.deepEqual(sequenceFor(['advance']), ['gate', 'card', 'hallway', 'hallway', 'door']);
});
