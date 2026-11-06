/**
 * Tests for the safety check.
 *
 * Proves that:
 * 1. Valid test-trigger-* entries pass
 * 2. Invalid entries (without the prefix) fail
 * 3. The check runs without crashing on the repo as-is
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SAFETY_CHECK = join(ROOT, 'tools', 'check-safety.js');

function runCheck() {
  return new Promise((resolve) => {
    execFile('node', [SAFETY_CHECK], { cwd: ROOT }, (error, stdout, stderr) => {
      resolve({
        exitCode: error ? error.code : 0,
        stdout,
        stderr,
      });
    });
  });
}

describe('safety check', () => {
  it('passes on the current repository', async () => {
    const result = await runCheck();
    assert.equal(result.exitCode, 0, `Safety check failed:\n${result.stderr}`);
  });

  it('fails when fake-triggers.json contains an entry without test-trigger- prefix', async () => {
    const triggersPath = join(ROOT, 'mock-platform', 'fake-triggers.json');

    // Read original content
    const { readFile } = await import('node:fs/promises');
    let original;
    try {
      original = await readFile(triggersPath, 'utf-8');
    } catch {
      // File might not exist yet in early stages — create a minimal one
      original = null;
    }

    // Write a bad triggers file
    const badContent = JSON.stringify([
      { "term": "test-trigger-red", "severity": "high" },
      { "term": "bad-entry-without-prefix", "severity": "high" }
    ], null, 2);
    await writeFile(triggersPath, badContent, 'utf-8');

    try {
      const result = await runCheck();
      assert.notEqual(result.exitCode, 0, 'Safety check should have failed but passed');
      assert.ok(
        result.stderr.includes('bad-entry-without-prefix'),
        'Error output should mention the bad entry'
      );
    } finally {
      // Restore original
      if (original !== null) {
        await writeFile(triggersPath, original, 'utf-8');
      } else {
        await unlink(triggersPath);
      }
    }
  });
});
