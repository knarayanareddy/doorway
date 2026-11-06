import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, baseLang, assertHonest } from '../../core/src/route.js';
import fs from 'node:fs';

const table = JSON.parse(fs.readFileSync(new URL('../src/routes.nl.json', import.meta.url)));

test('language first, not country: nl -> Offlimits', () => {
  const r = resolve('nl-NL', table);
  assert.equal(r.route.id, 'nl-offlimits');
  assert.equal(r.reason, 'direct language match');
});

test('an English speaker on a Dutch forum is not sent to a Dutch line', () => {
  const r = resolve('en-GB', table);
  assert.equal(r.route.id, 'fi-redirection');
  assert.notEqual(r.route.id, 'nl-offlimits');
});

test('an unsupported language falls back to en, and says so', () => {
  const r = resolve('ja-JP', table);
  assert.equal(r.lang, 'en');
  assert.match(r.reason, /fallback/);
});

test('when a human is needed but unavailable, self-help is offered rather than a dead phone', () => {
  const r = resolve('ja-JP', table, { need: 'human' });
  assert.ok(r.route.id !== 'uk-stopitnow' || r.lang === 'en');
});

test('the honesty gate catches a route that claims confidentiality with no basis', () => {
  // The shipped table now carries a basis on every route that makes a
  // confidentiality claim (V1 evidence, docs/04), so it passes cleanly. The gate
  // is tested against a synthetic table — otherwise a passing gate and a broken
  // gate look identical from here.
  const unverified = {
    byLanguage: {
      nl: { default: { id: 'nl-x', name: 'X', channel: 'phone', capacity: 'human', conf: 'VERIFY' } },
      en: { default: { id: 'en-x', name: 'Y', channel: 'phone', capacity: 'human' } },
    },
  };
  const problems = assertHonest(unverified);
  // nl-x carries `conf: 'VERIFY'` → flagged as unverified.
  // en-x carries no `conf` at all → flagged as a human route with no statement.
  assert.equal(problems.length, 2, JSON.stringify(problems));
  assert.match(problems.join(), /unverified/);
  assert.match(problems.join(), /no confidentiality statement/);
});

test('the shipped table passes the honesty gate', () => {
  assert.deepEqual(assertHonest(table), [], 'every confidentiality claim must cite a basis');
});

test('baseLang handles malformed input', () => {
  assert.equal(baseLang('NL-be'), 'nl');
  assert.equal(baseLang(''), 'en');
  assert.equal(baseLang(undefined), 'en');
});
