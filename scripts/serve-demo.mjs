#!/usr/bin/env node
/**
 * The demo harness as a hosted service (one role per process).
 *
 * The Door must live on a different ORIGIN from the platform page: that is the whole point of the
 * sandboxed iframe. So a hosted demo is two deployments of this same image:
 *
 *   ROLE=door      the real edge Worker (edge/c.js) on an in-memory SQLite "D1": the Door page, its bundle,
 *                  the counter, and the Desk, seeded with synthetic data. Serves /health.
 *   ROLE=platform  the mock forum (mock-platform/) and the built loader. A page that plays the platform.
 *
 * Configuration, all from the environment:
 *   ROLE             door | platform                                  (required)
 *   DOOR_ORIGIN      https://<door-deployment>                         (required, no path)
 *   PLATFORM_ORIGIN  https://<platform-deployment>                     (required, no path)
 *   PORT             port to bind on 0.0.0.0                          (default 8080; Maritime injects it)
 *   LABS_FORMATS     labs formats the edge accepts                    (default fork,wave: this is a demo)
 *   DESK_TOKEN       the demo Desk's bearer token                     (default desk-demo-token: it is public)
 *                    The process refuses to start if DOOR_ORIGIN or PLATFORM_ORIGIN is plain http and not localhost,
 *                    and DESK_TOKEN is still the public default, unless I_UNDERSTAND_THIS_IS_A_PUBLIC_DEMO=1.
 *   I_UNDERSTAND_THIS_IS_A_PUBLIC_DEMO  1 to accept a public Desk with the public token (see above)
 *   SEED             0 to skip the synthetic data                     (default seeded)
 *   DIST_DIR         where this process builds its bundles            (default ./dist; give each process its own
 *                    directory if two run from one checkout)
 *   DOOR_INTERNAL_URL  where the platform process reaches the Door for the Desk proxy, e.g. http://127.0.0.1:3001
 *                    (optional; default DOOR_ORIGIN. A sandbox often cannot reach its own public URL)
 *   PROTO_DIST       directory holding the built app (default ./prototype/dist); platform role serves its index.html at /app/
 *
 * Platform role also answers GET /__desk/agg: a same-origin pass-through to the Door's /v1/agg (query and
 * Authorization only), so the app needs no CORS on the production edge.
 *
 * Deliberately NOT here, unlike scripts/dev.mjs: the /__test/db and /__test/reset endpoints and a static
 * server over the whole repository. This one is meant to be reachable by anyone.
 *
 * Everything in it is mock data. Do not point real visitors at it.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml' };

export function readConfig(env = process.env) {
  const problems = [];
  const origin = (name) => {
    const v = (env[name] || '').trim().replace(/\/$/, '');
    if (!v) { problems.push(`${name} is required`); return null; }
    try {
      const u = new URL(v);
      if (!/^https?:$/.test(u.protocol) || u.pathname !== '/' || u.search || u.hash || u.username || u.password) throw new Error();
      return u.origin;
    } catch { problems.push(`${name} must be an origin like https://example.org, with no path (got "${v}")`); return null; }
  };
  const role = env.ROLE;
  if (role !== 'door' && role !== 'platform') problems.push('ROLE must be "door" or "platform"');
  const doorOrigin = origin('DOOR_ORIGIN');
  const platformOrigin = origin('PLATFORM_ORIGIN');
  if (doorOrigin && platformOrigin && doorOrigin === platformOrigin) problems.push('DOOR_ORIGIN and PLATFORM_ORIGIN must differ: the Door is only isolated from the page if it is a different origin');
  // The demo Desk token is public (it is in this file and in the docs). It is acceptable on a local origin, or on an https
  // origin that is deliberately public. On a plain-http origin that is not local, anyone can open the Desk: refuse, unless
  // the operator says in so many words that this is a public demo.
  const deskToken = env.DESK_TOKEN || PUBLIC_DEMO_TOKEN;
  const exposed = [['DOOR_ORIGIN', doorOrigin], ['PLATFORM_ORIGIN', platformOrigin]].filter(([, o]) => o && !o.startsWith('https:') && !isLocal(o)).map(([n]) => n);
  if (exposed.length && deskToken === PUBLIC_DEMO_TOKEN && env.I_UNDERSTAND_THIS_IS_A_PUBLIC_DEMO !== '1') {
    problems.push(`${exposed.join(' and ')} ${exposed.length > 1 ? 'are' : 'is'} not https and not localhost, and DESK_TOKEN is the public demo token. Set DESK_TOKEN to your own secret, or set I_UNDERSTAND_THIS_IS_A_PUBLIC_DEMO=1 if this really is a public demo.`);
  }
  const port = Number(env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push('PORT must be a port number');
  // null unless DIST_DIR is given: the handlers then use <root>/dist, and a test can hand them a temporary root.
  const distDir = env.DIST_DIR ? path.resolve(env.DIST_DIR) : null;
  const protoDist = env.PROTO_DIST ? path.resolve(env.PROTO_DIST) : null;
  let doorInternal = null;
  if (env.DOOR_INTERNAL_URL) {
    try {
      const u = new URL(env.DOOR_INTERNAL_URL.trim().replace(/\/$/, ''));
      if (!/^https?:$/.test(u.protocol) || u.pathname !== '/' || u.search || u.hash || u.username || u.password) throw new Error();
      doorInternal = u.origin;
    } catch { problems.push(`DOOR_INTERNAL_URL must be an origin like http://127.0.0.1:3001, with no path (got "${env.DOOR_INTERNAL_URL}")`); }
  }
  return { problems, role, doorOrigin, doorInternal, platformOrigin, port, distDir, protoDist, labsFormats: env.LABS_FORMATS ?? 'fork,wave', deskToken, seed: env.SEED !== '0' };
}

const PUBLIC_DEMO_TOKEN = 'desk-demo-token';
/** A loopback origin: the local harness and the tests. Anything else is reachable by other people. */
const isLocal = (origin) => /^(127\.0\.0\.1|localhost)$/.test(new URL(origin).hostname);

