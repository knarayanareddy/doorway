import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pick, advance, markActed, bucketOf, variantFor, intervalFor, DEFAULT_CONFIG } from '../../core/src/shift.js';

const H = 3.6e6;
const T0 = 1_760_000_000_000;

test('first exposure gates with a LEGAL message', () => {
  const r = pick({}, DEFAULT_CONFIG, T0);
  assert.equal(r.state, 'FIRST');
  assert.equal(r.format, 'gate');
  assert.equal(r.family, 'legal', 'entry endpoint must be legal — Prichard 2022 OR 2.99, 2024 OR 5.02');
});

test('sequence escalates gate -> card -> hallway -> hallway -> door, one shape per question', () => {
  let st = {};
  let now = T0;
  const out = [];
  for (let i = 0; i < 5; i++) {
    const r = pick(st, DEFAULT_CONFIG, now);
    out.push(`${r.format}:${r.family}`);
    st = advance(st, `${r.family}-01`, now);
    now += 100 * H; // well outside the interval
  }
  assert.deepEqual(out, ['gate:legal', 'card:harm', 'hallway:control', 'hallway:control', 'door:control']);
});

test('five exposures produce five buckets, capped at 5+', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(bucketOf), ['1', '2', '3', '4', '5+', '5+']);
});

test('inside the interval, a person who has not acted is escalated in place, not silenced', () => {
  const r = pick({ n: 3, last: T0 }, DEFAULT_CONFIG, T0 + 1 * H);
  assert.equal(r.state, 'ESCALATING');
  assert.notEqual(r.format, 'quiet');
  assert.notEqual(r.format, 'gate', 'an in-window retry is an inline card, never a modal gate');
  assert.equal(r.keepClock, true, 'the re-warning clock must not be reset');
});

test('quiet is reserved for someone who already acted, and only for 72 hours', () => {
  const acted = markActed({ n: 3, last: T0 }, T0 + 0.5 * H);
  assert.equal(pick(acted, DEFAULT_CONFIG, T0 + 1 * H).format, 'quiet');
  const stale = { n: 3, last: T0, acted: T0 - 100 * H };
  assert.notEqual(pick(stale, DEFAULT_CONFIG, T0 + 1 * H).format, 'quiet', 'an old action does not silence a new burst');
});

test('blocked storage degrades to card (not the heaviest gate), never fails closed', () => {
  const r = pick({}, DEFAULT_CONFIG, T0, { storageBlocked: true });
  assert.equal(r.state, 'DEGRADED');
  assert.equal(r.format, 'card');
  assert.equal(r.family, 'harm');
});

test('variant rotation avoids repeating what was just shown', () => {
  assert.equal(variantFor('legal', []), 'legal-01');
  assert.equal(variantFor('legal', ['legal-01']), 'legal-02');
  assert.notEqual(variantFor('legal', ['legal-01', 'legal-02']), 'legal-01');
});

test('variant rotation keeps rotating once all three variants are seen', () => {
  // Once all three variants sit in the seen window, variantFor() must not
  // fall back to pool[0] forever — that stops anti-habituation exactly when
  // it matters most. With deduped seen, it rotates 01, 02, 03, 01, 02, 03 …
  let st = { seen: [] };
  const seq = [];
  for (let i = 0; i < 9; i++) {
    const v = variantFor('legal', st.seen);
    seq.push(v);
    st = advance(st, v);
  }
  assert.deepEqual(seq, [
    'legal-01', 'legal-02', 'legal-03',
    'legal-01', 'legal-02', 'legal-03',
    'legal-01', 'legal-02', 'legal-03',
  ], JSON.stringify(seq));
});

// ── Acceptance test #3, as it is actually written in README.md ──────────────
// "Five consecutive triggers produce five visibly different responses."
//
// The first browser run returned gate,quiet,quiet,quiet,quiet. That was correct
// behaviour for five triggers two seconds apart — a flat 72h window — but it
// meant the Shift's central claim never ran. Two changes close it:
//   1. the interval widens with the count, so exposures 1->2 and 2->3 are
//      reachable inside one session (DEFAULT_CONFIG.intervalHours);
//   2. "visibly different" is read as response, not format — variant rotation
//      within a family is the mechanism, and there are only four formats.
test('acceptance #3: five exposures at realistic gaps produce five distinct responses', () => {
  let st = {};
  let t = Date.now();
  const responses = [];
  for (const gap of [0, 10 * 60e3, 7 * H, 96 * H, 96 * H]) {
    t += gap;
    const d = pick(st, DEFAULT_CONFIG, t);
    const v = d.format === 'quiet' ? null : variantFor(d.family, st.seen || []);
    responses.push(d.format + (v ? '/' + v : ''));
    st = advance(st, v, t);
  }
  assert.equal(responses.length, 5);
  assert.equal(new Set(responses).size, 5, `expected 5 distinct, got ${JSON.stringify(responses)}`);
});

