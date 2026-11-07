import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import worker, { __clearInstallCache, __installCacheSize, getInstall } from '../c.js';
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

const dayAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

test('desk: one hidden small day cannot be recovered by subtracting the visible days from the total', async () => {
  seed(dayAgo(3), 'dismissed', 40); seed(dayAgo(2), 'dismissed', 25); seed(dayAgo(1), 'dismissed', 4);
  const j = await (await desk()).json();
  const unflagged = j.days.filter((d) => !d.flagged);
  const hidden = unflagged.filter((d) => d.exposures === null);
  assert.ok(hidden.length >= 2, 'a lone hidden day needs a second hidden day');
  const visibleSum = unflagged.reduce((a, d) => a + (d.exposures ?? 0), 0);
  const leaked = j.summary.exposures - visibleSum;
  assert.ok(leaked >= j.summary.k, 'what subtraction recovers is at least k, not the small day');
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

// ── Desk breakdowns: triggers, routes, escalation, wording arms ────────────
let seq = 0;
const put = (day, outcome, count, { format = 'gate', trigger = 'search', bucket = '1', route = 'nl-offlimits', variant = 'legal-01' } = {}) =>
  env.DB.raw.prepare(`INSERT INTO agg (key, day, install, variant, format, trigger, bucket, outcome, route, count)
    VALUES (?, ?, 'inst_abc123', ?, ?, ?, ?, ?, ?, ?)`).run(`b|${++seq}`, day, variant, format, trigger, bucket, outcome, route, count);

test('desk breakdowns: triggers are counted over every exposure, and a small trigger hides its neighbour too', async () => {
  const y = yesterday();
  put(y, 'clicked_help', 10, { trigger: 'search' }); put(y, 'dismissed', 30, { trigger: 'search' });
  put(y, 'continued', 20, { trigger: 'chat' }); put(y, 'clicked_help', 5, { trigger: 'chat' });
  put(y, 'left_page', 3, { trigger: 'nav' }); put(y, 'clicked_help', 1, { trigger: 'nav' });
  const j = await (await desk()).json();
  assert.deepEqual(j.byTrigger.map((t) => t.key), ['search', 'chat', 'nav']);
  assert.deepEqual(Object.keys(j.byTrigger[0]).sort(), ['clicked', 'exposures', 'key', 'rate', 'suppressed']);
  const t = Object.fromEntries(j.byTrigger.map((x) => [x.key, x]));
  assert.deepEqual(t.search, { key: 'search', exposures: 40, clicked: 10, rate: 0.25, suppressed: false });
  assert.equal(t.nav.exposures, null, 'under k');
  assert.equal(t.nav.clicked, null);
  assert.equal(t.chat.exposures, null, 'secondary: the smallest visible trigger goes with it, so nav cannot be subtracted');
  assert.equal(t.chat.clicked, null);
  assert.equal(t.chat.rate, null);
  assert.equal(t.chat.suppressed, true);
});

test('desk breakdowns: escalation is keyed 1 to 4 and 5+, and xx-none is returned as its own route key', async () => {
  const y = yesterday();
  put(y, 'dismissed', 60, { bucket: '1' }); put(y, 'continued', 30, { bucket: '2' });
  put(y, 'clicked_help', 2, { bucket: '3' }); put(y, 'clicked_help', 15, { bucket: '5+' });
  const j = await (await desk()).json();
  assert.deepEqual(j.byEscalation.map((e) => e.key), ['1', '2', '3', '5+']);
  const e = Object.fromEntries(j.byEscalation.map((x) => [x.key, x]));
  assert.equal(e['1'].exposures, 60);
  assert.equal(e['2'].exposures, 30);
  assert.equal(e['3'].exposures, null, 'a single click under k');
  assert.equal(e['5+'].exposures, null, 'the smallest visible step goes with it');
});

test('desk breakdowns: xx-none is returned as its own route key (the Desk words it as no route shown)', async () => {
  put(yesterday(), 'dismissed', 50, { route: 'nl-offlimits' }); put(yesterday(), 'clicked_help', 12, { route: 'xx-none' });
  const j = await (await desk()).json();
  assert.deepEqual(j.byRoute.map((r) => r.key), ['nl-offlimits', 'xx-none']);
  // nl-offlimits has no help clicks (hidden), so the smallest visible click cell goes too: xx-none's clicks are secondary-suppressed.
  assert.deepEqual(j.byRoute.find((r) => r.key === 'xx-none'), { key: 'xx-none', exposures: 12, clicked: null, rate: null, suppressed: true });
});

test('desk breakdowns: flagged days are left out of every breakdown, as they are left out of byFormat', async () => {
  put(yesterday(), 'dismissed', 60, { trigger: 'search', route: 'nl-offlimits', bucket: '1', variant: 'legal-01' });
  put(yesterday(), 'clicked_help', 10, { trigger: 'search', route: 'nl-offlimits', bucket: '1', variant: 'legal-01' });
  put(today(), 'clicked_help', 90, { trigger: 'nav', route: 'fi-redirection', bucket: '5+', variant: 'control-01' });
  put(today(), 'dismissed', 10, { trigger: 'nav', route: 'fi-redirection', bucket: '5+', variant: 'control-01' });
  const j = await (await desk()).json();
  assert.equal(j.summary.exposures, 70, 'headline already excludes the flagged day');
  assert.deepEqual(j.byTrigger.map((t) => t.key), ['search']);
  assert.deepEqual(j.byRoute.map((r) => r.key), ['nl-offlimits']);
  assert.deepEqual(j.byEscalation.map((e) => e.key), ['1']);
  assert.deepEqual(j.variantArms.map((a) => a.key), ['other']);
  assert.equal(j.byTrigger[0].exposures, 70);
});

test('desk breakdowns: control-family wording is its own arm, and a small arm hides the other too', async () => {
  const y = yesterday();
  put(y, 'dismissed', 80, { variant: 'legal-01' }); put(y, 'clicked_help', 8, { variant: 'legal-01' });
  put(y, 'clicked_help', 3, { variant: 'control-02', format: 'hallway', bucket: '3' });
  const j = await (await desk()).json();
  assert.deepEqual(j.variantArms.map((a) => a.key), ['control', 'other']);
  const a = Object.fromEntries(j.variantArms.map((x) => [x.key, x]));
  assert.equal(a.control.exposures, null, 'under k');
  assert.equal(a.control.clicked, null);
  assert.equal(a.other.exposures, null, 'secondary suppression: the other arm cannot be read back from the total');
  assert.equal(a.other.suppressed, true);
  assert.equal(j.summary.exposures, 91, 'the headline still counts every unflagged exposure');
});

// ── read-side limits: Desk token guessing and status enumeration ───────────
// The clock is fixed mid-minute so the limits are deterministic; mock.timers resets it after each test.
const MID = '2026-11-07T10:00:30Z';
const withClock = (fn) => async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse(MID) });
  try { await fn(); } finally { mock.timers.reset(); }
};
const deskWith = (token, id = 'inst_abc123') =>
  worker.fetch(new Request(`https://door.test/v1/agg?i=${id}`, { headers: { authorization: `Bearer ${token}` } }), env);
