import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCard, validate, VARIANTS } from './card.js';
import { strict, suppress, rate } from './validate.js';
import { longSentences, MAX_SENTENCE_WORDS } from './a11y.js';

/* ---------- card ---------- */

test('a valid card builds', () => {
  const c = buildCard({ headline: 'Help exists', primary: { label: 'See help' } });
  assert.equal(c.variant, 'card');
  assert.equal(c.headline, 'Help exists');
});

test('a card with no primary action is refused', () => {
  assert.throws(() => buildCard({ headline: 'x' }), /primary action/);
});

test('a headline that will not fit 320px is refused', () => {
  assert.throws(() => buildCard({ headline: 'x'.repeat(91), primary: { label: 'Go' } }), /90 chars/);
});

test('a body that would need scrolling is refused', () => {
  assert.throws(() => buildCard({ headline: 'h', body: 'y'.repeat(421), primary: { label: 'Go' } }), /scrolling/);
});

test('every variant is accepted', () => {
  for (const v of VARIANTS) {
    const c = buildCard({ variant: v, headline: 'h', primary: { label: 'Go' } });
    assert.equal(c.variant, v);
  }
});

test('validation reports every problem, not just the first', () => {
  const v = validate({ variant: 'nope', headline: '', primary: null });
  assert.ok(v.errors.length >= 3, JSON.stringify(v.errors));
});

/* ---------- validate ---------- */

const SCHEMA = { i: (v) => typeof v === 'string' };

test('an unknown key is rejected, never stripped', () => {
  const r = strict(SCHEMA, { i: 'a', session: 'x' });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(), /unknown field: session/);
});

test('a payload with no unknown keys passes through intact', () => {
  const r = strict(SCHEMA, { i: 'a' });
  assert.equal(r.ok, true);
  assert.equal(r.payload.i, 'a');
});

test('cells below k are suppressed rather than rounded', () => {
  const out = suppress([{ count: 4 }, { count: 10 }], 10);
  assert.equal(out[0].count, null);
  assert.equal(out[0].suppressed, true);
  assert.equal(out[1].count, 10);
});

test('a rate always carries its denominator and flags small n', () => {
  const r = rate(1, 20);
  assert.equal(r.denominator, 20);
  assert.match(r.note, /small denominator/);
  assert.equal(rate(1, 0).value, null);
});

/* ---------- a11y ---------- */

test('plain-language rule catches long sentences', () => {
  const long = 'This sentence has a great many words in it and it keeps going past the limit that we have set here for plain language so it is caught.';
  assert.ok(longSentences(long).length === 1);
  assert.equal(longSentences('Short one. Also short.').length, 0);
  assert.equal(MAX_SENTENCE_WORDS, 20);
});
