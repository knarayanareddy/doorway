#!/usr/bin/env node
/**
 * Local demo + e2e harness. Two real origins, like production:
 *
 *   platform  http://127.0.0.1:8789   the mock platform (and the hostile host page)
 *   door      http://127.0.0.1:8788   the REAL edge Worker (edge/c.js) on an in-memory SQLite "D1"
 *
 * The Worker, the schema and the Door bundle are the shipped ones; only the
 * database is node:sqlite instead of Cloudflare D1. Not for production.
 *
 *   npm run demo        build (door origin = :8788) and serve
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import worker from '../edge/c.js';
import { createDb, sha256hex } from '../edge/test/d1-shim.js';

const ROOT = new URL('..', import.meta.url).pathname;
const DOOR_PORT = Number(process.env.DOOR_PORT || 8788);
const PLATFORM_PORT = Number(process.env.PLATFORM_PORT || 8789);
const DOOR = `http://127.0.0.1:${DOOR_PORT}`;
export const DESK_TOKEN = 'desk-demo-token';

if (!process.env.SKIP_BUILD) {
  const r = spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, DOOR_ORIGIN: DOOR }, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);
}

const DB = createDb();
const hash = await sha256hex(DESK_TOKEN);
const ins = DB.raw.prepare(`INSERT INTO installs (id, domain, verified_at, verify_token, desk_token_hash, daily_cap, rate_per_min) VALUES (?,?,?,?,?,?,?)`);
ins.run('inst_demo001', `127.0.0.1:${PLATFORM_PORT}`, '2026-11-01T00:00:00Z', 'demo-token', hash, 100000, 100000);
ins.run('inst_unverif', `127.0.0.1:${PLATFORM_PORT}`, null, 'unverified-token', null, 5000, 120);
ins.run('inst_otherdom', 'example.org', '2026-11-01T00:00:00Z', 'other-token', null, 5000, 120);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

function serveStatic(root) {
  return (req, res) => {
    const u = new URL(req.url, 'http://x');
    let p = path.normalize(decodeURIComponent(u.pathname));
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  };
}

const env = {
  DB, DOOR_ORIGIN: DOOR,
  ASSETS: { fetch: async (req) => {
    const file = path.join(ROOT, 'dist/door', new URL(req.url).pathname);
    return fs.existsSync(file) ? new Response(fs.readFileSync(file), { headers: { 'content-type': TYPES[path.extname(file)] || 'text/plain' } }) : new Response('nf', { status: 404 });
  } },
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, DOOR);
  if (url.pathname === '/__test/db') {
    const out = { agg: DB.raw.prepare('SELECT * FROM agg').all(), heartbeats: DB.raw.prepare('SELECT * FROM heartbeats').all(), reports: DB.raw.prepare('SELECT * FROM reports').all() };
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(out)); return;
  }
  if (url.pathname === '/__test/reset') { DB.raw.exec('DELETE FROM agg; DELETE FROM heartbeats; DELETE FROM reports; DELETE FROM rate;'); res.writeHead(204, { 'access-control-allow-origin': '*' }); res.end(); return; }
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, body }), env);
  const headers = {}; r.headers.forEach((v, k) => { headers[k] = v; });
  res.writeHead(r.status, headers);
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(DOOR_PORT, '127.0.0.1', () => console.log(`door/edge  ${DOOR}`));

http.createServer(serveStatic(ROOT)).listen(PLATFORM_PORT, '127.0.0.1', () => console.log(`platform   http://127.0.0.1:${PLATFORM_PORT}/mock-platform/index.html`));
