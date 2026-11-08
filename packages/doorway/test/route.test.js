import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, baseLang, assertHonest, isAllowedDestination, dropDisallowed } from '../../core/src/route.js';
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

test('the honesty gate catches unsafe routes: free-text conf, dead phone, stale review, off-list host', () => {
  const NOW = Date.parse('2026-11-07');
  const mk = (r) => ({ byLanguage: { nl: { default: { id: 'x', name: 'X', capacity: 'human', url: 'https://offlimits.nl/', reviewBy: '2027-01-01', ...r } } } });
  const problems = (r) => assertHonest(mk(r), NOW);
  assert.deepEqual(problems({ channel: 'chat' }), []);
  assert.match(problems({ channel: 'chat', conf: 'Anonymous. Confirm wording on site.' }).join(), /structured record/);
  assert.match(problems({ channel: 'phone' }).join(), /no phone number/);
  assert.match(problems({ channel: 'programme', phone: '1' }).join(), /not a helpline/);
  assert.match(problems({ channel: 'chat', reviewBy: '2026-01-01' }).join(), /reviewBy .* has passed/);
  assert.match(problems({ channel: 'chat', reviewBy: undefined }).join(), /no reviewBy/);
  assert.match(problems({ channel: 'chat', url: 'https://evil.example/' }).join(), /allow-list/);
  assert.match(problems({ channel: 'chat', url: 'http://offlimits.nl/' }).join(), /allow-list/);
  assert.match(problems({ channel: 'chat', conf: { text: 'x' } }).join(), /missing basis/);
});

test('the shipped table passes the honesty gate', () => {
  assert.deepEqual(assertHonest(table, Date.parse('2026-11-07')), []);
});

test('the shipped German programme is not labelled a phone line', () => {
  const de = table.byLanguage.de.default;
  assert.equal(de.channel, 'programme');
  assert.equal(de.phone, undefined);
  assert.equal(resolve('de', table, { need: 'human', country: 'DE' }).route.id, 'de-kein-taeter');
});

test('destinations are exact https hosts, never wildcards, userinfo or lookalikes', () => {
  assert.equal(isAllowedDestination('https://offlimits.nl/?src=doorway'), true);
  for (const u of ['http://offlimits.nl/', 'https://offlimits.nl.evil.example/', 'https://evil.example/?u=offlimits.nl',
    'https://offlimits.nl@evil.example/', 'javascript:alert(1)', 'https://sub.offlimits.nl/', 'not a url', '']) {
    assert.equal(isAllowedDestination(u), false, u);
  }
});

