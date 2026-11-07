#!/usr/bin/env node
/**
 * Smoke test against the REAL Workers runtime (workerd) with a local D1, i.e.
 * `wrangler dev --local`. It exists because the unit tests run the Worker on
 * node:sqlite, and "SQLite like D1" is not the same claim as "runs on D1".
 *
 *   cd edge && wrangler d1 execute doorway-agg --local --file=schema.sql
 *   (seed inst_demo001 — see BUILD.md)  &&  wrangler dev --local --port 8787 --var DOOR_ORIGIN:http://127.0.0.1:8787
 *   BASE=http://127.0.0.1:8787 node scripts/smoke-workerd.mjs
 *
 * It does NOT deploy anything and is not part of `npm run verify`.
 */
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const INSTALL = process.env.INSTALL || 'inst_demo001';
const TOKEN = process.env.DESK_TOKEN || 'desk-demo-token';
const EV = { i: INSTALL, v: 'legal-01', f: 'gate', t: 'search', o: 'clicked_help', r: 'nl-offlimits', e: '1' };

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : '  ' + detail}`); if (!ok) failed++; };
const post = (path, body, origin = BASE, extra = {}) => fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });

let r = await fetch(`${BASE}/v1/status?i=${INSTALL}`);
check('status: verified install', (await r.json()).ok === true);
check('status: unknown install', (await (await fetch(`${BASE}/v1/status?i=inst_nosuch1`)).json()).reason === 'unknown-install');

r = await fetch(`${BASE}/v1/?i=${INSTALL}`);
const csp = r.headers.get('content-security-policy') || '';
check('door page: 200 with per-install frame-ancestors and default-src none', r.status === 200 && /frame-ancestors http:\/\/127\.0\.0\.1:8789/.test(csp) && /default-src 'none'/.test(csp), csp);
check('door page: no referrer, no store', r.headers.get('referrer-policy') === 'no-referrer' && r.headers.get('cache-control') === 'no-store');
r = await fetch(`${BASE}/v1/door.js`);
check('door.js served from the ASSETS binding', r.status === 200 && (await r.text()).length > 10_000);
r = await fetch(`${BASE}/v1/?i=inst_unverif`);
check('unverified install: empty 403 door', r.status === 403 && !(await r.text()).includes('<script'));

check('write from a foreign origin: 403', (await post('/v1/c', EV, 'https://evil-site.example')).status === 403);
check('write with no Origin: 403', (await post('/v1/c', EV, null)).status === 403);
check('write with an eighth field: 400', (await post('/v1/c', { ...EV, b: 14 })).status === 400);
check('oversize body: 413', (await post('/v1/c', JSON.stringify({ ...EV, pad: 'x'.repeat(700) }))).status === 413);
check('valid write from the Door origin: 204 (D1 upsert)', (await post('/v1/c', EV)).status === 204);
check('same cell again: 204 (ON CONFLICT DO UPDATE)', (await post('/v1/c', EV)).status === 204);
check('heartbeat: 204', (await post('/v1/heartbeat', { i: INSTALL, v: '0.2.0', d: 3 })).status === 204);
check('report: 204', (await post('/v1/report', { i: INSTALL, p: '2026.11.07', t: 'search', r: 'other' })).status === 204);
check('report with free text: 400', (await post('/v1/report', { i: INSTALL, p: '2026.11.07', t: 'search', r: 'free text' })).status === 400);

r = await fetch(`${BASE}/v1/agg?i=${INSTALL}`);
check('desk without a token: 401', r.status === 401);
r = await fetch(`${BASE}/v1/agg?i=${INSTALL}`, { headers: { authorization: `Bearer ${TOKEN}` } });
const agg = await r.json().catch(() => ({}));
check('desk with the token: labelled, k-suppressed (2 events < k)', r.status === 200 && /unauthenticated/.test(agg.label || '') && agg.summary?.exposures === null, JSON.stringify(agg).slice(0, 200));
check('desk reports the dropped-events count', agg.droppedEvents === 3, String(agg.droppedEvents));

// limiter: the seeded install allows 30 attempts a minute; 2 + 1 + 1 + a few already used
let limited = 0;
for (let i = 0; i < 60; i++) if ((await post('/v1/c', { ...EV, o: 'dismissed' })).status === 429) limited++;
check('per-minute limiter engages on the real runtime', limited > 0, `limited=${limited}`);

r = await fetch(`${BASE}/desk`);
check('desk page: framing denied, same-origin only', r.status === 200 && /frame-ancestors 'none'/.test(r.headers.get('content-security-policy') || ''));

console.log(failed ? `\n${failed} check(s) failed` : '\nall smoke checks passed on workerd + local D1');
process.exit(failed ? 1 : 0);