test('acceptance #3 guard: five triggers two seconds apart cannot be five responses', () => {
  // Review H1: this used to be gate, quiet x4 — the strongest signal the system
  // sees (re-searching right after a warning) was answered with the weakest
  // response. Now it escalates in place and the clock does not reset.
  let st = {};
  const t0 = Date.now();
  const forms = [];
  for (let i = 0; i < 5; i++) {
    const d = pick(st, DEFAULT_CONFIG, t0 + i * 2000);
    forms.push(`${d.format}/${d.family}`);
    st = advance(st, null, t0 + i * 2000, { keepClock: d.keepClock });
  }
  assert.deepEqual(forms, ['gate/legal', 'card/harm', 'hallway/control', 'hallway/control', 'door/control']);
  assert.equal(st.last, t0, 'the clock stayed at the first exposure');
});

test('burst: five triggers in two seconds give five different responses (shift-burst)', () => {
  let st = {};
  const t0 = Date.now();
  const seen = new Set();
  for (let i = 0; i < 5; i++) {
    const d = pick(st, DEFAULT_CONFIG, t0 + i * 400);
    seen.add(d.format + '/' + variantFor(d.family, st.seen || []));
    st = advance(st, variantFor(d.family, st.seen || []), t0 + i * 400, { keepClock: d.keepClock });
  }
  assert.equal(seen.size, 5);
});

test('the interval widens with the count, so early repetition is reachable', () => {
  // intervalFor(n) is the wait BEFORE exposure n+1.
  assert.equal(intervalFor(0), 0, 'the first exposure is never refused');
  assert.equal(intervalFor(1), 10 / 60, 'a second look ten minutes later is a returning user');
  assert.equal(intervalFor(2), 6);
  assert.equal(intervalFor(3), 72, 'by the fourth exposure we are back to the original restraint');
  assert.equal(intervalFor(99), 72, 'holds at the last value rather than growing without bound');
});

test('a daily user who has acted is still not nagged', () => {
  const now = Date.now();
  const acted = { n: 6, last: now - 20 * H, acted: now - 20 * H };
  assert.equal(pick(acted, DEFAULT_CONFIG, now).format, 'quiet',
    '20h after they acted is inside the 72h quiet window');
  assert.equal(pick({ n: 6, last: now - 80 * H, acted: now - 80 * H }, DEFAULT_CONFIG, now).format, 'door',
    'past the window the persistent form returns');
  const windows = [3, 10, 50].map((n) => intervalFor(n));
  assert.deepEqual(windows, [72, 72, 72]);
});

// ── the demo-only `advance` option (labs.js): every pick is the next step ───
test('advance: every pick moves one step, whatever the last exposure was and whatever the window (demo only)', () => {
  let st = {};
  const out = [];
  const buckets = [];
  for (let i = 0; i < 6; i++) {
    const t = T0 + i * 1000; // a burst, all inside every window
    const r = pick(st, DEFAULT_CONFIG, t, { alwaysAdvance: true });
    out.push(r.format);
    buckets.push(r.bucket);
    assert.notEqual(r.format, 'quiet', 'the quiet pill is never chosen in advance mode');
    assert.equal(r.keepClock, undefined, 'an advance is a full exposure, not an in-place retry');
    st = markActed(advance(st, null, t), t); // the person dismissed every time
  }
  assert.deepEqual(out, ['gate', 'card', 'hallway', 'hallway', 'door', 'door'], 'then it stays on door');
  assert.deepEqual(buckets, ['1', '2', '3', '4', '5+', '5+'], 'the bucket is the step actually shown');
});

test('advance: a retry inside the window is still the next step, not an in-place escalation (demo only)', () => {
  const r = pick({ n: 1, last: T0 }, DEFAULT_CONFIG, T0 + 1 * 60e3, { alwaysAdvance: true });
  assert.equal(r.format, 'card');
  assert.equal(r.state === 'ESCALATING' || r.state === 'HABITUATED', false);
});

test('without the advance option, pick is unchanged: a dismissal makes the next press quiet (default path pinned)', () => {
  const acted = markActed({ n: 1, last: T0 }, T0);
  const later = T0 + 60e3;
  assert.equal(pick(acted, DEFAULT_CONFIG, later).format, 'quiet');
  assert.deepEqual(pick(acted, DEFAULT_CONFIG, later, { alwaysAdvance: false }), pick(acted, DEFAULT_CONFIG, later), 'false is the same as absent');
  const fresh = { n: 2, last: T0 };
  assert.deepEqual(pick(fresh, DEFAULT_CONFIG, T0 + 60e3, { alwaysAdvance: false }), pick(fresh, DEFAULT_CONFIG, T0 + 60e3));
});
