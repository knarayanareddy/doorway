#!/usr/bin/env node
/**
 * Verify the shared modules have not been edited in place by accident.
 *
 * `packages/shared/` holds the pieces the Door, the Desk and the tests all depend on
 * (card, validation, loop, a11y). A change there reaches every shape the Door renders, so
 * it should be deliberate: every file must match .fingerprint.json.
 *
 * If you edited a shared file on purpose:
 *
 *   node scripts/check-shared.mjs --write --reason "why it changed"
 *
 * That prints what changed (exported names, line counts; the baseline is the file at HEAD), rewrites
 * .fingerprint.json, and appends a dated entry to packages/shared/FINGERPRINT-LOG.md. Commit all three with
 * the change. CI (scripts/check-fingerprint-log.mjs) fails if the fingerprint changed without a log entry.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as espree from 'espree';
import { formatEntry, LOG } from './check-fingerprint-log.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const dir = path.join(ROOT, 'packages/shared');
const manifest = path.join(dir, '.fingerprint.json');
const logFile = path.join(ROOT, LOG);

const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/** The names a module exports, from its AST (so `export { a as b }` and `export default` are both seen). */
export function exportNames(source) {
  const ast = espree.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const names = new Set();
  for (const node of ast.body) {
    if (node.type === 'ExportDefaultDeclaration') names.add('default');
    else if (node.type === 'ExportAllDeclaration') names.add(`* from ${node.source.value}`);
    else if (node.type === 'ExportNamedDeclaration') {
      const d = node.declaration;
      if (d?.id) names.add(d.id.name);
      for (const v of d?.declarations ?? []) if (v.id.type === 'Identifier') names.add(v.id.name);
      for (const s of node.specifiers) names.add(s.exported.name ?? s.exported.value);
    }
  }
  return [...names].sort();
}

/** The HEAD version of a shared file, or null when git has none (a new or untracked file). */
function atHead(file) {
  try {
    return execFileSync('git', ['show', `HEAD:packages/shared/${file}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** What changed in one file relative to HEAD: exports added or removed, and the line-count delta. */
export function describeChange(file, oldSource, newSource) {
  const before = oldSource == null ? null : exportNames(oldSource);
  const after = exportNames(newSource);
  const linesBefore = oldSource == null ? 0 : oldSource.split('\n').length;
  const linesAfter = newSource.split('\n').length;
  return {
    file,
    isNew: oldSource == null,
    linesDelta: linesAfter - linesBefore,
    exportsAdded: after.filter((n) => !(before ?? []).includes(n)),
    exportsRemoved: (before ?? []).filter((n) => !after.includes(n)),
  };
}

const fmtChange = (c) => {
  const sign = c.linesDelta > 0 ? '+' : '';
  const parts = [`${c.isNew ? 'new file' : 'lines ' + sign + c.linesDelta}`];
  if (c.exportsAdded.length) parts.push(`exports +${c.exportsAdded.join(', +')}`);
  if (c.exportsRemoved.length) parts.push(`exports -${c.exportsRemoved.join(', -')}`);
  if (!c.isNew && !c.exportsAdded.length && !c.exportsRemoved.length && c.linesDelta === 0) parts.push('same exports, same length');
  return `      ${c.file}: ${parts.join('; ')}`;
};

export function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const ri = argv.indexOf('--reason');
  const reason = ri >= 0 ? (argv.at(ri + 1) ?? '').trim() : '';
  if (write && !reason) {
    console.error('check-shared: --write needs --reason "text" (it is written to packages/shared/FINGERPRINT-LOG.md)');
    return 2;
  }
  const doc = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js') || f === 'README.md').sort();

  let bad = 0;
  const next = {};
  const changes = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f));
    const h = hash(buf);
    next[f] = h;
    const want = doc.files[f];
    // A file that is not in the fingerprint is unchecked: it fails too, so it cannot slip in unreviewed.
    if (!want) { console.log(`  + ${f}  (new, not in fingerprint)`); bad++; }
    else if (want !== h) { console.log(`  ✗ ${f}  drifted`); bad++; }
    else continue;
    changes.push(f.endsWith('.js')
      ? describeChange(f, atHead(f), buf.toString('utf8'))
      : { file: f, isNew: !want, linesDelta: buf.toString('utf8').split('\n').length - (atHead(f)?.split('\n').length ?? 0), exportsAdded: [], exportsRemoved: [] });
  }
  for (const f of Object.keys(doc.files)) {
    if (!files.includes(f)) { console.log(`  - ${f}  listed but missing`); bad++; changes.push({ file: f, removed: true }); }
  }
  for (const c of changes) if (!c.removed) console.log(fmtChange(c));

  if (write) {
    if (!bad) {
      console.log('✓ nothing changed: fingerprint and log left as they are');
      return 0;
    }
    doc.files = next;
    fs.writeFileSync(manifest, JSON.stringify(doc, null, 2) + '\n');
    const date = new Date().toISOString().slice(0, 10);
    const changed = changes.filter((c) => !c.removed).map((c) => c.file);
    const removed = changes.filter((c) => c.removed).map((c) => c.file);
    const listed = [...changed.map((f) => f), ...removed.map((f) => f + ' (removed)')];
    const entry = formatEntry({ date, files: listed.length ? listed : ['(fingerprint only)'], reason });
    const existing = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '# Fingerprint log\n\nOne entry per deliberate change to packages/shared/. Written by `node scripts/check-shared.mjs --write --reason "..."`, checked in CI by `scripts/check-fingerprint-log.mjs`.\n\n';
    fs.writeFileSync(logFile, existing.replace(/\n*$/, '\n\n') + entry);
    console.log(`✓ fingerprint rewritten and ${LOG} updated — commit all three with the change`);
    return 0;
  }
  if (bad) {
    console.error(`\n${bad} shared file(s) changed. That is fine if it was deliberate:`);
    console.error('run  node scripts/check-shared.mjs --write --reason "why"  and commit the fingerprint and the log entry with the change.');
    return 1;
  }
  console.log(`✓ shared modules intact — ${files.length} files match the fingerprint`);
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(main());
