import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker, { __clearInstallCache } from '../c.js';
import { createDb, sha256hex } from './d1-shim.js';

const DOOR = 'https://door.test';
const GOOD = { i: 'inst_abc123', v: 'legal-01', f: 'gate', t: 'search', o: 'clicked_help', r: 'nl-offlimits', e: '1' };
let env;

async function setup(over = {}) {
  __clearInstallCache();
  const DB = createDb();
  const hash = await sha256hex('desk-secret');
  DB.raw.prepare(`INSERT INTO installs (id, domain, verified_at, verify_token, desk_token_hash, daily_cap, rate_per_min)
                  VALUES ('inst_abc123','platform.test','2026-11-01T00:00:00Z','tok123',?,?,?)`).run(hash, over.cap ?? 5000, over.rate ?? 120);
  DB.raw.prepare(`INSERT INTO installs (id, domain, verified_at, verify_token) VALUES ('inst_pending','pending.test',NULL,'tokp')`).run();
  env = { DB, DOOR_ORIGIN: DOOR, ASSETS: { fetch: async () => new Response('/*door*/', { headers: { 'content-type': 'text/javascript' } }) } };
}
beforeEach(() => setup());

const post = (path, body, { origin = DOOR, headers = {}, raw } = {}) =>
  worker.fetch(new Request('https://door.test' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), ...headers },
    body: raw ?? JSON.stringify(body),
  }), env);
const rows = (sql) => env.DB.raw.prepare(sql).all();

// ── B2: anyone on the internet can write to any install's counter ──────────
test('edge-foreign-origin: a foreign https origin is refused', async () => {
  const r = await post('/v1/c', GOOD, { origin: 'https://evil-site.example' });
  assert.equal(r.status, 403);
  assert.equal(rows('SELECT * FROM agg').length, 0);
});

test('a platform cannot write directly either — only the Door origin can', async () => {
  assert.equal((await post('/v1/c', GOOD, { origin: 'https://platform.test' })).status, 403);
  assert.equal((await post('/v1/c', GOOD, { origin: null })).status, 403, 'no Origin header at all');
});

test('the Door origin is matched exactly, with no wildcard or suffix tricks', async () => {
  for (const o of ['https://door.test.evil.example', 'http://door.test', 'https://sub.door.test', 'https://door.test:8443']) {
    assert.equal((await post('/v1/c', GOOD, { origin: o })).status, 403, o);
  }
});

test('a valid write from the Door is stored as a daily aggregate, with no hour', async () => {
  const r = await post('/v1/c', GOOD);
  assert.equal(r.status, 204);
  const [row] = rows('SELECT * FROM agg');
  assert.equal(row.count, 1);
  assert.match(row.day, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!('b' in row));
  await post('/v1/c', GOOD);
  assert.equal(rows('SELECT * FROM agg')[0].count, 2, 'the same cell increments');
});

test('edge-contract-width: seven fields are accepted, the old eighth is rejected', async () => {
  assert.equal((await post('/v1/c', { ...GOOD, b: 14 })).status, 400);
  const { i: _i, ...missing } = GOOD;
  assert.equal((await post('/v1/c', missing)).status, 400);
});

test('an oversized body is refused before any database read', async () => {
  env.DB.log.length = 0;
  const r = await post('/v1/c', null, { raw: JSON.stringify({ ...GOOD, pad: 'x'.repeat(600) }) });
  assert.equal(r.status, 413);
  assert.equal(env.DB.log.length, 0, 'no query ran');
  assert.equal((await post('/v1/c', null, { raw: 'not json' })).status, 400);
  assert.equal((await post('/v1/c', GOOD, { headers: { 'content-type': 'text/plain' } })).status, 415);
});

test('edge-flood: forged events are throttled per install', async () => {
  await setup({ rate: 20 });
  let accepted = 0, limited = 0;
  for (let i = 0; i < 70; i++) {
    const r = await post('/v1/c', { ...GOOD, o: 'clicked_help' });
    if (r.status === 204) accepted++; else if (r.status === 429) limited++;
  }
  assert.equal(accepted, 20);
  assert.equal(limited, 50);
  assert.equal(rows('SELECT SUM(count) n FROM agg')[0].n, 20, 'forged events beyond the limit never reach the aggregate');
});

