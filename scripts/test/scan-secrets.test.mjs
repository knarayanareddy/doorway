import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { scanText, scanHistory, scanWorkingTree, formatFinding, previewOf } from '../scan-secrets.mjs';

// Fake secrets, assembled at runtime so this file contains no literal that matches the patterns.
const cat = (...parts) => parts.join('');
const FAKE = {
  'private key block': cat('-----BEGIN ', 'OPENSSH ', 'PRIVATE KEY-----'),
  'mk_ token': cat('mk', '_', 'a'.repeat(12), 'B'.repeat(20)),
  'live secret key': cat('s', 'k', '_live', '_', '0'.repeat(10)),
  'AWS access key id': cat('AKI', 'A', 'ABCDEFGHIJKLMNOP'),
  'GitHub personal token (ghp_)': cat('gh', 'p_', 'x'.repeat(36)),
};

test('each pattern hits its fake, with the line number', () => {
  for (const [name, fake] of Object.entries(FAKE)) {
    const hits = scanText(`first line\n${fake}\n`, 'a.js');
    assert.equal(hits.length, 1, name);
    assert.equal(hits[0].pattern, name);
    assert.equal(hits[0].where, 'a.js:2');
  }
});

test('ordinary text does not hit', () => {
  assert.deepEqual(scanText('const key = 0;\nmk_short\nAKIA-not-a-key\nsk-live-ish but no underscore\n', 'x'), []);
});

test('a finding never carries the secret, only four characters and the length', () => {
  for (const [name, fake] of Object.entries(FAKE)) {
    const [hit] = scanText(fake, 'f');
    const shown = formatFinding(hit);
    assert.ok(!shown.includes(fake), `${name} must not be printed`);
    assert.match(hit.preview, /^.{4}… \(\d+ chars\)$/, name);
  }
  assert.equal(scanText(FAKE['mk_ token'], 'f')[0].preview, 'mk_a… (35 chars)');
  assert.equal(previewOf('abcdefgh'), 'abcd… (8 chars)');
});

test('a real git repository: a secret in history is found, and its value is not in the output', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'doorway-scan-'));
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  git('init', '-q');
  const secret = FAKE['mk_ token'];
  fs.writeFileSync(path.join(repo, 'leak.txt'), `token=${secret}\n`);
  git('add', 'leak.txt');
  execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-qm', 'x']);
  fs.writeFileSync(path.join(repo, 'later.txt'), 'nothing here\n');
  git('add', 'later.txt');
  execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-qm', 'y']);
  // remove the secret from the tree but keep it in history
  fs.writeFileSync(path.join(repo, 'leak.txt'), 'clean\n');

  const hist = scanHistory(repo);
  assert.equal(hist.commits, 2);
  assert.equal(hist.findings.length, 1);
  assert.match(hist.findings[0].where, /leak\.txt$/);
  assert.equal(hist.findings[0].pattern, 'mk_ token');

  const tree = scanWorkingTree(repo);
  assert.equal(tree.findings.length, 0, 'the working tree copy was cleaned');
  assert.ok(tree.files >= 2);

  const printed = hist.findings.map(formatFinding).join('\n');
  assert.ok(!printed.includes(secret));
});
