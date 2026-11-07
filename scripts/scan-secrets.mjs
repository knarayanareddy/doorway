#!/usr/bin/env node
/**
 * Secret scan (security review item 4). Read-only.
 *
 *   node scripts/scan-secrets.mjs      exit 1 on any hit, with file and commit; never the secret itself
 *
 * Scans the files git would commit (tracked, plus untracked files that are not
 * gitignored) and the output of `git log --all -p`. Gitignored files such as
 * .keys/ are not scanned: they are not committed, and the dev key is there on
 * purpose. Only read-only git commands are run.
 *
 * Output shows the pattern, the location, and the first four characters of the
 * match with its length. The matched text is never printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PATTERNS = Object.freeze([
  { name: 'private key block', re: /BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY/ },
  { name: 'mk_ token', re: /mk_[A-Za-z0-9_-]{30,}/ },
  // Built from two parts so that this file does not match its own pattern.
  { name: 'live secret key', re: new RegExp('s' + 'k_live') },
  { name: 'AWS access key id', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub personal token (ghp_)', re: /ghp_[A-Za-z0-9]{30,}/ },
]);

/** The first four characters and the length. Never the whole match. */
export function previewOf(match) {
  return `${match.slice(0, 4)}… (${match.length} chars)`;
}

/** Findings in one piece of text, by line. `where` is the caller's label (file or commit). */
export function scanText(text, where = '') {
  const findings = [];
  const lines = String(text).split('\n');
  lines.forEach((line, i) => {
    for (const { name, re } of PATTERNS) {
      const m = re.exec(line);
      if (m) findings.push({ pattern: name, where: where ? `${where}:${i + 1}` : `line ${i + 1}`, preview: previewOf(m[0]) });
    }
  });
  return findings;
}

export function formatFinding(f) {
  return `  ✗ ${f.pattern} at ${f.where}: ${f.preview}`;
}

const git = (root, args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 1024 });

/** Working tree files that git would commit. Returns { findings, files }. */
export function scanWorkingTree(root) {
  const names = git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean);
  const findings = [];
  let files = 0;
  for (const name of names) {
    let buf;
    try { buf = fs.readFileSync(path.join(root, name)); } catch { continue; } // deleted but not yet committed
    if (buf.subarray(0, 8000).includes(0)) continue; // binary
    files++;
    findings.push(...scanText(buf.toString('utf8'), name));
  }
  return { findings, files };
}

/** Every added or removed line of `git log --all -p`. Returns { findings, commits }. */
export function scanHistory(root) {
  const out = git(root, ['log', '--all', '-p', '--no-color', '--no-ext-diff', '--format=commit %H']);
  const findings = [];
  let commit = '(none)';
  let file = '';
  let commits = 0;
  for (const line of out.split('\n')) {
    if (/^commit [0-9a-f]{40}$/.test(line)) { commit = line.slice(7, 15); file = ''; commits++; continue; }
    if (line.startsWith('diff --git ')) { file = line.split(' b/').pop(); continue; }
    for (const { name, re } of PATTERNS) {
      const m = re.exec(line);
      if (m) findings.push({ pattern: name, where: `commit ${commit} ${file || '(no file)'}`, preview: previewOf(m[0]) });
    }
  }
  return { findings, commits };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
  const tree = scanWorkingTree(root);
  const hist = scanHistory(root);
  const all = [...tree.findings, ...hist.findings];
  if (all.length) {
    console.error('\n✗ SECRET SCAN FAILED\n');
    all.forEach((f) => console.error(formatFinding(f)));
    console.error('\nRotate or revoke any real secret first. Do not paste it anywhere.');
    process.exit(1);
  }
  console.log(`✓ secret scan passed — ${tree.files} working-tree files and ${hist.commits} commits, no key or token patterns`);
}
