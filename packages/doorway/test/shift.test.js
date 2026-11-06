import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pick, advance, bucketOf, variantFor, DEFAULT_CONFIG } from '../../core/src/shift.js';

const H = 3.6e6;
const T0 = 1_760_000_000_000;

test('first exposure gates with a LEGAL message', () => {
  const r = pick({}, DEFAULT_CONFIG, T0);
  assert.equal(r.state, 'FIRST');
  assert.equal(r.format, 'gate');
  assert.equal(r.family, 'legal', 'entry endpoint must be legal — Prichard 2022 OR 2.99, 2024 OR 5.02');
});

test('sequence escalates gate -> card -> chat and changes family at each step', () => {
  let st = {};
  let now = T0;
  const out = [];
  for (let i = 0; i < 5; i++) {
    const r = pick(st, DEFAULT_CONFIG, now);
    out.push(`${r.format}:${r.family}`);
    st = advance(st, `${r.family}-01`, now);
    now += 100 * H; // well outside the interval
  }
  assert.deepEqual(out, ['gate:legal', 'gate:legal', 'card:harm', 'card:harm', 'chat:control']);
});

test('five exposures produce five buckets, capped at 5+', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(bucketOf), ['1', '2', '3', '4', '5+', '5+']);
});

test('inside the re-warning interval it degrades to quiet rather than repeating', () => {
  const r = pick({ n: 3, last: T0 }, DEFAULT_CONFIG, T0 + 1 * H);
  assert.equal(r.state, 'HABITUATED');
  assert.equal(r.format, 'quiet');
});

test('blocked storage degrades to first-exposure behaviour, never fails closed', () => {
  const r = pick({}, DEFAULT_CONFIG, T0, { storageBlocked: true });
  assert.equal(r.state, 'DEGRADED');
  assert.equal(r.format, 'gate');
});

test('variant rotation avoids repeating what was just shown', () => {
  assert.equal(variantFor('legal', []), 'legal-01');
  assert.equal(variantFor('legal', ['legal-01']), 'legal-02');
  assert.notEqual(variantFor('legal', ['legal-01', 'legal-02']), 'legal-01');
});
