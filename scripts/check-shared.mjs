#!/usr/bin/env node
/**
 * Verify the shared modules have not been edited in place by accident.
 *
 * `packages/shared/` holds the pieces the Door, the Desk and the tests all depend on
 * (card, validation, loop, a11y). A change there reaches every shape the Door renders, so
 * it should be deliberate: every file must match .fingerprint.json.
 *
 * If you edited a shared file on purpose: run this script with --write to accept the new
 * hashes, and commit the fingerprint with the change.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const dir = new URL('../packages/shared/', import.meta.url);
const manifest = path.join(dir.pathname, '.fingerprint.json');
const doc = JSON.parse(fs.readFileSync(manifest, 'utf8'));
const write = process.argv.includes('--write');

const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files = fs.readdirSync(dir.pathname).filter((f) => f.endsWith('.js') || f === 'README.md');

let bad = 0;
const next = {};
for (const f of files.sort()) {
  const h = hash(path.join(dir.pathname, f));
  next[f] = h;
  const want = doc.files[f];
  if (!want) console.log(`  + ${f}  (new, not in fingerprint)`);
  else if (want !== h) { console.log(`  ✗ ${f}  drifted`); bad++; }
}
for (const f of Object.keys(doc.files)) {
  if (!files.includes(f)) { console.log(`  - ${f}  listed but missing`); bad++; }
}

if (write) {
  doc.files = next;
  fs.writeFileSync(manifest, JSON.stringify(doc, null, 2) + '\n');
  console.log('✓ fingerprint rewritten — commit it with the change');
  process.exit(0);
}
if (bad) {
  console.error(`\n${bad} shared file(s) changed. That is fine if it was deliberate:`);
  console.error('run  node scripts/check-shared.mjs --write  and commit the fingerprint with the change.');
  process.exit(1);
}
console.log(`✓ shared modules intact — ${files.length} files match the fingerprint`);
