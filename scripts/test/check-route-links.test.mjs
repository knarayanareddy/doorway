import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectUrls } from '../check-route-links.mjs';

test('collectUrls: defaults and alternatives of every language, once each, with the routes that use them', () => {
  const m = collectUrls({
    byLanguage: {
      nl: { default: { id: 'a', url: 'https://one.example/' }, alternatives: [{ id: 'b', url: 'https://two.example/' }] },
      en: { default: { id: 'c', url: 'https://one.example/' }, alternatives: [] },
    },
  });
  assert.deepEqual([...m.keys()].sort(), ['https://one.example/', 'https://two.example/']);
  assert.deepEqual(m.get('https://one.example/'), ['a', 'c']);
});

test('collectUrls: tolerates missing parts and routes without a url', () => {
  assert.equal(collectUrls({}).size, 0);
  assert.equal(collectUrls({ byLanguage: { nl: { default: { id: 'x' }, alternatives: [null] } } }).size, 0);
});
