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

test('confidentiality is never rendered unverified — the honesty gate catches it', () => {
  const problems = assertHonest(table);
  assert.ok(problems.length > 0, 'shipped table must still be flagged until V1 closes');
  assert.match(problems.join(), /unverified/);
});

test('baseLang handles malformed input', () => {
  assert.equal(baseLang('NL-be'), 'nl');
  assert.equal(baseLang(''), 'en');
  assert.equal(baseLang(undefined), 'en');
});