test('dropDisallowed removes any route outside the allow-list, signed or not', () => {
  const t = { byLanguage: { nl: { default: { id: 'bad', url: 'https://evil.example/' }, alternatives: [{ id: 'ok', url: 'https://offlimits.nl/' }] } } };
  const r = dropDisallowed(t);
  assert.equal(r.byLanguage.nl.default.id, 'ok');
  assert.equal(dropDisallowed({ byLanguage: { nl: { default: { id: 'bad', url: 'https://evil.example/' } } } }).byLanguage.nl, undefined);
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

test('country overrides language only through an explicit country table, and never to another country\'s line', () => {
  // Owner decision for the Netherlands pilot: an install that declares NL sends every non-Dutch browser to the Dutch
  // services (their pages are in Dutch; ReDirection stays an alternative). That is the byCountry.NL table. It is the
  // only country that does this, so a declared country WITHOUT such a table still cannot override language:
  assert.notEqual(resolve('tr-TR', table, { need: 'human', country: 'FR' }).route?.id, 'nl-offlimits');
  assert.notEqual(resolve('tr-TR', table, { need: 'human', country: 'GB' }).route?.id, 'nl-offlimits');
  // ...and the NL table never hands a visitor another country's helpline.
  for (const lang of ['en-GB', 'de-DE', 'tr-TR', 'fr-FR']) {
    const id = resolve(lang, table, { need: 'human', country: 'NL' }).route.id;
    assert.ok(['nl-offlimits', 'nl-stoppen', 'fi-redirection'].includes(id), `${lang} got ${id}`);
  }
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

// ── Specificity outranks table position ─────────────────────────────────────
// Second bug found on 6 Nov, one level below the first. `resolve()` walks a
// chain and returns the FIRST entry that satisfies `need` and `servesCountry`.
// But a service with `countries: []` "serves everyone", so a global self-help
// page listed as `default` beat a national helpline listed as an alternative —
// UK users were routed to a Finnish self-help site.
//
// Fix: among eligible candidates, one that explicitly NAMES your country wins.
import { listsCountry } from '../../core/src/route.js';

test('listsCountry distinguishes "serves everyone" from "names you"', () => {
  assert.equal(listsCountry({ countries: ['GB'] }, 'GB'), true);
  assert.equal(listsCountry({ countries: [] }, 'GB'), false, 'a global service does not name GB');
  assert.equal(listsCountry({}, 'GB'), false);
  assert.equal(listsCountry({ countries: ['GB'] }, null), false);
});

test('a named country beats a global default, whatever the table order', () => {
  const t = {
    byLanguage: {
      en: {
        default: { id: 'global-selfhelp', channel: 'selfhelp', countries: [] },
        alternatives: [{ id: 'gb-helpline', channel: 'phone', countries: ['GB'] }],
      },
    },
  };
  const gb = resolve('en', t, { need: 'any', country: 'GB' });
  assert.equal(gb.route.id, 'gb-helpline', 'GB user must get the GB line, not the global page');
  const fr = resolve('en', t, { need: 'any', country: 'FR' });
  assert.equal(fr.route.id, 'global-selfhelp', 'a country with no named service still gets the global one');
});

test('the shipped table routes GB to the UK line under need:any', () => {
  // need:any is what the gate and card formats ask for. Testing only need:human
  // is how this bug survived the previous round of tests.
  assert.equal(resolve('en-GB', table, { need: 'any', country: 'GB' }).route.id, 'uk-stopitnow');
  assert.equal(resolve('en-GB', table, { need: 'human', country: 'GB' }).route.id, 'uk-stopitnow');
});

test('every country we have a service for resolves to it under need:any', () => {
  const want = {
    NL: 'nl-offlimits',
    DE: 'de-kein-taeter',
    GB: 'uk-stopitnow',
    SE: 'se-preventell',
    US: 'us-stopitnow',
    AU: 'au-stopitnow',
  };
  const lang = { NL: 'nl', DE: 'de', GB: 'en', SE: 'sv', US: 'en', AU: 'en' };
  for (const [country, id] of Object.entries(want)) {
    const r = resolve(lang[country], table, { need: 'any', country });
    assert.equal(r.route.id, id, `${country} must resolve to ${id}, got ${r.route.id}`);
  }
});

// An install that declares country NL sends English and German browsers to the Dutch services. The pages are in Dutch:
// the owner's judgement call for the Netherlands pilot. Without a declared country nothing changes (tests above).
test('country NL: an English browser gets the Dutch self-help (Stoppen is mogelijk), not the Finnish one', () => {
  const r = resolve('en-GB', table, { country: 'NL' });
  assert.equal(r.route.id, 'nl-stoppen');
  assert.ok(isAllowedDestination(r.route.url));
});

test('country NL: a human line is still a human line (Offlimits), and a German browser follows the same table', () => {
  assert.equal(resolve('en-GB', table, { country: 'NL', need: 'human' }).route.id, 'nl-offlimits');
  assert.equal(resolve('de-DE', table, { country: 'NL' }).route.id, 'nl-stoppen');
  assert.equal(resolve('fr-FR', table, { country: 'NL' }).route.id, 'nl-stoppen');
});

test('country NL: a Dutch browser is unchanged, and ReDirection stays reachable as an alternative', () => {
  assert.equal(resolve('nl-NL', table, { country: 'NL' }).route.id, 'nl-offlimits');
  const alts = table.byCountry.NL.en.alternatives.map((a) => a.id);
  assert.deepEqual(alts, ['nl-offlimits', 'fi-redirection']);
});

test('no country declared: an English browser still gets ReDirection', () => {
  assert.equal(resolve('en-GB', table).route.id, 'fi-redirection');
});
