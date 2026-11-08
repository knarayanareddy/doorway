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
 *   npm run demo:labs   the same, with mock data seeded into the Desk and the labs shapes accepted by the edge
 *                       (open http://127.0.0.1:8789/mock-platform/labs.html)
 *   npm run demo:app    builds the prototype app, then the same as demo:labs
 *                       (open http://127.0.0.1:8789/app/; PROTO_DIST overrides prototype/dist)
 */
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import worker from '../edge/c.js';
import { createDb, sha256hex } from '../edge/test/d1-shim.js';
import { seedDemo } from './seed-demo.mjs';
import { appHandler, deskAggProxy } from './serve-demo.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOOR_PORT = Number(process.env.DOOR_PORT || 8788);
const PLATFORM_PORT = Number(process.env.PLATFORM_PORT || 8789);
const DOOR = `http://127.0.0.1:${DOOR_PORT}`;
export const DESK_TOKEN = 'desk-demo-token';

if (!process.env.SKIP_BUILD) {
  // DEMO_LABS=1: this local harness runs the e2e suite, which uses the demo-only labs (preview, advance). It is never shipped.
  const r = spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, DOOR_ORIGIN: DOOR, DEMO_LABS: '1' }, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status);
}

const DB = createDb();
const hash = await sha256hex(DESK_TOKEN);
const ins = DB.raw.prepare(`INSERT INTO installs (id, domain, verified_at, verify_token, desk_token_hash, daily_cap, rate_per_min) VALUES (?,?,?,?,?,?,?)`);
ins.run('inst_demo001', `127.0.0.1:${PLATFORM_PORT}`, '2026-11-01T00:00:00Z', 'demo-token', hash, 100000, 100000);
ins.run('inst_wp0001', '127.0.0.1:8790', '2026-11-01T00:00:00Z', 'wp-token', null, 100000, 100000); // the WordPress check (test/e2e/wordpress.spec.js)
ins.run('inst_unverif', `127.0.0.1:${PLATFORM_PORT}`, null, 'unverified-token', null, 5000, 120);
ins.run('inst_otherdom', 'example.org', '2026-11-01T00:00:00Z', 'other-token', null, 5000, 120);

if (process.env.SEED === '1') {
  const r = seedDemo(DB.raw, { install: 'inst_demo001', days: 30, labs: true });
  console.log(`seeded mock data: ${r.exposures} synthetic exposures over 30 days; anomaly days ${r.anomalyDays.join(', ')}`);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

function serveStatic(root) {
  return (req, res) => {
    const u = new URL(req.url, 'http://x');
    let p = path.normalize(decodeURIComponent(u.pathname));
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if ((file !== root && !file.startsWith(root + path.sep)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  };
}

// The labs formats (fork, wave) are accepted by THIS harness only. A production edge leaves LABS_FORMATS unset and rejects them.
const env = {
  DB, DOOR_ORIGIN: DOOR, LABS_FORMATS: 'fork,wave',
  ASSETS: { fetch: async (req) => {
    const file = path.join(ROOT, 'dist/door', new URL(req.url).pathname);
    return fs.existsSync(file) ? new Response(fs.readFileSync(file), { headers: { 'content-type': TYPES[path.extname(file)] || 'text/plain' } }) : new Response('nf', { status: 404 });
  } },
};

// The test endpoints are read and wiped by the Playwright request fixture (test/e2e/helpers.js), which is not a page, and
// they send no CORS header. Any request a browser page makes carries Sec-Fetch-Site, so those are refused: a page the
// developer happens to open cannot read the demo aggregates or wipe them.
const fromBrowserPage = (req) => req.headers['sec-fetch-site'] !== undefined && req.headers['sec-fetch-site'] !== 'none';
http.createServer(async (req, res) => {
  const url = new URL(req.url, DOOR);
  if (url.pathname === '/__test/db' || url.pathname === '/__test/reset') {
    if (fromBrowserPage(req)) { res.writeHead(403, { 'content-type': 'text/plain' }); res.end('not for browser pages'); return; }
  }
  if (url.pathname === '/__test/db') {
    const out = { agg: DB.raw.prepare('SELECT * FROM agg').all(), heartbeats: DB.raw.prepare('SELECT * FROM heartbeats').all(), reports: DB.raw.prepare('SELECT * FROM reports').all() };
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(out)); return;
  }
  if (url.pathname === '/__test/reset') { DB.raw.exec('DELETE FROM agg; DELETE FROM heartbeats; DELETE FROM reports; DELETE FROM rate;'); res.writeHead(204); res.end(); return; }
  // Browsers abort in-flight requests when a page unloads (that is the point of
  // keepalive); an aborted request must never take the server down.
  if (process.env.DEV_TRACE) console.log(new Date().toISOString().slice(17,23), req.method, url.pathname, req.headers['content-length'] || '');
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, body }), env);
    const headers = {}; r.headers.forEach((v, k) => { headers[k] = v; });
    res.writeHead(r.status, headers);
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { console.error('request error', req.method, url.pathname, e.code || e.message); res.destroy(); }
}).listen(DOOR_PORT, '127.0.0.1', () => console.log(`door/edge  ${DOOR}`));

// The built app is one file: PROTO_DIST/index.html if set, else prototype/dist/index.html.
const protoFile = path.join(process.env.PROTO_DIST ? path.resolve(process.env.PROTO_DIST) : path.join(ROOT, 'prototype/dist'), 'index.html');
const app = appHandler(protoFile);
const desk = deskAggProxy(DOOR);
const statics = serveStatic(ROOT);
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/__desk/agg') { desk(req, res, u); return; }
  if (u.pathname === '/app/' || u.pathname === '/app/index.html') { app(req, res); return; }
  statics(req, res);
}).listen(PLATFORM_PORT, '127.0.0.1', () => {
  console.log(`platform   http://127.0.0.1:${PLATFORM_PORT}/mock-platform/index.html`);
  console.log(`app        http://127.0.0.1:${PLATFORM_PORT}/app/${fs.existsSync(protoFile) ? '' : '   (not built: npm run build:prototype)'}`);
});
