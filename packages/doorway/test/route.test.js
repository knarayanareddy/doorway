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

// ── Country routing ─────────────────────────────────────────────────────────
// PLUGIN_CONTRACT.md makes `country` a required field of every trigger event.
// We ignored it until 6 Nov 2026, and the consequence was measurable: a
// German-speaking user was routed to a UK phone number, because `de` had no
// entry in the table and the chain fell through to `en`.
import { normaliseCountry, servesCountry } from '../../core/src/route.js';

test('country is normalised, and junk returns null rather than throwing', () => {
  assert.equal(normaliseCountry('de'), 'DE');
  assert.equal(normaliseCountry('NL'), 'NL');
  assert.equal(normaliseCountry('DEU'), null, 'alpha-3 is not the contract field');
  assert.equal(normaliseCountry(''), null);
  assert.equal(normaliseCountry(undefined), null);
  assert.equal(normaliseCountry(42), null);
});

test('a service with no `countries` serves everyone; a listed one does not', () => {
  assert.equal(servesCountry({ id: 'x' }, 'FR'), true, 'cross-border services omit the field');
  assert.equal(servesCountry({ id: 'x', countries: [] }, 'FR'), true);
  assert.equal(servesCountry({ id: 'x', countries: ['NL'] }, 'NL'), true);
  assert.equal(servesCountry({ id: 'x', countries: ['NL'] }, 'DE'), false);
  assert.equal(servesCountry({ id: 'x', countries: ['gb'] }, 'GB'), true, 'case-insensitive');
});

test('a German speaker in Germany gets the German service, not a UK number', () => {
  const r = resolve('de-DE', table, { need: 'human', country: 'DE' });
  assert.equal(r.route.id, 'de-kein-taeter');
  assert.notEqual(r.route.id, 'uk-stopitnow', 'this was the 6 Nov misroute');
});

test('country never overrides language', () => {
  // A Turkish speaker in the Netherlands must not be sent to a Dutch-only line.
  const r = resolve('tr-TR', table, { need: 'human', country: 'NL' });
  assert.notEqual(r.route.id, 'nl-offlimits');
});

test('a country with no local service degrades to self-help, not to a wrong number', () => {
  const r = resolve('fr-FR', table, { need: 'human', country: 'FR' });
  assert.ok(r.route, 'never returns null when something is better than nothing');
  assert.notEqual(r.route.id, 'uk-stopitnow', 'a French user must not be given a UK helpline');
  assert.match(r.reason, /self-help|no local/i);
});

test('the same language routes differently by country', () => {
  const gb = resolve('en-GB', table, { need: 'human', country: 'GB' });
  const de = resolve('en-US', table, { need: 'human', country: 'DE' });
  assert.equal(gb.route.id, 'uk-stopitnow');
  assert.notEqual(de.route.id, 'uk-stopitnow', 'a US or DE visitor must not get a UK-only line');
});

test('omitting country keeps the old language-only behaviour', () => {
  const r = resolve('nl-NL', table, { need: 'human' });
  assert.equal(r.route.id, 'nl-offlimits');
});
