#!/usr/bin/env node
/**
 * CI gate: a change to packages/shared/.fingerprint.json must come with a new dated entry in
 * packages/shared/FINGERPRINT-LOG.md. The entry is written by
 *   node scripts/check-shared.mjs --write --reason "why the shared module changed"
 *
 * This script only reads git (git diff, never a state-changing command). The base of the range comes from
 * --base <ref> or FINGERPRINT_BASE (CI sets it to the pull request's base or the push's previous commit).
 * An all-zero base (a new branch) falls back to HEAD~1.
 *
 * The rule itself is the pure function checkFingerprintLog, unit-tested in check-fingerprint-log.test.mjs.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const FINGERPRINT = 'packages/shared/.fingerprint.json';
export const LOG = 'packages/shared/FINGERPRINT-LOG.md';

const HEADING = /^## \d{4}-\d{2}-\d{2}$/;
const FILES = /^- Files: \S/;
const REASON = /^- Reason: \S/;

/** The text of one log entry. check-shared.mjs writes entries with this, so the two cannot disagree. */
export function formatEntry({ date, files, reason }) {
  return [`## ${date}`, `- Files: ${files.join(', ')}`, `- Reason: ${String(reason).trim()}`, ''].join('\n');
}

/** The lines a unified diff adds (the '+' lines, without the '+++' file header). */
export function addedLines(diffText) {
  return diffText.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
}

/**
 * The rule. changedFiles: repo-relative paths changed in the range. addedLogLines: lines the same range adds
 * to the log. Returns the problems; an empty array passes.
 */
export function checkFingerprintLog({ changedFiles, addedLogLines }) {
  if (!changedFiles.includes(FINGERPRINT)) return [];
  if (!changedFiles.includes(LOG)) {
    return [`${FINGERPRINT} changed in this range, but ${LOG} did not. Run: node scripts/check-shared.mjs --write --reason "…" and commit both.`];
  }
  const complete = addedLogLines.some((l) => HEADING.test(l.trimEnd()))
    && addedLogLines.some((l) => FILES.test(l))
    && addedLogLines.some((l) => REASON.test(l));
  if (!complete) {
    return [`${LOG} changed, but the range adds no complete entry: a dated "## YYYY-MM-DD" heading, a "- Files:" line and a non-empty "- Reason:" line.`];
  }
  return [];
}

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export function main(argv = process.argv.slice(2), env = process.env) {
  const i = argv.indexOf('--base');
  let base = i >= 0 ? argv.at(i + 1) : env.FINGERPRINT_BASE;
  if (!base || /^0+$/.test(base)) base = 'HEAD~1';
  const range = `${base}...HEAD`;
  let changedFiles, logDiff;
  try {
    changedFiles = git(['diff', '--name-only', range]).split('\n').filter(Boolean);
    logDiff = changedFiles.includes(LOG) ? git(['diff', range, '--', LOG]) : '';
  } catch (e) {
    console.error(`check-fingerprint-log: cannot read git range ${range}: ${String(e.stderr || e.message).trim()}`);
    return 2;
  }
  const problems = checkFingerprintLog({ changedFiles, addedLogLines: addedLines(logDiff) });
  if (problems.length) {
    console.error('\n✗ FINGERPRINT LOG CHECK FAILED\n');
    problems.forEach((p) => console.error('  ' + p));
    return 1;
  }
  console.log(changedFiles.includes(FINGERPRINT) ? `✓ fingerprint changed in ${range} and the log has its entry` : `✓ fingerprint unchanged in ${range}`);
  return 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) process.exit(main());