const statusOf = (id) => worker.fetch(new Request('https://door.test/v1/status?i=' + id), env);

// Install ids are public, so an attacker can send wrong tokens for any install. The failure counter throttles only
// those wrong requests; the correct token is checked first and is never refused by it (a lockout here would let
// anyone who knows an install id keep the moderator out).
test('desk: fifty wrong tokens in a minute get 401 then 429, and the right token in the same minute is still 200', withClock(async () => {
  const statuses = [];
  for (let i = 0; i < 50; i++) statuses.push((await deskWith('wrong' + i)).status);
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401), 'the first ten wrong tokens are plain 401s');
  assert.deepEqual([...new Set(statuses.slice(10))], [429], 'then every wrong token is 429');
  const blocked = await deskWith('wrong-again');
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { error: 'too many attempts' });
  assert.equal(blocked.headers.get('retry-after'), '30', 'seconds to the next minute');
  assert.equal((await desk()).status, 200, 'the moderator with the correct token is not locked out');
}));

test('desk: a missing token counts as a failure too, and the right token still passes once throttled', withClock(async () => {
  for (let i = 0; i < 10; i++) assert.equal((await worker.fetch(new Request('https://door.test/v1/agg?i=inst_abc123'), env)).status, 401);
  assert.equal((await worker.fetch(new Request('https://door.test/v1/agg?i=inst_abc123'), env)).status, 429);
  assert.equal((await desk()).status, 200);
}));

