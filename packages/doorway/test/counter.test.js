import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build, normaliseType, ALLOWED, deskSummary, flagAnomalies, buildHeartbeat, buildReport } from '../../core/src/counter.js';
import { createSender } from '../src/send.js';
import { mapTrigger } from '../src/sbis-adapter.js';

const GOOD = { i: 'inst_7f3a2c', v: 'legal-01', f: 'gate', t: 'search', o: 'clicked_help', r: 'nl-offlimits', e: '1' };

test('edge-contract-width: the visitor\'s local hour is not part of the contract (H2)', () => {
  assert.equal('b' in ALLOWED, false);
  const r = build({ ...GOOD, b: 14 });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /unknown field: b/);
});

test('the whitelist is no wider than what the product emits (L1)', () => {
  assert.equal(build({ ...GOOD, f: 'blur' }).ok, false);
  assert.equal(build({ ...GOOD, v: 'ai-01' }).ok, false);
  assert.equal(build({ ...GOOD, v: 'selfhelp-01' }).ok, false);
  assert.equal(build({ ...GOOD, t: 'upload' }).ok, false);
});

test('counter-navtype: every trigger type the platform can send survives the real send path', async () => {
  const sent = [];
  const sender = createSender({ fetchImpl: async (u, init) => { sent.push(JSON.parse(init.body)); return { ok: true }; } });
  for (const [raw, want] of [['search', 'search'], ['chat', 'chat'], ['navigation', 'nav'], ['nav', 'nav'], ['bogus', 'search'], [undefined, 'search']]) {
    assert.equal(normaliseType(raw), want);
    assert.equal(await sender.event({ ...GOOD, t: normaliseType(raw) }), true, String(raw));
  }
  assert.equal(sent.length, 6);
  assert.ok(sent.every((p) => Object.keys(p).length === 7));
  assert.equal(mapTrigger({ type: 'navigation' }).type, 'nav', 'the adapter uses the same normaliser');
});

test('counter-abandon: every contract outcome, left_page included, can be sent', async () => {
  const sender = createSender({ fetchImpl: async () => ({ ok: true }) });
  for (const o of ['clicked_help', 'left_page', 'dismissed', 'continued', 'timeout']) {
    assert.equal(await sender.event({ ...GOOD, o }), true, o);
  }
});

test('a failed or invalid send is counted locally instead of being swallowed', async () => {
  const drops = [];
  const down = createSender({ fetchImpl: async () => { throw new Error('offline'); }, onDrop: (kind) => drops.push(kind) });
  assert.equal(await down.event(GOOD), false);
  const bad = createSender({ fetchImpl: async () => ({ ok: true }), onDrop: (kind) => drops.push(kind) });
  assert.equal(await bad.event({ ...GOOD, t: 'navigation' }), false, 'an un-normalised type is rejected, and now visibly');
  const rejected = createSender({ fetchImpl: async () => ({ ok: false, status: 429 }), onDrop: (kind) => drops.push(kind) });
  assert.equal(await rejected.event(GOOD), false);
  assert.deepEqual(drops, ['network', 'invalid', 'network']);
});

test('the sender omits credentials and the referrer, and uses keepalive for the abandon beacon', async () => {
  let init;
  await createSender({ fetchImpl: async (u, i) => { init = i; return { ok: true }; } }).event(GOOD);
  assert.equal(init.credentials, 'omit');
  assert.equal(init.referrerPolicy, 'no-referrer');
  assert.equal(init.keepalive, true);
  assert.equal(init.method, 'POST');
});

test('heartbeat and report payloads are closed shapes', () => {
  assert.equal(buildHeartbeat({ i: 'inst_abc123', v: '0.2.0', d: 3 }).ok, true);
  assert.equal(buildHeartbeat({ i: 'inst_abc123', v: '0.2.0', d: 0 }).ok, false);
  assert.equal(buildHeartbeat({ i: 'inst_abc123', v: '0.2.0', d: 3, q: 'x' }).ok, false);
  assert.equal(buildReport({ i: 'inst_abc123', p: '2026.11.07', t: 'search', r: 'journalist' }).ok, true);
  assert.equal(buildReport({ i: 'inst_abc123', p: '2026.11.07', t: 'search', r: 'my query was cats' }).ok, false);
});

test('desk read model: label, denominator, suppression and flags', () => {
  const s = deskSummary([{ outcome: 'clicked_help', count: 30 }, { outcome: 'left_page', count: 70 }]);
  assert.match(s.label, /unauthenticated/);
  assert.equal(s.clickThrough.shown, 100);
  assert.equal(deskSummary([{ outcome: 'dismissed', count: 4 }]).exposures, null);
  assert.deepEqual(flagAnomalies([{ day: 'a', total: 100, clicked: 10 }, { day: 'b', total: 100, clicked: 10 }, { day: 'c', total: 2000, clicked: 10 }]),
    [{ day: 'c', reasons: ['volume above 10x the previous mean'] }]);
});

test('secondary suppression hides a second cell but keeps the help-click count when it can', () => {
  const s = deskSummary([{ outcome: 'clicked_help', count: 12 }, { outcome: 'dismissed', count: 30 }, { outcome: 'left_page', count: 18 }, { outcome: 'timeout', count: 1 }]);
  const cell = Object.fromEntries(s.outcomes.map((c) => [c.outcome, c]));
  assert.equal(cell.timeout.suppressed, true);
  assert.equal(cell.left_page.suppressed, true, 'the smallest other cell is hidden too, so timeout cannot be derived');
  assert.equal(cell.clicked_help.count, 12);
  assert.equal(s.clickThrough.clicked, 12);
  assert.equal(s.clickThrough.shown, 61);
});
