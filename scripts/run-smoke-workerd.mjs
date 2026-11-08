#!/usr/bin/env node
/**
 * One command: build the Door, create a throwaway local D1 from edge/schema.sql, seed an
 * install, start `wrangler dev --local` (the real workerd runtime), run the smoke checks,
 * and tear it all down. Nothing is deployed and no Cloudflare account is needed.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = path.join(ROOT, 'edge');
const PORT = process.env.SMOKE_PORT || '8787';
const BASE = `http://127.0.0.1:${PORT}`;
const state = mkdtempSync(path.join(tmpdir(), 'doorway-d1-'));
const sh = (args, opts = {}) => spawnSync('npx', ['wrangler', ...args], { cwd: EDGE, encoding: 'utf8', ...opts });

let dev;
const done = (code) => { try { dev?.kill('SIGTERM'); } catch { /* already gone */ } rmSync(state, { recursive: true, force: true }); process.exit(code); };

const built = spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, DOOR_ORIGIN: BASE }, stdio: 'ignore' });
if (built.status !== 0) { console.error('build failed'); done(1); }

const hash = crypto.createHash('sha256').update('desk-demo-token').digest('hex');
for (const args of [
  ['d1', 'execute', 'doorway-agg', '--local', '--persist-to', state, '--file=schema.sql'],
  ['d1', 'execute', 'doorway-agg', '--local', '--persist-to', state, '--command',
    `INSERT INTO installs (id, domain, verified_at, verify_token, desk_token_hash, daily_cap, rate_per_min) VALUES ('inst_demo001','127.0.0.1:8789','2026-11-01T00:00:00Z','demo-token','${hash}',5000,30),('inst_unverif','127.0.0.1:8789',NULL,'tokp',NULL,5000,120)`],
]) {
  const r = sh(args);
  if (r.status !== 0) { console.error(r.stdout + r.stderr); done(1); }
}

dev = spawn('npx', ['wrangler', 'dev', '--local', '--port', PORT, '--persist-to', state, '--var', `DOOR_ORIGIN:${BASE}`], { cwd: EDGE, stdio: 'ignore' });
let up = false;
for (let i = 0; i < 90 && !up; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  up = await fetch(`${BASE}/v1/status?i=inst_demo001`).then((r) => r.ok).catch(() => false);
}
if (!up) { console.error('wrangler dev did not start'); done(1); }

const smoke = spawnSync('node', ['scripts/smoke-workerd.mjs'], { cwd: ROOT, env: { ...process.env, BASE }, stdio: 'inherit' });
done(smoke.status ?? 1);