test('desk: the throttle ends with the minute, and the count starts again', withClock(async () => {
  for (let i = 0; i < 10; i++) await deskWith('wrong' + i);
  assert.equal((await deskWith('wrong-x')).status, 429);
  mock.timers.setTime(Date.parse('2026-11-07T10:01:00Z'));
  assert.equal((await deskWith('wrong-y')).status, 401, 'a new minute');
  for (let i = 0; i < 8; i++) await deskWith('wrong' + i);
  assert.equal((await deskWith('wrong-z')).status, 401, 'the earlier ten do not carry over; nine fails are under the limit');
}));

test('desk: failures on one install do not throttle another', withClock(async () => {
  env.DB.raw.prepare(`INSERT INTO installs (id, domain, verified_at, verify_token, desk_token_hash)
                      VALUES ('inst_other1','other.test','2026-11-01T00:00:00Z','tokx',?)`).run(await sha256hex('other-secret'));
  for (let i = 0; i < 10; i++) await deskWith('wrong' + i);
  assert.equal((await deskWith('wrong-x')).status, 429);
  assert.equal((await deskWith('other-secret', 'inst_other1')).status, 200);
  assert.equal((await deskWith('wrong-x', 'inst_other1')).status, 401, 'the other install has its own failure bucket');
}));

test('desk: 60 successful reads a minute, then the same 429 and Retry-After', withClock(async () => {
  for (let i = 0; i < 60; i++) assert.equal((await desk()).status, 200, `read ${i + 1}`);
  const r = await desk();
  assert.equal(r.status, 429);
  assert.equal(r.headers.get('retry-after'), '30');
  assert.deepEqual(await r.json(), { error: 'too many attempts' });
}));

test('desk: unknown install ids share one bucket, so the rate table does not grow per junk id', withClock(async () => {
  for (let i = 0; i < 10; i++) assert.equal((await deskWith('x', `inst_nope${i}xx`)).status, 401);
  assert.equal((await deskWith('x', 'inst_nope99xx')).status, 429, 'the eleventh junk id shares the bucket');
  for (let i = 0; i < 40; i++) await deskWith('x', `inst_more${i}xx`);
  assert.deepEqual(rows(`SELECT k FROM rate`).map((r) => r.k), ['f:unknown-install:2026-11-07T10:00']);
  assert.equal((await desk()).status, 200, 'real installs are not locked out by junk ids');
}));

test('desk and writes use separate counters: a Desk throttle does not block the Door, and the write limit is unchanged', withClock(async () => {
  await setup({ rate: 2 });
  for (let i = 0; i < 10; i++) await deskWith('wrong' + i);
  assert.equal((await deskWith('wrong-x')).status, 429);
  assert.equal((await desk()).status, 200, 'the Desk token still passes');
  assert.equal((await post('/v1/c', GOOD)).status, 204, 'writes still have their own budget');
  assert.equal((await post('/v1/c', GOOD)).status, 204);
  assert.equal((await post('/v1/c', GOOD)).status, 429, 'the write limit (2 a minute) is unchanged');
}));

test('desk and status bodies never carry the Desk token or its hash', async () => {
  const hash = await sha256hex('desk-secret');
  for (const r of [await deskWith('nope'), await desk(), await statusOf('inst_abc123'), await statusOf('inst_nope99xx')]) {
    const body = await r.text();
    assert.ok(!body.includes('desk-secret') && !body.includes(hash), `${r.status} body`);
  }
});

