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
const WIDGET_JS = path.join(ROOT, 'packages', 'doorway', 'src', 'widget.js');

const ASSUMES_INTENT = [
  /\byou are (?:looking|searching) for\b/i,
  /\byou (?:searched|looked) for\b/i,
  /\bsince you(?:'re| are) (?:looking|searching)\b/i,
  /\bwe (?:see|noticed|detected) (?:that )?you\b/i,
];

const CONF_CLAIM = /\b(?:nothing is|not|never) (?:reported|shared) (?:to|with) (?:the )?police\b|\bfully anonymous\b|\b100% (?:anonymous|confidential)\b/i;

let problems = [];
let scannedCount = 0;

// 1. Scan external message bundle if present
if (fs.existsSync(MSG_DIR)) {
  for (const f of fs.readdirSync(MSG_DIR)) {
    if (!/\.(md|json)$/.test(f)) continue;
    scannedCount++;
    const src = fs.readFileSync(path.join(MSG_DIR, f), 'utf8');
    for (const re of ASSUMES_INTENT) {
      const m = src.match(re);
      if (m) problems.push(`${f}: assumes intent → "${m[0]}"`);
    }
    if (CONF_CLAIM.test(src) && !/source:\s*\S+/.test(src)) {
      problems.push(`${f}: confidentiality claim with no "source:" line — see docs/04-open-verifications.md V1`);
    }
  }
}

// 2. Scan inline copy in widget.js (resolving B5)
if (fs.existsSync(WIDGET_JS)) {
  scannedCount++;
  const src = fs.readFileSync(WIDGET_JS, 'utf8');
  for (const re of ASSUMES_INTENT) {
    const m = src.match(re);
    if (m) problems.push(`widget.js: assumes intent → "${m[0]}"`);
  }
  if (CONF_CLAIM.test(src)) {
    problems.push(`widget.js: unsubstantiated absolute confidentiality claim found`);
  }
}

if (scannedCount === 0) {
  console.log('no message bundle or widget found — copy lint skipped');
  process.exit(0);
}

if (problems.length) {
  console.error('\n✗ COPY LINT FAILED\n');
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log('✓ copy lint passed');
