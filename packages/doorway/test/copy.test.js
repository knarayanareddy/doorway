import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { legalCopy, footnoteFor } from '../src/widget.js';

const routes = JSON.parse(fs.readFileSync(new URL('../src/routes.nl.json', import.meta.url)));

const NL_STATUTE = /artikel 252|article 252|Wetboek van Strafrecht|Dutch Criminal Code/i;

test('only a Netherlands user is told about article 252', () => {
  const nl = JSON.stringify(legalCopy('NL'));
  const en = JSON.stringify(legalCopy('NL'));
  assert.match(nl, NL_STATUTE, 'nl variants must carry the statute');
  assert.match(en, NL_STATUTE, 'en variants must carry the statute');
});

test('no non-Dutch user is shown Dutch criminal law', () => {
  for (const country of ['DE', 'GB', 'FR', 'FI', 'US', null, undefined]) {
    const text = JSON.stringify(legalCopy(country));
    assert.doesNotMatch(text, NL_STATUTE,
      `${String(country)} must not be told about a Dutch statute`);
  }
});

test('the legal card is still a warning outside NL, not silence', () => {
  const de = JSON.parse(JSON.stringify(legalCopy('DE')));
  assert.ok(de.en[0].b.length > 60, 'non-NL copy must still say something substantive');
  assert.match(de.en[0].b, /help/i, 'non-NL copy must lead to help');
});

test('the footnote never promises a phone line for a self-help route', () => {
  const selfhelp = { id: 'fi-redirection', capacity: 'selfhelp', channel: 'selfhelp' };
  for (const L of ['nl', 'en']) {
    assert.doesNotMatch(footnoteFor(selfhelp, L), /lijn|line|phone|telefoon/i);
  }
});

test('the footnote promises confidentiality only when the route has a basis', () => {
  const verified = { capacity: 'human', channel: 'chat', conf: 'Anonymous and free.' };
  const unverified = { capacity: 'human', channel: 'chat', conf: 'wording needs VERIFY' };
  const none = { capacity: 'human', channel: 'chat' };
  assert.match(footnoteFor(verified, 'en'), /confidential/i);
  assert.doesNotMatch(footnoteFor(unverified, 'en'), /confidential/i);
  assert.doesNotMatch(footnoteFor(none, 'en'), /confidential/i);
});

test('no route in the shipped table triggers a confidentiality claim', () => {
  // The footnote logic must agree with assertHonest's condition: a route may
  // only promise confidentiality when it carries a verified `conf` basis.
  for (const [, entry] of Object.entries(routes.byLanguage)) {
    for (const r of [entry.default, ...(entry.alternatives || [])].filter(Boolean)) {
      const f = footnoteFor(r, 'en');
      if (/confidential/i.test(f)) {
        assert.ok(r.conf && !/verify|todo|unknown/i.test(r.conf),
          `${r.id} claims confidentiality with no basis`);
      }
    }
  }
});
