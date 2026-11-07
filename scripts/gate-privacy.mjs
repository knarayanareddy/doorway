#!/usr/bin/env node
/**
 * Privacy gate — the TRIPWIRE half (review H3). The evidence is the Playwright
 * network spec; this stops obvious regressions early and cheaply.
 *
 *   1. ESLint (AST): no XHR / Image / WebSocket / sendBeacon / cookies / eval /
 *      geolocation / extra storage on the visitor path — see eslint.config.js.
 *   2. AST scan for identifiers that must never exist (sessionScopedId, device
 *      fingerprinting) in code OR string literals; comments are ignored because
 *      the parser ignores them, not because a regex guessed where they end.
 *   3. Endpoint consistency: every /v1/… path named anywhere in shipped code has a
 *      handler in edge/c.js, and the Door may only POST to its three write paths.
 *   4. No term list: no file in the shipped surface looks like a trigger/keyword list (R4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as espree from 'espree';

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN = ['packages/shared', 'packages/core/src', 'packages/doorway/src', 'edge'].map((d) => path.join(ROOT, d));
const problems = [];
const rel = (p) => path.relative(ROOT, p);

// 1 ── ESLint
const lint = spawnSync('npx', ['eslint', '--max-warnings=0', ...SCAN.map(rel)], { cwd: ROOT, encoding: 'utf8' });
if (lint.status !== 0) problems.push('eslint (privacy rules) failed:\n' + (lint.stdout + lint.stderr).trim().split('\n').map((l) => '    ' + l).join('\n'));

// 2 ── forbidden identifiers, by AST
const FORBIDDEN = [
  [/^sessionScopedId$/, 'session identifier — rejected, see threat model R1'],
  [/^(fingerprint|fingerprintjs|canvasFingerprint)$/i, 'device fingerprinting'],
  [/^(userId|deviceId|visitorId|trackingId|clientId)$/, 'a person-level identifier'],
];
function* walkAst(node) {
  if (!node || typeof node.type !== 'string') return;
  yield node;
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) for (const c of v) yield* walkAst(c);
    else if (v && typeof v.type === 'string') yield* walkAst(v);
  }
}
const files = [];
SCAN.forEach((d) => (function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'test') walk(p); }
    else if (/\.(js|mjs)$/.test(f.name) && !/\.test\.js$/.test(f.name)) files.push(p);
  }
})(d));

const pathsMentioned = new Map();
for (const p of files) {
  let ast;
  try { ast = espree.parse(fs.readFileSync(p, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', range: false }); }
  catch (e) { problems.push(`${rel(p)}: does not parse (${e.message})`); continue; }
  for (const n of walkAst(ast)) {
    const text = n.type === 'Identifier' ? n.name : n.type === 'Literal' && typeof n.value === 'string' ? n.value : null;
    if (text === null) continue;
    for (const [re, why] of FORBIDDEN) if (re.test(text)) problems.push(`${rel(p)}: ${why} → "${text}"`);
    if (n.type === 'Literal' && /^\/v1\/[a-z/]*$/.test(n.value)) {
      (pathsMentioned.get(n.value) || pathsMentioned.set(n.value, new Set()).get(n.value)).add(rel(p));
    }
  }
}

// 3 ── endpoints ↔ handlers
const edge = fs.readFileSync(path.join(ROOT, 'edge/c.js'), 'utf8');
const handled = new Set([...edge.matchAll(/p === '(\/v1\/[a-z/]*)'/g)].map((m) => m[1]));
for (const [p, where] of pathsMentioned) {
  if (!handled.has(p) && !['/v1/', '/v1'].includes(p)) problems.push(`${[...where].join(', ')}: names ${p}, which edge/c.js does not handle`);
}
const DOOR_WRITES = new Set(['/v1/c', '/v1/heartbeat']);
for (const [p, where] of pathsMentioned) {
  for (const w of where) {
    if (w.startsWith('packages/doorway/src/send.js') && !DOOR_WRITES.has(p)) problems.push(`${w}: the Door may only POST to ${[...DOOR_WRITES].join(', ')}, not ${p}`);
  }
}

// 4 ── no term list
const LISTY = /(trigger|keyword|term|blocklist|wordlist|badword)s?[-_.]?(list|pack|bundle|dictionary)?\.(json|txt|csv)$/i;
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (!['node_modules', '.git', 'organiser', 'vendor', 'research', 'dist', 'mock-platform', '.keys'].includes(f.name)) walk(p); }
    else if (LISTY.test(f.name)) problems.push(`${rel(p)}: looks like a trigger/term list. Doorway is the response layer only and never hosts or ships terms (docs/02 R4).`);
  }
})(ROOT);

if (problems.length) {
  console.error('\n✗ PRIVACY GATE FAILED\n');
  problems.forEach((p) => console.error('  ' + p));
  console.error(`\n${problems.length} violation(s). See docs/02-threat-model.md. This gate is a tripwire; the Playwright network spec is the evidence.\n`);
  process.exit(1);
}
console.log('✓ privacy tripwire passed (AST rules, forbidden identifiers, endpoint↔handler, no term list). Evidence: npm run e2e');