test('status: 120 a minute per install id, then 429 with Retry-After; ids that do not exist share one bucket', withClock(async () => {
  for (let i = 0; i < 120; i++) assert.equal((await statusOf('inst_abc123')).status, 200);
  const blocked = await statusOf('inst_abc123');
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), '30');
  assert.equal(blocked.headers.get('access-control-allow-origin'), '*', 'the installer can still read the refusal');
  for (let i = 0; i < 120; i++) assert.equal((await statusOf(`inst_junk${i}xx`)).status, 200);
  assert.equal((await statusOf('inst_junk999xx')).status, 429, 'junk ids share the unknown bucket');
  assert.deepEqual(rows(`SELECT k FROM rate WHERE k LIKE 's:%' ORDER BY k`).map((r) => r.k),
    ['s:inst_abc123:2026-11-07T10:00', 's:unknown-install:2026-11-07T10:00']);
}));

test('desk response: no key names an hour, a session, a user, a person or an address', async () => {
  put(yesterday(), 'clicked_help', 12); put(yesterday(), 'dismissed', 40, { trigger: 'chat', variant: 'control-01', format: 'door', bucket: '5+', route: 'xx-none' });
  put(today(), 'dismissed', 5);
  await post('/v1/heartbeat', { i: 'inst_abc123', v: '0.2.0', d: 2 });
  const body = await (await desk()).json();
  const keys = [];
  (function walk(v) {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) { keys.push(k); walk(v[k]); }
  })(body);
  assert.ok(keys.includes('byTrigger') && keys.includes('byRoute') && keys.includes('byEscalation') && keys.includes('variantArms'));
  assert.deepEqual(keys.filter((k) => /hour|session|user|person|ip/i.test(k)), []);
});

// ── the install cache: bounded, verified rows only, a short negative cache (uses the clock from above) ──
const installReads = () => env.DB.log.filter((q) => /FROM installs/.test(q)).length;

test('a verified install is served from the cache for one minute, then read again', withClock(async () => {
  await getInstall(env, 'inst_abc123');
  env.DB.log.length = 0;
  mock.timers.tick(59_000);
  await getInstall(env, 'inst_abc123');
  assert.equal(installReads(), 0, 'inside the minute');
  mock.timers.tick(2_000);
  await getInstall(env, 'inst_abc123');
  assert.equal(installReads(), 1, 'after the minute');
}));

test('an unverified install is never served from the cache: every lookup reads D1, so a verify is seen at once', async () => {
  assert.equal((await getInstall(env, 'inst_pending')).verified_at, null);
  assert.equal((await getInstall(env, 'inst_pending')).verified_at, null);
  assert.equal(installReads(), 2, 'both lookups read the row');
  env.DB.raw.prepare(`UPDATE installs SET verified_at = '2026-11-07T10:00:00Z' WHERE id = 'inst_pending'`).run(); // another isolate verifies
  assert.ok((await getInstall(env, 'inst_pending')).verified_at, 'the next lookup sees the verification');
  assert.equal(__installCacheSize().verified, 1, 'and now the verified row is cached');
});

test('a missing id is remembered for five seconds, then looked up again', withClock(async () => {
  assert.equal(await getInstall(env, 'inst_later1'), null);
  env.DB.raw.prepare(`INSERT INTO installs (id, domain, verified_at, verify_token) VALUES ('inst_later1','late.test','2026-11-01T00:00:00Z','tokl')`).run();
  env.DB.log.length = 0;
  mock.timers.tick(4_000);
  assert.equal(await getInstall(env, 'inst_later1'), null, 'the miss is still remembered');
  assert.equal(installReads(), 0);
  mock.timers.tick(2_000);
  assert.ok((await getInstall(env, 'inst_later1')).verified_at, 'read again after five seconds');
}));