test('a daily cap derived from the install bounds accepted events', async () => {
  await setup({ cap: 5 });
  const out = [];
  for (let i = 0; i < 8; i++) out.push((await post('/v1/c', GOOD)).status);
  assert.deepEqual(out, [204, 204, 204, 204, 204, 429, 429, 429]);
});

test('unknown and unverified installs cannot write', async () => {
  assert.equal((await post('/v1/c', { ...GOOD, i: 'inst_nothere1' })).status, 403);
  assert.equal((await post('/v1/c', { ...GOOD, i: 'inst_pending' })).status, 403);
});

test('minute rate rows are pruned so no per-minute history persists', async () => {
  env.DB.raw.prepare(`INSERT INTO rate (k, kind, stamp, n) VALUES ('m:inst_abc123:2020-01-01T00:00','m','2020-01-01T00:00',1)`).run();
  await post('/v1/c', GOOD);
  assert.equal(rows(`SELECT * FROM rate WHERE stamp = '2020-01-01T00:00'`).length, 0);
});

test('the edge sets no cookies and allows no cross-origin reads of writes', async () => {
  const r = await post('/v1/c', GOOD);
  assert.equal(r.headers.get('set-cookie'), null);
  assert.equal(r.headers.get('access-control-allow-origin'), null);
  assert.equal(r.headers.get('cache-control'), 'no-store');
});

// ── B6: heartbeat, report ──────────────────────────────────────────────────
test('heartbeat records a count and nothing else', async () => {
  assert.equal((await post('/v1/heartbeat', { i: 'inst_abc123', v: '0.2.0', d: 3 })).status, 204);
  await post('/v1/heartbeat', { i: 'inst_abc123', v: '0.2.0', d: 2 });
  assert.equal(rows('SELECT dropped FROM heartbeats')[0].dropped, 5);
  assert.equal((await post('/v1/heartbeat', { i: 'inst_abc123', v: '0.2.0', d: 3, q: 'x' })).status, 400);
});

// ── H4: false-positive report ──────────────────────────────────────────────
test('a report carries only install, pack, trigger type and a closed-list reason', async () => {
  const ok = { i: 'inst_abc123', p: '2026.11.07', t: 'search', r: 'journalist' };
  assert.equal((await post('/v1/report', ok)).status, 204);
  assert.equal((await post('/v1/report', { ...ok, r: 'free text about my search' })).status, 400);
  assert.equal((await post('/v1/report', { ...ok, q: 'query text' })).status, 400);
  assert.equal((await post('/v1/report', ok, { origin: 'https://evil-site.example' })).status, 403);
  const desk = await post('/v1/report', ok, { origin: null, headers: { authorization: 'Bearer desk-secret' } });
  assert.equal(desk.status, 204, 'the platform admin can report via the Desk token');
  assert.equal(rows('SELECT count FROM reports')[0].count, 2);
});

// ── B6: the Desk read model ────────────────────────────────────────────────
const seed = (day, outcome, count, route = 'nl-offlimits') =>
  env.DB.raw.prepare(`INSERT INTO agg (key, day, install, variant, format, trigger, bucket, outcome, route, count)
    VALUES (?, ?, 'inst_abc123', 'legal-01','gate','search','1', ?, ?, ?)`).run(`k|${day}|${outcome}|${route}`, day, outcome, route, count);
const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const desk = (q = '') => worker.fetch(new Request('https://door.test/v1/agg?i=inst_abc123' + q, { headers: { authorization: 'Bearer desk-secret' } }), env);

test('the Desk requires the install bearer token', async () => {
  const r = await worker.fetch(new Request('https://door.test/v1/agg?i=inst_abc123'), env);
  assert.equal(r.status, 401);
  const bad = await worker.fetch(new Request('https://door.test/v1/agg?i=inst_abc123', { headers: { authorization: 'Bearer nope' } }), env);
  assert.equal(bad.status, 401);
});