const security = { 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex', 'cache-control': 'no-store' };
// The loader is a public, static script that other sites include with integrity + crossorigin="anonymous".
// A browser then fetches it with CORS, so whoever serves it MUST send this header or the script is blocked
// (found when installing it in a real Discourse). Only the loader gets it, never the forum pages.
const loaderHeaders = { 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' };

/** The built app's one file: PROTO_DIST/index.html, or prototype/dist/index.html under the root. */
export function appFile(cfg, root = ROOT) {
  return path.join(cfg.protoDist || path.join(root, 'prototype', 'dist'), 'index.html');
}

/** The one start-up line for a platform whose app is not built (the server keeps going); null when it is built. */
export function appNotBuiltWarning(file) {
  const built = fs.existsSync(file) && fs.statSync(file).isFile();
  return built ? null : 'app not built: /app/ will answer 404; run npm run build:prototype';
}

/** The built app: one static file, GET and HEAD only. Nothing else beside it is served. */
export function appHandler(file) {
  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, security); res.end(); return; }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', ...security }); res.end('app not built: run npm run build:prototype'); return;
    }
    res.writeHead(200, { 'content-type': TYPES['.html'], ...security });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  };
}

/**
 * GET /__desk/agg on the platform origin: forwards the query string and the Authorization header to the Door's
 * /v1/agg, and returns only its status, content-type and body. No cookies, no other headers either way.
 */
export function deskAggProxy(doorOrigin) {
  return async (req, res, u) => {
    if (req.method !== 'GET') { res.writeHead(405, { allow: 'GET', ...security }); res.end(); return; }
    const headers = req.headers?.authorization ? { authorization: req.headers.authorization } : {};
    try {
      const door = await fetch(new URL('/v1/agg' + u.search, doorOrigin), { headers, redirect: 'manual' });
      const body = Buffer.from(await door.arrayBuffer());
      const type = door.headers.get('content-type');
      res.writeHead(door.status, { ...(type ? { 'content-type': type } : {}), ...security });
      res.end(body);
    } catch {
      res.writeHead(502, { 'content-type': 'application/json', ...security }); res.end(JSON.stringify({ error: 'door unreachable' }));
    }
  };
}

