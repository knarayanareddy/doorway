import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build, FIELDS, aggregateKey, suppress, ctr } from '../../core/src/counter.js';
import fs from 'node:fs';

const GOOD = {
  i: 'inst_7f3a2c', v: 'legal-01', f: 'gate', t: 'search',
  o: 'clicked_help', r: 'nl-offlimits', e: '5+', b: 14,
};

test('the payload is exactly eight fields', () => {
  const r = build(GOOD);
  assert.equal(r.ok, true);
  assert.equal(Object.keys(r.payload).length, 8);
  assert.deepEqual(Object.keys(r.payload), FIELDS);
});

test('a session id is rejected, not stripped', () => {
  const r = build({ ...GOOD, s: 'sess_abc123' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /unknown field: s/);
});

test('a precise timestamp is rejected', () => {
  const r = build({ ...GOOD, ts: 1762432000123 });
  assert.equal(r.ok, false);
});

test('an exact exposure count outside the bucket set is rejected', () => {
  const r = build({ ...GOOD, e: '7' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /invalid e/);
});

test('query text cannot be carried in any field', () => {
  const r = build({ ...GOOD, v: 'child porn' });
  assert.equal(r.ok, false);
});

test('aggregate key never includes a person-level dimension', () => {
  const k = aggregateKey(build(GOOD).payload);
  for (const forbidden of ['sess', 'user', 'ip', 'ts', 'uid']) {
    assert.ok(!k.includes(forbidden), `key leaked ${forbidden}`);
  }
});

test('cells below k are suppressed', () => {
  const rows = [{ count: 7 }, { count: 10 }, { count: 40 }];
  const out = suppress(rows, 10);
  assert.equal(out[0].suppressed, true);
  assert.equal(out[0].count, null);
  assert.equal(out[1].suppressed, undefined);
});

test('click-through always reports its denominator', () => {
  const a = ctr(3, 300);
  assert.ok(Math.abs(a.rate - 0.01) < 1e-9);
  assert.equal(a.shown, 300);
  const b = ctr(1, 20);
  assert.match(b.note, /small denominator/);
});

test('no source file contains fetch() inside the widget core', () => {
  for (const f of ['shift.js', 'route.js']) {
    const src = fs.readFileSync(new URL(`../../core/src/${f}`, import.meta.url), 'utf8');
    assert.ok(!/fetch\(|XMLHttpRequest|navigator\.sendBeacon/.test(src), `${f} must not touch the network`);
  }
});