test('the cache is bounded: junk ids cannot grow the miss map, and verified entries go oldest first', async () => {
  for (let i = 0; i < 200; i++) await getInstall(env, `inst_junk${i}xx`);
  assert.ok(__installCacheSize().missed <= 64, `missed=${__installCacheSize().missed}`);
  const ins = env.DB.raw.prepare(`INSERT INTO installs (id, domain, verified_at, verify_token) VALUES (?, 'many.test', '2026-11-01T00:00:00Z', 't')`);
  for (let i = 0; i < 600; i++) { ins.run(`inst_v${i}xx`); await getInstall(env, `inst_v${i}xx`); }
  assert.equal(__installCacheSize().verified, 500, 'the verified map stops at its bound');
  env.DB.log.length = 0;
  await getInstall(env, 'inst_v0xx');
  assert.equal(installReads(), 1, 'the oldest entry was evicted, so it is read again');
  env.DB.log.length = 0;
  await getInstall(env, 'inst_v599xx');
  assert.equal(installReads(), 0, 'the newest is still cached');
});

// ── the daily cap: check and increment are one statement, so concurrent writes cannot overshoot ──
test('the daily cap holds under concurrency: 20 writes at once against a cap of 5 accept exactly 5', async () => {
  await setup({ cap: 5, rate: 1000 });
  const statuses = (await Promise.all(Array.from({ length: 20 }, () => post('/v1/c', GOOD)))).map((r) => r.status);
  assert.equal(statuses.filter((s) => s === 204).length, 5, statuses.join(','));
  assert.equal(statuses.filter((s) => s === 429).length, 15);
  assert.equal(rows('SELECT SUM(count) n FROM agg')[0].n, 5, 'exactly the accepted events are aggregated');
  assert.equal(await (await post('/v1/c', GOOD)).status, 429, 'and the cap stays closed afterwards');
});

test('the daily cap is per install: a full install does not close another', async () => {
  await setup({ cap: 1, rate: 1000 });
  env.DB.raw.prepare(`INSERT INTO installs (id, domain, verified_at, verify_token, daily_cap, rate_per_min) VALUES ('inst_other2','two.test','2026-11-01T00:00:00Z','tok2',5,1000)`).run();
  assert.equal((await post('/v1/c', GOOD)).status, 204);
  assert.equal((await post('/v1/c', GOOD)).status, 429);
  assert.equal((await post('/v1/c', { ...GOOD, i: 'inst_other2' })).status, 204);
});

// ── the wrangler.toml placeholder: writes and status refuse until DOOR_ORIGIN is a real origin ──
test('the .example placeholder refuses every write with a 503 and a fixed body, and writes nothing', async () => {
  env.DOOR_ORIGIN = 'https://door.doorway.example';
  const origin = 'https://door.doorway.example';
  for (const [path, body] of [['/v1/c', GOOD], ['/v1/heartbeat', { i: 'inst_abc123', v: '0.2.0', d: 1 }], ['/v1/report', { i: 'inst_abc123', p: '2026.11.07', t: 'search', r: 'journalist' }], ['/v1/verify', { i: 'inst_pending' }]]) {
    const r = await post(path, body, { origin });
    assert.equal(r.status, 503, path);
    assert.deepEqual(await r.json(), { error: 'door origin not configured' }, path);
  }
  assert.equal(rows('SELECT * FROM agg').length, 0);
});

test('the placeholder answers /v1/status with the same message', async () => {
  env.DOOR_ORIGIN = 'https://door.doorway.example';
  const r = await statusOf('inst_abc123');
  assert.equal(r.status, 503);
  assert.deepEqual(await r.json(), { error: 'door origin not configured' });
});

test('a real origin is not refused for containing "example" as a label, and a missing DOOR_ORIGIN is refused', async () => {
  env.DOOR_ORIGIN = 'https://door.example.org';
  assert.equal((await post('/v1/c', GOOD, { origin: 'https://door.example.org' })).status, 204);
  env.DOOR_ORIGIN = undefined;
  assert.equal((await post('/v1/c', GOOD, { origin: 'https://door.example.org' })).status, 503);
});
