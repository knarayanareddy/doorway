import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bell, wavePhase, waveOrbScale, waveBreathIn, waveArea, wavePixel, buildCard, validate } from './card.js';

/* The Wave's curve maths, ported from the preview. Pure, so no DOM is needed. */

test('bell peaks near x = 0.42 and is lower at both ends', () => {
  assert.equal(bell(0.42), 1);
  assert.ok(bell(0.37) < 1 && bell(0.47) < 1, 'falls away on both sides of the peak');
  assert.ok(bell(0) < 0.05, `start is low, got ${bell(0)}`);
  assert.ok(bell(1) < 0.05, `end is low, got ${bell(1)}`);
});

test('the curve rises, peaks and falls: the pixel y of the dot goes up then down', () => {
  const y = (p) => wavePixel(p, bell(p))[1];
  assert.ok(y(0.2) > y(0.42), 'the dot is higher (smaller y) at the peak than before it');
  assert.ok(y(0.9) > y(0.42), 'and lower again by the end');
});

test('phases switch at 0.3 (rise to peak) and 0.56 (peak to fall)', () => {
  assert.equal(wavePhase(0), 'rise');
  assert.equal(wavePhase(0.299), 'rise');
  assert.equal(wavePhase(0.3), 'peak');
  assert.equal(wavePhase(0.559), 'peak');
  assert.equal(wavePhase(0.56), 'fall');
  assert.equal(wavePhase(1), 'fall');
});

test('the orb scale oscillates between 0.8 and 1.14 with a period of 8 s', () => {
  assert.equal(waveOrbScale(0), 0.8);
  assert.ok(Math.abs(waveOrbScale(4) - 1.14) < 1e-9, `peak at 4 s, got ${waveOrbScale(4)}`);
  for (let e = 0; e <= 16; e += 0.25) {
    const s = waveOrbScale(e);
    assert.ok(s >= 0.8 - 1e-9 && s <= 1.14 + 1e-9, `in range at ${e}: ${s}`);
    assert.ok(Math.abs(s - waveOrbScale(e + 8)) < 1e-9, `period 8 s at ${e}`);
  }
});

test('reduced motion holds the orb at scale 1', () => {
  for (const e of [0, 1, 4, 7.5]) assert.equal(waveOrbScale(e, true), 1);
});

test('breathIn flips every 4 s', () => {
  assert.equal(waveBreathIn(0), true);
  assert.equal(waveBreathIn(3.99), true);
  assert.equal(waveBreathIn(4), false);
  assert.equal(waveBreathIn(7.99), false);
  assert.equal(waveBreathIn(8), true);
});

test('the filled area is empty at the start and closed on the baseline once it has begun', () => {
  assert.equal(waveArea(0), '');
  const d = waveArea(0.5);
  assert.ok(d.startsWith('M0,82 '), d.slice(0, 20));
  assert.ok(d.endsWith(' Z'));
});

const timer = (over = {}) => ({
  type: 'timer', id: 'wave', seconds: 15, startLabel: 'Begin', doneText: 'done',
  phases: [{ until: 1, label: 'a' }, { until: 1, label: 'b' }, { until: 1, label: 'c' }],
  breath: { in: 'Breathe in', out: 'Breathe out' }, curve: true, ...over,
});

test('a curve timer needs three phase labels and both breath labels', () => {
  const card = (b) => buildCard({ variant: 'wave', headline: 'h', body: 'b', primary: { label: 'Ok', kind: 'primary' }, sections: [{ blocks: [b] }] });
  assert.equal(validate(card(timer())).ok, true);
  assert.throws(() => card(timer({ breath: undefined })), /curve timer needs/);
  assert.throws(() => card(timer({ phases: [{ until: 1, label: 'a' }] })), /curve timer needs/);
});
