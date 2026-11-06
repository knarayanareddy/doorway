#!/usr/bin/env node
/**
 * CI gate. Fails the build if anything that could identify a person appears in
 * the shipped surface. This is the mechanical version of docs/02-threat-model.md.
 * Exits 1 on any violation, so a green tick means a reviewer can trust the claim.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN = ['packages/shared', 'packages/core/src', 'packages/doorway/src', 'edge'].map((d) => path.join(ROOT, d));

const FORBIDDEN = [
  { re: /\bsessionScopedId\b/, why: 'session identifier — rejected, see threat model R1' },
  { re: /\bdocument\.cookie\b/, why: 'cookie write' },
  { re: /\blocalStorage\.(?!getItem|setItem|removeItem)/, why: 'unexpected localStorage usage' },
  { re: /\bfingerprint|canvas\.toDataURL|navigator\.plugins\b/, why: 'device fingerprinting' },
  { re: /\bgeo(location)?\b\s*[:.(]/, why: 'geolocation' },
  { re: /\bnavigator\.sendBeacon\(/, why: 'beacon can bypass the validated counter path' },
  { re: /\bAuthorization\b.*\bBearer\b/, why: 'carrying an identity token into the widget' },
];

const ALLOWED_FILES = new Set(['counter.js', 'route.js', 'shift.js']); // pure, network-free

let problems = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(js|mjs|ts)$/.test(f.name)) check(p);
  }
}

/**
 * Strip comments before scanning.
 *
 * A comment that *names* a forbidden identifier is documentation, not a
 * vulnerability — and our own threat model requires us to write down what we
 * refuse. Scanning raw source flagged three prose mentions of `sessionScopedId`
 * in the adapter's header while the adapter reads only two fields.
 *
 * This is deliberately conservative: block comments are removed properly, line
 * comments only when nothing precedes them on the line, and strings are left
 * untouched so `'sessionScopedId'` in real code is still caught.
 */
function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line.replace(/(^|[^:])\/\/.*$/, '$1')))
    .join('\n');
}

function check(p) {
  const src = stripComments(fs.readFileSync(p, 'utf8'));
  const rel = path.relative(ROOT, p);

  for (const { re, why } of FORBIDDEN) {
    const m = src.match(re);
    if (m) problems.push(`${rel}: ${why}  →  found "${m[0]}"`);
  }

  // The eight-field contract is the ONLY write path.
  const posts = src.match(/fetch\([^)]*\/v1\/[a-z/:]+/g) || [];
  for (const post of posts) {
    if (!/\/v1\/(c|heartbeat|arrivals)/.test(post))
      problems.push(`${rel}: posts to a non-whitelisted endpoint  →  ${post}`);
  }

  // Pure modules must not touch the network at all.
  if (ALLOWED_FILES.has(path.basename(p)) && /fetch\(|sendBeacon/.test(src))
    problems.push(`${rel}: pure module must stay network-free`);
}

SCAN.forEach(walk);

if (problems.length) {
  console.error('\n✗ PRIVACY GATE FAILED\n');
  problems.forEach((p) => console.error('  ' + p));
  console.error(`\n${problems.length} violation(s). See docs/02-threat-model.md.\n`);
  process.exit(1);
}
console.log('✓ privacy gate passed — no identifier, cookie, fingerprint or unvalidated write path found');
