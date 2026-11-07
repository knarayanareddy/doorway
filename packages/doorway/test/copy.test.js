import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { copyFor, footnoteFor, attributionFor, allStrings, controlKind, QUIET, HARM, LANGS, CONTROL } from '../src/copy.js';
import { LEGAL_RECORDS } from '../src/legal-records.js';
import { isRenderableConfidence, isHuman } from '../../core/src/route.js';
import { longSentences } from '../../shared/a11y.js';

const routes = JSON.parse(fs.readFileSync(new URL('../src/routes.nl.json', import.meta.url)));
const everyRoute = Object.values(routes.byLanguage).flatMap((e) => [e.default, ...(e.alternatives || [])]).filter(Boolean);

const NOW = Date.parse('2026-11-07T00:00:00Z');
const verified = (over = {}) => ({
  id: 'x', channel: 'phone', capacity: 'human', phone: '1',
  conf: { text: 'Calls are confidential, in the service\'s own words.', basis: 'service-published',
    sourceUrl: 'https://example.org/policy', verifiedBy: 'A. Person, Offlimits', verifiedAt: '2026-10-01', expiresAt: '2027-10-01', ...over },
});

// ── B3: one predicate, no second regex ─────────────────────────────────────
test('route-honesty: unverified wording never renders — including "Confirm wording on site"', () => {
  const draft = { id: 'x', channel: 'chat', capacity: 'human', conf: 'Anonymous and free. Confirm wording on site — docs/04 V1.' };
  assert.equal(isRenderableConfidence(draft, NOW), false);
  assert.doesNotMatch(footnoteFor(draft, 'en', NOW), /confiden|anonym/i);
});

test('a confidentiality claim renders only with every field of the record', () => {
  assert.equal(isRenderableConfidence(verified(), NOW), true);
  assert.match(footnoteFor(verified(), 'en', NOW), /confidential/);
  const broken = [
    { verifiedBy: null }, { verifiedBy: '' }, { basis: null }, { text: '' }, { sourceUrl: null },
    { sourceUrl: 'http://plain.example' }, { verifiedAt: null }, { verifiedAt: '2025-01-01' },
    { verifiedAt: '2027-01-01' }, { expiresAt: '2026-01-01' }, { expiresAt: null },
  ];
  for (const b of broken) {
    assert.equal(isRenderableConfidence(verified(b), NOW), false, JSON.stringify(b));
    assert.doesNotMatch(footnoteFor(verified(b), 'en', NOW), /confidential/);
  }
});

test('the shipped routes carry no verified confidentiality record, so none is rendered', () => {
  for (const r of everyRoute) {
    assert.equal(isRenderableConfidence(r, NOW), false, `${r.id} must not render a claim until a named person at the service confirms it`);
    for (const L of LANGS) assert.doesNotMatch(footnoteFor(r, L, NOW), /confiden|anonym|anoniem|vertrau|vertrouwelijk/i);
  }
});

test('no string the visitor can read makes a confidentiality or anonymity claim', () => {
  const CLAIM = /confiden|anonym|anoniem|vertrau|vertrouwelijk|\bname\b|\bnaam\b|\bnamen\b|not (?:be )?reported|police|politie|polizei/i;
  for (const { path, text } of allStrings()) assert.doesNotMatch(text, CLAIM, `${path}: "${text}"`);
});

// ── B8: legal claims are reviewed records or they do not render ────────────
test('without an explicit, reviewed jurisdiction nobody is shown a statute', () => {
  const NL_STATUTE = /artikel 252|article 252|Wetboek van Strafrecht|Dutch Criminal Code|Strafgesetzbuch/i;
  const a = (j, records) => JSON.stringify(copyFor({ format: 'gate', family: 'legal', lang: 'en', legalJurisdiction: j, now: NOW, legalRecords: records }));
  for (const j of ['NL', 'DE', 'GB', null, undefined, 'nl']) assert.doesNotMatch(a(j, LEGAL_RECORDS), NL_STATUTE, `${j}: the NL record is an unreviewed draft`);
});

