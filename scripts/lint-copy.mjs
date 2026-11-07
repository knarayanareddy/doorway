#!/usr/bin/env node
/**
 * Copy lint — runs over the REAL strings in every language (review H7, M5, B3, B8).
 * It imports packages/doorway/src/copy.js, so it cannot drift from what ships.
 *
 *   1. No message may assume intent (R7), in nl / en / de.
 *   2. No confidentiality or anonymity words in shipped copy at all. A service's
 *      own wording appears only via footnoteFor(), gated by isRenderableConfidence().
 *   3. No number followed by a unit of time outside a reviewed legal record.
 *   4. No sentence over the 20-word plain-language limit.
 *   5. A human route with no verified confidentiality record must produce neutral copy.
 *
 * Native-speaker review of nl/de is still a human step: this lint cannot judge tone.
 */
import fs from 'node:fs';
import { allStrings, footnoteFor, LANGS } from '../packages/doorway/src/copy.js';
import { LEGAL_RECORDS } from '../packages/doorway/src/legal-records.js';
import { isRenderableLegal } from '../packages/core/src/legal.js';
import { isRenderableConfidence, allRoutes } from '../packages/core/src/route.js';
import { longSentences } from '../packages/shared/a11y.js';

const ASSUMES_INTENT = [
  /\byou are (?:looking|searching) for\b/i, /\byou (?:searched|looked) for\b/i,
  /\bsince you(?:'re| are) (?:looking|searching)\b/i, /\bwe (?:see|noticed|detected) (?:that )?you\b/i,
  /\bje (?:zocht|zoekt|zoekt naar)\b/i, /\bu zocht\b/i, /\bwe zagen dat\b/i,
  /\bdu (?:suchst|hast gesucht|suchtest)\b/i, /\bwir haben (?:gesehen|bemerkt)\b/i,
];
const CLAIM = /confiden|anonym|anoniem|vertrau|vertrouwelijk|\bname\b|\bnaam\b|\bnamen\b|not (?:be )?reported|police|politie|polizei|strafregister|criminal record|strafblad/i;
const UNIT = /\d+\s*(?:hours?|years?|months?|uur|uren|jaar|jaren|maanden?|stunden?|jahre?n?|monate?n?)\b/i;

const problems = [];
const strings = allStrings();

for (const { path, text } of strings) {
  for (const re of ASSUMES_INTENT) if (re.test(text)) problems.push(`${path}: assumes intent → "${text}"`);
  if (CLAIM.test(text)) problems.push(`${path}: confidentiality/anonymity/legal wording in unreviewed copy → "${text}"`);
  if (UNIT.test(text)) problems.push(`${path}: a number with a time unit needs a reviewed legal record → "${text}"`);
  for (const s of longSentences(text)) problems.push(`${path}: sentence over 20 words → "${s}"`);
}

// Legal records: a record that renders must be complete; a draft may carry penalties but never renders.
for (const rec of LEGAL_RECORDS) {
  const renders = isRenderableLegal(rec);
  for (const L of LANGS) for (const v of rec.copy[L] || []) {
    for (const s of longSentences(v.b)) problems.push(`legal ${rec.jurisdiction}/${L}: sentence over 20 words → "${s}"`);
    if (UNIT.test(v.b) && !renders) problems.push(`legal ${rec.jurisdiction}/${L}: penalty figures in a record with no reviewer`);
  }
}

// Route-bound rule: no human route may reach a visitor with unverified confidentiality wording.
const routes = JSON.parse(fs.readFileSync(new URL('../packages/doorway/src/routes.nl.json', import.meta.url), 'utf8'));
for (const { r, where } of allRoutes(routes)) {
  if (isRenderableConfidence(r)) continue;
  for (const L of LANGS) {
    const f = footnoteFor(r, L);
    if (CLAIM.test(f)) problems.push(`${where} (${r.id}) ${L}: footnote makes a claim without a verified record → "${f}"`);
  }
}

if (problems.length) {
  console.error('\n✗ COPY LINT FAILED\n');
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`✓ copy lint passed — ${strings.length} strings × ${LANGS.length} languages, plus legal records and route footnotes`);