test('desk-denominator: click-through is over every exposure, left_page included', async () => {
  seed(yesterday(), 'clicked_help', 20); seed(yesterday(), 'dismissed', 40);
  seed(yesterday(), 'left_page', 30); seed(yesterday(), 'continued', 10);
  const j = await (await desk()).json();
  assert.equal(j.summary.exposures, 100);
  assert.equal(j.summary.clickThrough.shown, 100);
  assert.equal(j.summary.clickThrough.clicked, 20);
  assert.match(j.label, /unauthenticated/i);
});

test('desk: small cells are suppressed, with secondary suppression so they cannot be subtracted', async () => {
  seed(yesterday(), 'clicked_help', 3); seed(yesterday(), 'dismissed', 50); seed(yesterday(), 'left_page', 12);
  const j = await (await desk()).json();
  const cells = Object.fromEntries(j.summary.outcomes.map((c) => [c.outcome, c]));
  assert.equal(cells.clicked_help.suppressed, true);
  assert.equal(cells.left_page.suppressed, true, 'secondary suppression');
  assert.equal(j.summary.clickThrough.rate, null);
});

test('desk: an anomalous day is flagged, shown, and excluded from the headline', async () => {
  seed(yesterday(), 'dismissed', 80); seed(yesterday(), 'clicked_help', 10);
  seed(today(), 'clicked_help', 90); seed(today(), 'dismissed', 10);
  const j = await (await desk()).json();
  const flagged = j.days.find((d) => d.flagged);
  assert.equal(flagged.day, today());
  assert.equal(j.summary.exposures, 90, 'only the unflagged day is in the headline');
  assert.equal(j.summary.flaggedDays[0].reasons[0], 'click-through above 40%');
});

test('desk reports dropped events so undercounting is visible', async () => {
  await post('/v1/heartbeat', { i: 'inst_abc123', v: '0.2.0', d: 7 });
  assert.equal((await (await desk()).json()).droppedEvents, 7);
});

// ── M4: install verification and cache ─────────────────────────────────────
test('verify sets verified_at when the meta token is on the platform page', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(`<html><head><meta name="doorway-verify" content="tokp"></head></html>`);
  try {
    const r = await post('/v1/verify', { i: 'inst_pending' });
    assert.equal((await r.json()).ok, true);
    assert.ok(rows(`SELECT verified_at FROM installs WHERE id='inst_pending'`)[0].verified_at);
    assert.equal((await post('/v1/c', { ...GOOD, i: 'inst_pending' })).status, 204, 'writable immediately after verification');
  } finally { globalThis.fetch = real; }
});

test('verify refuses when the token is absent', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async (u) => String(u).includes('dns-query') ? new Response(JSON.stringify({ Answer: [] })) : new Response('<html></html>');
  try {
    const j = await (await post('/v1/verify', { i: 'inst_pending' })).json();
    assert.equal(j.ok, false);
    assert.equal(rows(`SELECT verified_at FROM installs WHERE id='inst_pending'`)[0].verified_at, null);
  } finally { globalThis.fetch = real; }
});

test('install lookups are cached for a minute', async () => {
  await post('/v1/c', GOOD);
  env.DB.log.length = 0;
  await post('/v1/c', GOOD);
  assert.equal(env.DB.log.filter((q) => /FROM installs/.test(q)).length, 0);
});

// ── B1/H3: the Door page and its CSP ───────────────────────────────────────
test('the Door page is only embeddable by the install\'s own domain, and cannot reach the network elsewhere', async () => {
  const r = await worker.fetch(new Request('https://door.test/v1/?i=inst_abc123'), env);
  assert.equal(r.status, 200);
  const csp = r.headers.get('content-security-policy');
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /frame-ancestors https:\/\/platform\.test(?:;|$)/);
  assert.match(csp, /script-src 'self'/);
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
});

