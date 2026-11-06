#!/usr/bin/env node
/**
 * Copy lint. Two rules that came out of the research, enforced mechanically:
 *   1. No message may assume intent ("you are looking for", "you searched for").
 *      The classifier cannot tell an offender from a survivor or a journalist.
 *   2. No confidentiality claim may render without a named source.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const MSG_DIR = path.join(ROOT, 'data', 'messages');

const ASSUMES_INTENT = [
  /\byou are (?:looking|searching) for\b/i,
  /\byou (?:searched|looked) for\b/i,
  /\bsince you(?:'re| are) (?:looking|searching)\b/i,
  /\bwe (?:see|noticed|detected) (?:that )?you\b/i,
];

const CONF_CLAIM = /\b(?:nothing is|not|never) (?:reported|shared) (?:to|with) (?:the )?police\b|\bfully anonymous\b|\b100% (?:anonymous|confidential)\b/i;

let problems = [];

if (!fs.existsSync(MSG_DIR)) {
  console.log('no message bundle yet — copy lint skipped');
  process.exit(0);
}

for (const f of fs.readdirSync(MSG_DIR)) {
  if (!/\.(md|json)$/.test(f)) continue;
  const src = fs.readFileSync(path.join(MSG_DIR, f), 'utf8');
  for (const re of ASSUMES_INTENT) {
    const m = src.match(re);
    if (m) problems.push(`${f}: assumes intent → "${m[0]}"`);
  }
  if (CONF_CLAIM.test(src) && !/source:\s*\S+/.test(src)) {
    problems.push(`${f}: confidentiality claim with no "source:" line — see docs/04-open-verifications.md V1`);
  }
}

if (problems.length) {
  console.error('\n✗ COPY LINT FAILED\n');
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log('✓ copy lint passed');
