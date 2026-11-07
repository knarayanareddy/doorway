#!/usr/bin/env node
/** Prints the live status table. BUILD.md points here instead of carrying numbers that drift. */
import { spawnSync } from 'node:child_process';
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' });
const t = run('node', ['--test', 'packages/shared/core.test.js', 'packages/doorway/test/*.test.js', 'edge/test/*.test.js']);
const num = (k) => Number((t.stdout.match(new RegExp(`ℹ ${k} (\\d+)`)) || [])[1] || 0);
console.log(`unit + edge tests: ${num('pass')} passed, ${num('fail')} failed (of ${num('tests')})`);
for (const [name, args] of [['privacy tripwire', ['scripts/gate-privacy.mjs']], ['copy lint', ['scripts/lint-copy.mjs']], ['routes (honest, signed, valid)', ['scripts/check-routes.mjs']], ['docs', ['scripts/check-docs.mjs']], ['pilot readiness (expected to fail until outreach is done)', ['scripts/check-routes.mjs', '--pilot']]]) {
  console.log(`${run('node', args).status === 0 ? 'pass' : 'FAIL'}  ${name}`);
}
