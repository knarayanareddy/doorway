#!/usr/bin/env node
/**
 * `npm run check` — the organisers' safety rules, enforced locally.
 *
 * The UNICRI repo ships `tools/check-safety.js` and its README says to run
 * `npm run check` before every commit. That script imports Ajv. This repo has a
 * deliberate zero-dependency rule, so rather than vendor a schema validator we
 * reimplement the three checks that carry real risk:
 *
 *   1. every trigger term starts with `test-trigger-`
 *   2. no file looks like a keyword/trigger list unless it is allow-listed
 *   3. the trigger fixture validates against the contract schema's own enums
 *
 * Rule 1 is the one that matters. The brief's first safety rule is "no real
 * abuse-related search terms", and the only mechanical way to hold that is to
 * allow-list a prefix.
 *
 * Exits 1 on any violation, so CI green means the claim is true.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'safety.config.json'), 'utf8'));

const problems = [];
const rel = (p) => path.relative(ROOT, p);

// ── 1 + 2: walk the tree ────────────────────────────────────────────────────
const skip = new Set(cfg.skipDirs);

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!skip.has(e.name)) walk(p);
      continue;
    }
    const r = rel(p);

    // 2. a suspicious filename
    const lower = e.name.toLowerCase();
    const looksLikeAList = cfg.forbiddenFilenamePatterns.some(
      (pat) => lower.includes(pat) && !cfg.allowedTriggerFiles.includes(r)
    );
    if (looksLikeAList) {
      problems.push(`${r}: filename looks like a trigger/keyword list (rule 2)`);
    }

    // 1. trigger terms in a file we are allowed to have
    if (cfg.allowedTriggerFiles.includes(r)) {
      let terms;
      try {
        terms = JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {
        problems.push(`${r}: is not valid JSON`);
        continue;
      }
      if (!Array.isArray(terms)) {
        problems.push(`${r}: expected an array of triggers`);
        continue;
      }
      for (const t of terms) {
        const term = typeof t === 'string' ? t : t?.term;
        if (typeof term !== 'string') {
          problems.push(`${r}: entry with no string term: ${JSON.stringify(t)}`);
        } else if (!term.startsWith(cfg.triggerPrefix)) {
          problems.push(`${r}: term "${term.slice(0, 30)}" does not start with ${cfg.triggerPrefix} (rule 1)`);
        }
      }

      // 3. enums straight from the contract schema
      const schemaPath = path.join(ROOT, 'vendor/contract/schemas/trigger-event.schema.json');
      if (fs.existsSync(schemaPath)) {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
        const allowedSev = schema.items.properties.severity.enum;
        const allowedType = schema.items.properties.type.enum;
        for (const t of terms) {
          if (t?.severity && !allowedSev.includes(t.severity)) {
            problems.push(`${r}: severity "${t.severity}" not in schema enum [${allowedSev}] (rule 3)`);
          }
          if (t?.type && !allowedType.includes(t.type)) {
            problems.push(`${r}: type "${t.type}" not in schema enum [${allowedType}] (rule 3)`);
          }
        }
      }
    }
  }
}

walk(ROOT);

// ── report ─────────────────────────────────────────────────────────────────
if (problems.length) {
  console.error(`\n✗ SAFETY CHECK FAILED (${problems.length})\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error('\nSee SAFETY rules: https://github.com/Hackathon-for-Good-The-Hague/HFG8-UNICRI-Stop-Before-It-Starts/blob/main/SAFETY.md');
  process.exit(1);
}
console.log(`✓ safety check passed — every trigger term is ${cfg.triggerPrefix}*, no stray keyword lists, schema enums respected`);