test('an unknown or unverified install gets an empty 403 Door', async () => {
  for (const id of ['inst_nothere1', 'inst_pending', 'garbage']) {
    const r = await worker.fetch(new Request('https://door.test/v1/?i=' + id), env);
    assert.equal(r.status, 403, id);
    assert.doesNotMatch(await r.text(), /<script/);
  }
});

test('status tells an installer exactly what is wrong', async () => {
  const s = async (id) => (await worker.fetch(new Request('https://door.test/v1/status?i=' + id), env)).json();
  assert.deepEqual(await s('inst_abc123'), { ok: true });
  assert.equal((await s('inst_pending')).reason, 'unverified');
  assert.equal((await s('inst_nothere1')).reason, 'unknown-install');
  assert.equal((await s('bad')).reason, 'bad-install');
});

test('there is no endpoint that is not handled (H6): arrivals and trigger packs do not exist', async () => {
  for (const p of ['/v1/arrivals', '/v1/packs']) assert.equal((await post(p, {})).status, 404);
});

// ── labs: reserved shapes ──────────────────────────────────────────────────
const FORK = { ...GOOD, f: 'fork', v: 'harm-01', e: '2' };
const WAVE = { ...GOOD, f: 'wave', v: 'control-01', e: '3' };

test('labs: a production edge (no LABS_FORMATS) rejects fork and wave, so a labs Door cannot pollute the aggregates', async () => {
  for (const body of [FORK, WAVE]) {
    const r = await post('/v1/c', body);
    assert.equal(r.status, 400);
    assert.match(JSON.stringify(await r.json()), /invalid f/);
  }
  assert.equal(rows('SELECT * FROM agg').length, 0);
});

test('labs: an edge that names the formats accepts exactly those, and only those', async () => {
  env.LABS_FORMATS = 'fork';
  assert.equal((await post('/v1/c', FORK)).status, 204);
  assert.equal((await post('/v1/c', WAVE)).status, 400, 'wave was not named');
  assert.equal((await post('/v1/c', { ...GOOD, f: 'blur' })).status, 400, 'an arbitrary format is never accepted');
  env.LABS_FORMATS = 'fork,wave,quick-exit,card';
  assert.equal((await post('/v1/c', WAVE)).status, 204);
  assert.deepEqual(rows('SELECT format FROM agg ORDER BY format').map((r) => r.format), ['fork', 'wave']);
});

test('desk: per-shape table counts everyone, hides small cells, and leaves flagged days out', async () => {
  const add = (day, format, outcome, count) => env.DB.raw.prepare(`INSERT INTO agg (key, day, install, variant, format, trigger, bucket, outcome, route, count)
    VALUES (?, ?, 'inst_abc123', 'legal-01', ?, 'search', '1', ?, 'nl-offlimits', ?)`).run(`k|${day}|${format}|${outcome}`, day, format, outcome, count);
  const y = yesterday();
  add(y, 'gate', 'clicked_help', 15); add(y, 'gate', 'left_page', 60); add(y, 'gate', 'dismissed', 25);
  add(y, 'hallway', 'clicked_help', 22); add(y, 'hallway', 'continued', 78);
  add(y, 'fork', 'clicked_help', 1); add(y, 'fork', 'dismissed', 12);
  add(today(), 'gate', 'clicked_help', 90); add(today(), 'gate', 'dismissed', 10);
  const j = await (await desk()).json();
  const by = Object.fromEntries(j.byFormat.map((f) => [f.format, f]));
  assert.equal(by.gate.exposures, 100, 'the forged day is excluded, left_page is included');
  assert.equal(by.fork.clicked, null, 'a single help click is hidden');
  assert.equal(by.gate.clicked, null, 'and the smallest visible click count goes with it, so the fork cannot be derived from a total');
  assert.equal(by.hallway.clicked, 22);
  assert.equal(by.fork.rate, null);
  assert.match(j.label, /unauthenticated/);
  assert.deepEqual(j.byFormat.map((f) => f.format), ['gate', 'fork', 'hallway']);
});