test('a reviewed record renders only for the jurisdiction the platform declared', () => {
  const reviewed = [{ ...LEGAL_RECORDS[0], reviewedBy: 'Mr. J. de Vries, advocaat', reviewedAt: '2026-10-15', expiresAt: '2027-10-15' }];
  const text = (j) => JSON.stringify(copyFor({ format: 'gate', family: 'legal', lang: 'en', legalJurisdiction: j, now: NOW, legalRecords: reviewed }));
  assert.match(text('NL'), /article 252/);
  assert.match(text('nl'), /article 252/);
  assert.doesNotMatch(text('DE'), /article 252/);
  assert.doesNotMatch(text(undefined), /article 252/, 'never inferred from locale or routing country');
  const stale = [{ ...reviewed[0], expiresAt: '2026-01-01' }];
  assert.doesNotMatch(JSON.stringify(copyFor({ format: 'gate', family: 'legal', lang: 'en', legalJurisdiction: 'NL', now: NOW, legalRecords: stale })), /article 252/);
});

test('no number-plus-time-unit appears in copy outside a reviewed legal record', () => {
  const UNIT = /\d+\s*(?:hours?|years?|months?|uur|uren|jaar|jaren|maanden?|stunden?|jahre?n?|monate?n?)\b/i;
  for (const { path, text } of allStrings()) assert.doesNotMatch(text, UNIT, path);
});

// ── M2: copy is keyed by format first ──────────────────────────────────────
test('quiet-copy: the quiet pill shows the quiet copy, not the harm paragraph', () => {
  for (const L of LANGS) {
    assert.deepEqual(copyFor({ format: 'quiet', family: 'harm', lang: L }), QUIET[L]);
    assert.notDeepEqual(copyFor({ format: 'quiet', family: 'harm', lang: L }), HARM[L]);
    for (const v of QUIET[L]) assert.ok(v.h.length > 0 && v.h.length < 60, 'a pill is short, and card validation needs a headline');
  }
});

test('every format/family/language combination yields three variants with a headline', () => {
  for (const L of LANGS) for (const [format, family] of [['gate', 'legal'], ['card', 'harm'], ['chat', 'control'], ['quiet', 'harm']]) {
    for (const route of [null, { channel: 'chat' }, { channel: 'selfhelp' }, { channel: 'programme' }]) {
      const v = copyFor({ format, family, lang: L, route });
      assert.equal(v.length, 3, `${format}/${family}/${L}`);
      for (const t of v) assert.ok(t.h, `${format}/${family}/${L} needs a headline`);
    }
  }
});

// ── M6: copy never promises a person when the route is a web page ──────────
test('route-matrix: a self-help route never gets copy about a line or a person', () => {
  const PERSON = /prevention line|preventielijn|präventionslinie|talk to a person|praten|sprechen|person/i;
  for (const L of LANGS) for (const t of CONTROL.selfhelp[L]) assert.doesNotMatch(t.b, PERSON, `${L}: ${t.b}`);
  assert.equal(controlKind({ channel: 'selfhelp' }), 'selfhelp');
  assert.equal(controlKind({ channel: 'chat' }), 'human');
  assert.equal(controlKind({ channel: 'programme' }), 'programme');
  assert.equal(controlKind(null), 'none');
});

test('route-matrix: the shipped table never pairs control copy with the wrong kind of route', () => {
  for (const r of everyRoute) {
    const kind = controlKind(r);
    assert.equal(kind === 'human', isHuman(r) && r.channel !== 'programme', r.id);
    const body = copyFor({ format: 'chat', family: 'control', lang: 'en', route: r }).map((t) => t.b).join(' ');
    if (kind !== 'human') assert.doesNotMatch(body, /talk to a person/i, r.id);
  }
});

// ── H5: attribution ────────────────────────────────────────────────────────
test('attribution does not imply a partnership', () => {
  for (const L of LANGS) {
    const a = attributionFor({ name: 'Offlimits' }, L);
    assert.doesNotMatch(a, /&|\band\b/i);
    assert.match(a, /Offlimits/);
    assert.match(a, /independent|onafhankelijk|unabhängig/i);
  }
});

test('the footnote never promises a phone line for a self-help route', () => {
  for (const L of LANGS) assert.doesNotMatch(footnoteFor({ channel: 'selfhelp', capacity: 'selfhelp' }, L), /lijn|line|phone|telefoon|Telefon/i);
});

// ── M5: plain language, applied to the real strings ────────────────────────
test('plain-language: no visitor-facing sentence exceeds the 20-word rule, in any language', () => {
  for (const { path, text } of allStrings()) assert.deepEqual(longSentences(text), [], path);
  for (const rec of LEGAL_RECORDS) for (const [L, vs] of Object.entries(rec.copy)) for (const v of vs) assert.deepEqual(longSentences(v.b), [], `${rec.jurisdiction}/${L}`);
});
