#!/usr/bin/env node
/**
 * Docs drift gate (review M1). This repo's currency is trust in its own honesty,
 * so documentation facts that can rot are checked, not trusted:
 *
 *   1. every relative markdown link resolves to a file
 *   2. no hard-coded test counts ("72 tests") in README/BUILD — run `npm run status`
 *   3. every row of a "Closed" table in docs/04 names a source
 *   4. no paragraph of 200+ characters appears twice within a docs/ file (the V1/V2 copy-paste)
 *   5. no doc says "eight fields" — the contract is seven
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const problems = [];
const md = [];
for (const f of ['README.md', 'BUILD.md', 'INSTALL.md', 'CONTRIBUTING.md', 'VENDORED.md']) if (fs.existsSync(path.join(ROOT, f))) md.push(f);
for (const f of fs.readdirSync(path.join(ROOT, 'docs'))) if (f.endsWith('.md')) md.push('docs/' + f);

for (const f of md) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const dir = path.dirname(path.join(ROOT, f));

  for (const m of src.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split('#')[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    if (!fs.existsSync(path.resolve(dir, target))) problems.push(`${f}: broken link → ${m[1]}`);
  }

  if (['README.md', 'BUILD.md', 'INSTALL.md'].includes(f) && /\b\d+\s+(?:unit\s+)?tests?\b/i.test(src.replace(/`[^`]*`/g, ''))) {
    problems.push(`${f}: hard-coded test count — it will drift; point at \`npm run status\``);
  }
  if (/\beight[- ]field|\b8[- ]field|eight fields/i.test(src) && !/historical|was eight|formerly eight|no longer eight/i.test(src)) {
    problems.push(`${f}: says "eight fields" — the contract is seven (review H2)`);
  }

  if (f.startsWith('docs/')) {
    const seen = new Map();
    for (const para of src.split(/\n\s*\n/)) {
      const t = para.replace(/\s+/g, ' ').trim();
      if (t.length < 200) continue;
      if (seen.has(t)) problems.push(`${f}: a ${t.length}-character paragraph is repeated verbatim ("${t.slice(0, 60)}…")`);
      seen.set(t, true);
    }
  }
}

const ver = fs.readFileSync(path.join(ROOT, 'docs/04-open-verifications.md'), 'utf8');
const closed = ver.split(/^## Closed/m)[1] || '';
for (const line of closed.split('\n')) {
  if (!line.startsWith('|') || /^\|[-| ]+\|$/.test(line) || /^\|\s*Claim\s*\|/.test(line)) continue;
  const cells = line.split('|').slice(1, -1).map((c) => c.trim());
  if (cells.length < 2 || !cells[1]) problems.push(`docs/04 Closed: row with no source → ${cells[0]?.slice(0, 60)}`);
}

if (problems.length) {
  console.error('\n✗ DOCS CHECK FAILED\n');
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`✓ docs check passed — ${md.length} files: links resolve, no stale counts, no duplicated paragraphs, every closed claim has a source`);
