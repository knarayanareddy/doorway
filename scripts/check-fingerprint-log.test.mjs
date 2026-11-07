import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFingerprintLog, formatEntry, addedLines, FINGERPRINT, LOG } from './check-fingerprint-log.mjs';

const entry = formatEntry({ date: '2026-11-07', files: ['card.js'], reason: 'Hallway copy moved into card' });

test('no fingerprint change in the range: nothing to check', () => {
  assert.deepEqual(checkFingerprintLog({ changedFiles: ['packages/shared/card.js'], addedLogLines: [] }), []);
});

test('fingerprint changed without the log: fails', () => {
  const p = checkFingerprintLog({ changedFiles: [FINGERPRINT, 'packages/shared/card.js'], addedLogLines: [] });
  assert.equal(p.length, 1);
  assert.match(p[0], /did not/);
});

test('fingerprint and log changed, with a complete entry: passes', () => {
  const p = checkFingerprintLog({ changedFiles: [FINGERPRINT, LOG], addedLogLines: addedLines(`+++ b/${LOG}\n+${entry.split('\n').join('\n+')}`) });
  assert.deepEqual(p, []);
});

test('the log changed, but only a heading (no files, no reason): fails', () => {
  const p = checkFingerprintLog({ changedFiles: [FINGERPRINT, LOG], addedLogLines: ['## 2026-11-07'] });
  assert.equal(p.length, 1);
});

test('an empty reason is not a reason', () => {
  const p = checkFingerprintLog({ changedFiles: [FINGERPRINT, LOG], addedLogLines: ['## 2026-11-07', '- Files: card.js', '- Reason: '] });
  assert.equal(p.length, 1);
});

test('a log edit that is not an entry (a typo fix) does not satisfy the gate for a fingerprint change', () => {
  const p = checkFingerprintLog({ changedFiles: [FINGERPRINT, LOG], addedLogLines: ['- fix typo in header'] });
  assert.equal(p.length, 1);
});

test('the log changed without a fingerprint change: passes (the log may be edited on its own)', () => {
  assert.deepEqual(checkFingerprintLog({ changedFiles: [LOG], addedLogLines: ['some note'] }), []);
});

test('addedLines reads only the added lines of a unified diff', () => {
  const diff = '--- a/x\n+++ b/x\n@@ -1 +1,2 @@\n old\n+new one\n-removed\n+new two\n';
  assert.deepEqual(addedLines(diff), ['new one', 'new two']);
});

test('formatEntry produces the heading, files and reason the gate looks for', () => {
  assert.equal(entry, '## 2026-11-07\n- Files: card.js\n- Reason: Hallway copy moved into card\n');
});