/** Platform role: only the mock forum, the built loader and the built app, with the Door's origin substituted into pages. */
export function platformHandler(cfg, root = ROOT) {
  const distDir = cfg.distDir || path.join(root, 'dist');
  const allowed = [path.join(root, 'mock-platform'), path.join(distDir, 'latest')];
  const app = appHandler(appFile(cfg, root));
  const desk = deskAggProxy(cfg.doorInternal || cfg.doorOrigin);
  return (req, res) => {
    const u = new URL(req.url, cfg.platformOrigin);
    if (u.pathname === '/health') { res.writeHead(200, { 'content-type': 'text/plain', ...security }); res.end('ok'); return; }
    if (u.pathname === '/__desk/agg') { desk(req, res, u); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, security); res.end(); return; }
    if (u.pathname === '/') { res.writeHead(302, { location: '/app/', ...security }); res.end(); return; }
    if (u.pathname === '/app/' || u.pathname === '/app/index.html') { app(req, res); return; }
    let file;
    try {
      const p = decodeURIComponent(u.pathname);
      // /dist/latest/... is served from this deployment's own build output.
      file = path.normalize(p.startsWith('/dist/latest/') ? path.join(distDir, p.slice('/dist/'.length)) : path.join(root, p));
    } catch { res.writeHead(400, security); res.end(); return; }
    const ok = allowed.some((d) => file.startsWith(d + path.sep)) && fs.existsSync(file) && fs.statSync(file).isFile();
    if (!ok) { res.writeHead(404, security); res.end('not found'); return; }
    const type = TYPES[path.extname(file)] || 'application/octet-stream';
    if (path.extname(file) === '.html') {
      // The pages were written for the local harness; point their links at this deployment's Door.
      const body = fs.readFileSync(file, 'utf8').replaceAll('http://127.0.0.1:8788', cfg.doorOrigin);
      res.writeHead(200, { 'content-type': type, ...security }); res.end(req.method === 'HEAD' ? undefined : body); return;
    }
    const isLoader = file.startsWith(path.join(distDir, 'latest') + path.sep);
    res.writeHead(200, { 'content-type': type, ...security, ...(isLoader ? loaderHeaders : {}) });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  };
}

/** Door role: the real edge Worker on an in-memory database. */
export async function doorHandler(cfg, root = ROOT) {
  const distDir = cfg.distDir || path.join(root, 'dist');
  const { default: worker } = await import('../edge/c.js');
  const { createDb, sha256hex } = await import('../edge/test/d1-shim.js');
  const DB = createDb();
  const host = new URL(cfg.platformOrigin).host;
  DB.raw.prepare(`INSERT INTO installs (id, domain, verified_at, verify_token, desk_token_hash, daily_cap, rate_per_min) VALUES (?,?,?,?,?,?,?)`)
    .run('inst_demo001', host, '2026-11-01T00:00:00Z', 'demo-token', await sha256hex(cfg.deskToken), 20000, 600);
  if (cfg.seed) {
    const { seedDemo } = await import('./seed-demo.mjs');
    const r = seedDemo(DB.raw, { install: 'inst_demo001', days: 30, labs: true });
    console.log(`seeded ${r.exposures} synthetic exposures`);
  }
  const env = {
    DB, DOOR_ORIGIN: cfg.doorOrigin, LABS_FORMATS: cfg.labsFormats,
    ASSETS: { fetch: async (req) => {
      const file = path.join(distDir, 'door', new URL(req.url).pathname);
      return fs.existsSync(file) ? new Response(fs.readFileSync(file), { headers: { 'content-type': TYPES[path.extname(file)] || 'text/plain' } }) : new Response('nf', { status: 404 });
    } },
  };
  return async (req, res) => {
    const url = new URL(req.url, cfg.doorOrigin);
    if (url.pathname === '/health') { res.writeHead(200, { 'content-type': 'text/plain', ...security }); res.end('ok'); return; }
    if (url.pathname === '/') { res.writeHead(302, { location: `${cfg.platformOrigin}/mock-platform/labs.html`, ...security }); res.end(); return; }
    try {
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const r = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, body }), env);
      const headers = {}; r.headers.forEach((v, k) => { headers[k] = v; });
      res.writeHead(r.status, headers);
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      // Browsers abort in-flight requests when a page unloads; that must never take the server down.
      console.error('request error', req.method, url.pathname, e.code || e.message);
      res.destroy();
    }
  };
}

export function build(cfg) {
  const r = spawnSync('node', ['scripts/build.mjs'], { cwd: ROOT, env: { ...process.env, DEMO_ROUTES: '1', DOOR_ORIGIN: cfg.doorOrigin, ...(cfg.distDir ? { DIST_DIR: cfg.distDir } : {}) }, stdio: 'inherit' });
  if (r.status !== 0) throw new Error('build failed');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const cfg = readConfig();
  if (cfg.problems.length) { console.error('serve-demo: configuration problems:\n  - ' + cfg.problems.join('\n  - ')); process.exit(2); }
  // The loader bakes the Door's origin in at build time. Building at start-up means one image serves any deployment.
  build(cfg);
  // Only the platform role serves the app. A missing app is a warning, not a failure: the rest still works.
  const warning = cfg.role === 'platform' ? appNotBuiltWarning(appFile(cfg)) : null;
  if (warning) console.warn(warning);
  const handler = cfg.role === 'door' ? await doorHandler(cfg) : platformHandler(cfg);
  http.createServer(handler).listen(cfg.port, '0.0.0.0', () => console.log(`serve-demo role=${cfg.role} port=${cfg.port} door=${cfg.doorOrigin} platform=${cfg.platformOrigin}`));
}
