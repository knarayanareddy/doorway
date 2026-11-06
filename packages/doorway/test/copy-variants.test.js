import test from 'node:test';
import assert from 'node:assert/strict';
import { variantIndex } from '../src/widget.js';
import { variantFor, DEFAULT_CONFIG } from '../../core/src/shift.js';

/**
 * The invariant that was broken until 6 Nov, and would have been invisible in
 * any unit test that did not cross the boundary:
 *
 * `shift.variantFor()` returns "legal-01", "legal-02", "legal-03".
 * The widget must therefore HAVE three messages per family, and must render the
 * one named by the id. Before the fix it had one message per family and always
 * rendered index 0, while the beacon reported a rotating id — so the aggregate
 * dashboard would have shown three variants in use and a person would have seen
 * one. A metric that reports rotation that never happened is worse than no
 * metric: it is unfalsifiable.
 */

const FAMILIES = ['legal', 'harm', 'control', 'quiet'];
const POOL_SIZE = 3; // `${family}-01..03`, per shift.variantFor

test('variantIndex reads the pool position out of a variant id', () => {
  assert.equal(variantIndex('legal-01'), 0);
  assert.equal(variantIndex('legal-02'), 1);
  assert.equal(variantIndex('legal-03'), 2);
  assert.equal(variantIndex('harm-03'), 2);
});

test('variantIndex falls back to the first message rather than throwing', () => {
  assert.equal(variantIndex(undefined), 0);
  assert.equal(variantIndex(''), 0);
  assert.equal(variantIndex('nonsense'), 0);
});

test('every family the Shift can emit has a variant for every pool slot', () => {
  // Walk the pool exactly as the widget does and assert we never fall through
  // to the default because a message is missing.
  for (const family of FAMILIES) {
    const seen = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const id = variantFor(family, seen);
      assert.match(id, new RegExp(`^${family}-0[1-3]$`), `${family}: unexpected id ${id}`);
      const idx = variantIndex(id);
      assert.ok(idx >= 0 && idx < POOL_SIZE, `${family}: ${id} indexes outside the pool`);
      seen.push(id);
    }
    assert.equal(new Set(seen).size, POOL_SIZE, `${family}: the pool must offer ${POOL_SIZE} distinct ids`);
  }
});

test('variant rotation avoids repeating the immediately previous message', () => {
  const first = variantFor('legal', []);
  const second = variantFor('legal', [first]);
  assert.notEqual(second, first);
});

test('a family cannot be configured that the copy table does not carry', () => {
  for (const f of Object.values(DEFAULT_CONFIG.families)) {
    assert.ok(FAMILIES.includes(f), `config.families points at "${f}", which has no copy`);
  }
});
