/**
 * The edge. Cloudflare Worker + D1.
 *
 *   GET  /v1/            the Door page (per-install CSP: frame-ancestors = the install's domain)
 *   GET  /v1/door.js     the Door bundle (static asset)
 *   GET  /v1/status      is this install usable? (installer diagnostics, no data)
 *   POST /v1/c           the only exposure write path — seven fields
 *   POST /v1/heartbeat   count of events a Door failed to send
 *   POST /v1/report      content-free false-positive report
 *   POST /v1/verify      one-shot domain verification (meta tag or DNS TXT)
 *   GET  /v1/agg         the Desk read model (bearer token, k-suppressed, labelled unauthenticated)
 *   GET  /desk           the Desk page (static)
 *
 * It never logs, and it never stores anything that could be joined back to a person.
 * Origin is a browser-enforced HINT, not authentication: the install id is public by
 * construction, so every write is also size-capped, rate-limited and anomaly-flagged,
 * and every number the Desk shows says it is self-reported.
 */
import { build, buildHeartbeat, buildReport, aggregateKey, deskSummary, deskByFormat, deskBreakdown, variantArm, TRIGGER_ORDER, ESCALATION_ORDER, flagAnomalies, MAX_BODY_BYTES } from '../packages/core/src/counter.js';
import { edgeLabsFormats } from '../packages/doorway/src/labs.js';

// Install rows are cached per isolate, and the cache is bounded. A VERIFIED row is kept for a minute. An unverified
// row is never served from the cache: a verify on any isolate must be seen at once, so it is read from D1 each time.
// A missing id is remembered for five seconds, in a small map of its own, so junk ids cannot push out real installs.
const INSTALL_TTL_MS = 60_000;
const MISS_TTL_MS = 5_000;
const VERIFIED_MAX = 500;
const MISS_MAX = 64;
const verifiedInstalls = new Map(); // id -> { row, until }, least recently used first
const missedInstalls = new Map();   // id -> until

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      // Until DOOR_ORIGIN is a real origin, nothing is written. edge/wrangler.toml ships a `.example` placeholder (RFC 2606, reserved).
      if (doorUnconfigured(env) && (request.method === 'POST' || (request.method === 'GET' && p === '/v1/status'))) {
        return json({ error: 'door origin not configured' }, 503, p === '/v1/status' ? { 'access-control-allow-origin': '*' } : {});
      }
      if (request.method === 'GET' && (p === '/v1/' || p === '/v1')) return door(url, env);
      if (request.method === 'GET' && p === '/v1/door.js') return asset(request, env, '/door.js');
      if (request.method === 'GET' && p === '/desk') return deskPage(request, env, '/desk.html', 'text/html; charset=utf-8');
      if (request.method === 'GET' && p === '/desk.js') return deskPage(request, env, '/desk.js', 'text/javascript; charset=utf-8');
      if (request.method === 'GET' && p === '/v1/status') return status(url, env);
      if (request.method === 'GET' && p === '/v1/agg') return agg(request, url, env);
      if (request.method === 'POST') {
        if (p === '/v1/c') return collect(request, env);
        if (p === '/v1/heartbeat') return heartbeat(request, env);
        if (p === '/v1/report') return report(request, env);
        if (p === '/v1/verify') return verify(request, env);
      }
      return json({ error: 'not-found' }, 404);
    } catch {
      // No error detail, no logging: a failure must not become a record.
      return json({ error: 'internal' }, 500);
    }
  },
};

/* ── helpers ─────────────────────────────────────────────────────────────── */

const now = () => new Date();
const dayOf = (d) => d.toISOString().slice(0, 10);

function json(o, status = 200, extra = {}) {
  return new Response(JSON.stringify(o), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra },
  });
}
const empty = (status = 204) => new Response(null, { status, headers: { 'cache-control': 'no-store' } });

/** Insert or refresh a cache entry, then evict the least recently used one if the map is over its bound. */
function remember(map, key, value, max) {
  map.delete(key);
  map.set(key, value);
  if (map.size > max) map.delete(map.keys().next().value);
}

export async function getInstall(env, id) {
  const t = Date.now();
  const hit = verifiedInstalls.get(id);
  if (hit && hit.until > t) { remember(verifiedInstalls, id, hit, VERIFIED_MAX); return hit.row; }
  const missUntil = missedInstalls.get(id);
  if (missUntil !== undefined && missUntil > t) return null;
  const row = (await env.DB.prepare(
    `SELECT id, domain, verified_at, verify_token, desk_token_hash, daily_cap, rate_per_min FROM installs WHERE id = ?`
  ).bind(id).first()) || null;
  if (row?.verified_at) remember(verifiedInstalls, id, { row, until: Date.now() + INSTALL_TTL_MS }, VERIFIED_MAX);
  else if (!row) remember(missedInstalls, id, Date.now() + MISS_TTL_MS, MISS_MAX);
  return row;
}
export function forgetInstall(id) { verifiedInstalls.delete(id); missedInstalls.delete(id); }
export function __clearInstallCache() { verifiedInstalls.clear(); missedInstalls.clear(); }
export const __installCacheSize = () => ({ verified: verifiedInstalls.size, missed: missedInstalls.size });

/** True when DOOR_ORIGIN is unset or is a `.example` host (the wrangler.toml placeholder). Writes are refused then. */
const doorUnconfigured = (env) => {
  try { return !env.DOOR_ORIGIN || new URL(env.DOOR_ORIGIN).hostname.endsWith('.example'); } catch { return true; }
};

/**
 * Writes are accepted only from the Door's own origin. Platforms never write
 * directly, so a foreign origin is rejected outright — no regex, no wildcard.
 */
const fromDoor = (request, env) => !!env.DOOR_ORIGIN && request.headers.get('origin') === env.DOOR_ORIGIN;

/** Read a JSON body of at most MAX_BODY_BYTES, before any database work. */
async function readJson(request) {
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return { err: json({ error: 'content-type' }, 415) };
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return { err: json({ error: 'too-large' }, 413) };
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) return { err: json({ error: 'too-large' }, 413) };
  try { return { body: JSON.parse(new TextDecoder().decode(buf)) }; } catch { return { err: json({ error: 'json' }, 400) }; }
}

/**
 * Per-install limiter. Minute rows count every attempt (cheap flood control) and
 * live only a couple of minutes; the daily row counts ACCEPTED events against the
 * install's cap.
 */
async function overMinuteLimit(env, install) {
  const t = now();
  const minute = t.toISOString().slice(0, 16);
  return (await minuteBump(env, `m:${install.id}:${minute}`, minute, t)) > install.rate_per_min;
}
/** Adds one to a per-minute counter and returns the new count. Minute rows are pruned as they are created. */
async function minuteBump(env, k, minute, t = now()) {
  const row = await env.DB.prepare(
    `INSERT INTO rate (k, kind, stamp, n) VALUES (?, 'm', ?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n`
  ).bind(k, minute).first();
  if (row.n === 1) {
    const old = new Date(t.getTime() - 3 * 60_000).toISOString().slice(0, 16);
    await env.DB.prepare(`DELETE FROM rate WHERE kind = 'm' AND stamp < ?`).bind(old).run();
  }
  return row.n;
}
async function minuteRead(env, k) {
  return (await env.DB.prepare(`SELECT n FROM rate WHERE k = ?`).bind(k).first())?.n || 0;
}
/**
 * Read-side limits (Desk and status). Keys start with their own letter (f:, r:, s:) so they
 * never share a counter with the write limiter's m: rows. Ids that do not exist all share one
 * bucket, so junk ids cannot grow the rate table.
 */
const UNKNOWN_BUCKET = 'unknown-install';
const DESK_FAILS_PER_MIN = 10;
const DESK_FAILS_PER_DAY = 100;
const DESK_READS_PER_MIN = 60;
const STATUS_PER_MIN = 120;
const minuteOf = (t) => t.toISOString().slice(0, 16);
/** 429 with seconds until the next minute, so a client can wait it out. */
const tooMany = (extra = {}) => json({ error: 'too many attempts' }, 429, { 'retry-after': String(60 - now().getUTCSeconds()), ...extra });
/**
 * Reserves one accepted event against the install's daily cap. The check and the increment are ONE statement:
 * the upsert only changes the row while it is below the cap, and RETURNING gives no row when it is not. Two
 * requests can therefore never both take the last slot, whatever their interleaving. A new day's row starts at 1.
 */
async function reserveDaily(env, install) {
  // 0 means disabled (R9), nullish means uncapped in older rows — treat as no cap.
  if (install.daily_cap === 0) return false;
  if (install.daily_cap == null) return true;
  if (!(install.daily_cap > 0)) return true;
  const day = dayOf(now());
  const row = await env.DB.prepare(
    `INSERT INTO rate (k, kind, stamp, n) VALUES (?, 'd', ?, 1)
     ON CONFLICT(k) DO UPDATE SET n = n + 1 WHERE rate.n < ?
     RETURNING n`
  ).bind(`d:${install.id}:${day}`, day, install.daily_cap).first();
  if (!row) return false;
  if (row.n === 1) {
    const old = dayOf(new Date(Date.now() - 2 * 86_400_000));
    await env.DB.prepare(`DELETE FROM rate WHERE kind = 'd' AND stamp < ?`).bind(old).run();
  }
  return true;
}

async function authedInstall(request, env, id) {
  const install = await getInstall(env, id);
  if (!install?.desk_token_hash) return null;
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
    .map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(digest, install.desk_token_hash) ? install : null;
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* ── handlers ────────────────────────────────────────────────────────────── */

async function collect(request, env) {
  if (!fromDoor(request, env)) return json({ error: 'origin' }, 403);
  const { body, err } = await readJson(request);
  if (err) return err;
  // LABS_FORMATS is unset in production, so reserved shapes (fork, wave) are rejected there.
  const res = build(body, { extraFormats: edgeLabsFormats(env) });
  if (!res.ok) return json({ error: 'invalid payload', details: res.errors }, 400);
  const p = res.payload;

  const install = await getInstall(env, p.i);
  if (!install || !install.verified_at) return json({ error: 'install' }, 403);
  if (await overMinuteLimit(env, install)) return json({ error: 'rate' }, 429, { 'retry-after': '60' });
  // Reserved before the write: if the write then fails, the slot stays used. That can only under-count, never overshoot.
  if (!(await reserveDaily(env, install))) return json({ error: 'daily-cap' }, 429, { 'retry-after': '3600' });

  const day = dayOf(now());
  await env.DB.prepare(
    `INSERT INTO agg (install, variant, format, trigger, bucket, day, key, outcome, route, count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(key, day) DO UPDATE SET count = count + 1`
  ).bind(p.i, p.v, p.f, p.t, p.e, day, aggregateKey(p), p.o, p.r).run();
  return empty();
}

async function heartbeat(request, env) {
  if (!fromDoor(request, env)) return json({ error: 'origin' }, 403);
  const { body, err } = await readJson(request);
  if (err) return err;
  const res = buildHeartbeat(body);
  if (!res.ok) return json({ error: 'invalid payload' }, 400);
  const { i, v, d } = res.payload;
  const install = await getInstall(env, i);
  if (!install || !install.verified_at) return json({ error: 'install' }, 403);
  if (await overMinuteLimit(env, install)) return json({ error: 'rate' }, 429, { 'retry-after': '60' });
  await env.DB.prepare(
    `INSERT INTO heartbeats (install, day, version, dropped) VALUES (?, ?, ?, ?)
     ON CONFLICT(install, day, version) DO UPDATE SET dropped = dropped + excluded.dropped`
  ).bind(i, dayOf(now()), v, d).run();
  return empty();
}

async function report(request, env) {
  const { body, err } = await readJson(request);
  if (err) return err;
  const res = buildReport(body);
  if (!res.ok) return json({ error: 'invalid payload' }, 400);
  const { i, p, t, r } = res.payload;
  const install = await getInstall(env, i);
  if (!install || !install.verified_at) return json({ error: 'install' }, 403);
  // Either the Door (a visitor) or the platform's admin (Desk bearer token).
  if (!fromDoor(request, env) && !(await authedInstall(request, env, i))) return json({ error: 'origin' }, 403);
  if (await overMinuteLimit(env, install)) return json({ error: 'rate' }, 429, { 'retry-after': '60' });
  await env.DB.prepare(
    `INSERT INTO reports (install, day, pack, trigger, reason, count) VALUES (?, ?, ?, ?, ?, 1)
     ON CONFLICT(install, day, pack, trigger, reason) DO UPDATE SET count = count + 1`
  ).bind(i, dayOf(now()), p, t, r).run();
  return empty();
}

async function status(url, env) {
  const id = url.searchParams.get('i') || '';
  const cors = { 'access-control-allow-origin': '*' };
  if (!/^inst_[a-z0-9]{6,}$/.test(id)) return json({ ok: false, reason: 'bad-install' }, 200, cors);
  const install = await getInstall(env, id);
  const minute = minuteOf(now());
  if ((await minuteBump(env, `s:${install ? id : UNKNOWN_BUCKET}:${minute}`, minute)) > STATUS_PER_MIN) return tooMany(cors);
  // 'unknown-install' and 'unverified' differ on purpose: the Door's loader prints a different fix for each (INSTALL.md section 6).
  if (!install) return json({ ok: false, reason: 'unknown-install' }, 200, cors);
  if (install.daily_cap === 0) return json({ ok: false, reason: 'disabled' }, 200, cors);
  if (!install.verified_at) return json({ ok: false, reason: 'unverified' }, 200, cors);
  return json({ ok: true }, 200, cors);
}

async function door(url, env) {
  const id = url.searchParams.get('i') || '';
  const install = /^inst_[a-z0-9]{6,}$/.test(id) ? await getInstall(env, id) : null;
  if (!install || !install.verified_at) {
    // No script, no content: a misconfigured install shows nothing and the
    // loader's timeout reports the fix in the installer's console.
    return new Response('<!doctype html><title>Doorway</title>', {
      status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'" },
    });
  }
  const scheme = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(install.domain) ? 'http' : 'https';
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'unsafe-inline'",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${scheme}://${install.domain}`,
  ].join('; ');
  return new Response(
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><title>Help</title></head><body style="margin:0;background:transparent">' +
    '<script src="/v1/door.js"></script></body></html>',
    { headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': csp,
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    } });
}

async function asset(request, env, path) {
  if (!env.ASSETS) return json({ error: 'no-assets' }, 500);
  const r = await env.ASSETS.fetch(new Request(new URL(path, request.url)));
  const h = new Headers(r.headers);
  h.set('x-content-type-options', 'nosniff');
  return new Response(r.body, { status: r.status, headers: h });
}

async function deskPage(request, env, path, type) {
  const r = await asset(request, env, path);
  const h = new Headers(r.headers);
  h.set('content-type', type);
  h.set('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  h.set('referrer-policy', 'no-referrer');
  h.set('cache-control', 'no-store');
  return new Response(r.body, { status: r.status, headers: h });
}

async function agg(request, url, env) {
  const id = url.searchParams.get('i') || '';
  const minute = minuteOf(now());
  const day = dayOf(now());
  const known = await getInstall(env, id);
  const failKey = `f:${known ? known.id : UNKNOWN_BUCKET}:${minute}`;
  const failDayKey = `f:${known ? known.id : UNKNOWN_BUCKET}:${day}`;
  // Check daily cap first (persisted across minutes) and minute cap.
  if ((await minuteRead(env, failDayKey)) >= DESK_FAILS_PER_DAY) return tooMany();
  if ((await minuteRead(env, failKey)) >= DESK_FAILS_PER_MIN) {
    // Allow a valid token to bypass the per-minute lockout so an attacker knowing the id cannot DoS the admin.
    const maybe = await authedInstall(request, env, id);
    if (maybe) {
      // authorised — fall through to the normal path (still counts as a read)
    } else {
      return tooMany();
    }
  }
  const install = await authedInstall(request, env, id);
  if (!install) {
    await minuteBump(env, failKey, minute);
    // Daily bucket counts failed attempts per day; prune old days lazily.
    {
      const row = await env.DB.prepare(`INSERT INTO rate (k, kind, stamp, n) VALUES (?, 'd', ?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n`).bind(failDayKey, day).first();
      if (row && row.n === 1) {
        const old = dayOf(new Date(Date.now() - 8 * 86_400_000));
        await env.DB.prepare(`DELETE FROM rate WHERE kind = 'd' AND stamp < ?`).bind(old).run();
      }
    }
    return json({ error: 'unauthorised' }, 401);
  }
  if ((await minuteBump(env, `r:${install.id}:${minute}`, minute)) > DESK_READS_PER_MIN) return tooMany();
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 30));
  const since = dayOf(new Date(Date.now() - (days - 1) * 86_400_000));

  const rows = (await env.DB.prepare(
    `SELECT day, outcome, SUM(count) AS count FROM agg WHERE install = ? AND day >= ? GROUP BY day, outcome ORDER BY day`
  ).bind(id, since).all()).results || [];

  const perDay = new Map();
  for (const r of rows) {
    const d = perDay.get(r.day) || { day: r.day, total: 0, clicked: 0 };
    d.total += r.count; if (r.outcome === 'clicked_help') d.clicked += r.count;
    perDay.set(r.day, d);
  }
  const dayList = [...perDay.values()];
  const flagged = flagAnomalies(dayList);
  const flaggedSet = new Set(flagged.map((f) => f.day));
  // Flagged days are shown and labelled, and left out of the headline rates.
  const headline = deskSummary(rows.filter((r) => !flaggedSet.has(r.day)), { flaggedDays: flagged });

  const K = headline.k;
  // Small days are hidden. The headline total counts every unflagged day, so one lone hidden day could be
  // recovered by subtraction; hide the smallest visible unflagged day too (same rule as the outcome cells).
  const hiddenDays = new Set(dayList.filter((d) => d.total < K).map((d) => d.day));
  const hiddenUnflagged = dayList.filter((d) => hiddenDays.has(d.day) && !flaggedSet.has(d.day));
  if (hiddenUnflagged.length === 1) {
    const next = dayList.filter((d) => !hiddenDays.has(d.day) && !flaggedSet.has(d.day)).sort((a, b) => a.total - b.total)[0];
    if (next) hiddenDays.add(next.day);
  }
  const shapeRows = (await env.DB.prepare(
    `SELECT day, format, outcome, SUM(count) AS count FROM agg WHERE install = ? AND day >= ? GROUP BY day, format, outcome`
  ).bind(id, since).all()).results || [];
  // One column per breakdown. The column names are fixed here, never taken from the request.
  const dimRows = async (col) => {
    if (!['trigger','route','bucket','variant'].includes(col)) throw new Error(`invalid column: ${col}`);
    return ((await env.DB.prepare(
      `SELECT day, "${col}" AS key, outcome, SUM(count) AS count FROM agg WHERE install = ? AND day >= ? GROUP BY day, "${col}", outcome`
    ).bind(id, since).all()).results || []).filter((r) => !flaggedSet.has(r.day));
  };
  const hb = await env.DB.prepare(`SELECT COALESCE(SUM(dropped),0) AS n FROM heartbeats WHERE install = ? AND day >= ?`).bind(id, since).first();
  const reports = (await env.DB.prepare(
    `SELECT reason, SUM(count) AS count FROM reports WHERE install = ? AND day >= ? GROUP BY reason`
  ).bind(id, since).all()).results || [];

  return json({
    label: headline.label,
    periodDays: days,
    summary: headline,
    days: dayList.map((d) => ({ day: d.day, exposures: hiddenDays.has(d.day) ? null : d.total, flagged: flaggedSet.has(d.day) })),
    byFormat: deskByFormat(shapeRows.filter((r) => !flaggedSet.has(r.day)), { k: K }),
    byTrigger: deskBreakdown(await dimRows('trigger'), { k: K, order: TRIGGER_ORDER }),
    byRoute: deskBreakdown(await dimRows('route'), { k: K }),
    byEscalation: deskBreakdown(await dimRows('bucket'), { k: K, order: ESCALATION_ORDER }),
    variantArms: deskBreakdown((await dimRows('variant')).map((r) => ({ ...r, key: variantArm(r.key) })), { k: K, order: ['control', 'other'] }),
    droppedEvents: hb?.n || 0,
    falsePositiveReports: reports.map((r) => (r.count < K ? { reason: r.reason, count: null, suppressed: true } : r)),
  });
}


/** Order-free, quote-style-free check that a <meta name="doorway-verify" content="TOKEN"> exists. */
function hasVerifyMeta(html, token) {
  const tags = html.match(/<meta\s[^>]*>/gi) || [];
  for (const tag of tags) {
    const attrs = {};
    for (const m of tag.matchAll(/(\w[\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`>]+))/gi)) {
      const name = m[1].toLowerCase();
      const value = m[2] ?? m[3] ?? m[4] ?? '';
      attrs[name] = value;
    }
    if ((attrs.name || '').toLowerCase() === 'doorway-verify' && attrs.content === token) return true;
  }
  return false;
}

async function verify(request, env) {
  const { body, err } = await readJson(request);
  if (err) return err;
  const id = body?.i;
  if (typeof id !== 'string' || !/^inst_[a-z0-9]{6,}$/.test(id)) return json({ error: 'invalid payload' }, 400);
  const install = await getInstall(env, id);
  if (!install || !install.verify_token) return json({ error: 'install' }, 404);
  if (install.verified_at) return json({ ok: true, verified_at: install.verified_at });
  if (await overMinuteLimit(env, { id: 'verify-' + id, rate_per_min: 5 })) return json({ error: 'rate' }, 429, { 'retry-after': '60' });

  let found = false;
  try {
    const page = await fetch(`https://${install.domain}/`, { redirect: 'manual', headers: { accept: 'text/html' } });
    if (page.status >= 300 && page.status < 400) {
      const loc = page.headers.get('location');
      if (loc) {
        try {
          const u = new URL(loc, `https://${install.domain}/`);
          if (u.hostname !== install.domain) found = false;
          else {
            const follow = await fetch(u.toString(), { redirect: 'manual', headers: { accept: 'text/html' } });
            if (follow.status >= 200 && follow.status < 300) {
              const html = (await follow.text()).slice(0, 262_144);
              found = hasVerifyMeta(html, install.verify_token);
            }
          }
        } catch { found = false; }
      }
    } else {
      const html = (await page.text()).slice(0, 262_144);
      found = hasVerifyMeta(html, install.verify_token);
    }
  } catch { /* fall through to DNS */ }
  if (!found) {
    try {
      const dns = await fetch(`https://cloudflare-dns.com/dns-query?name=_doorway.${install.domain}&type=TXT`, { headers: { accept: 'application/dns-json' } });
      const j = await dns.json();
      found = (j.Answer || []).some((a) => String(a.data || '').replace(/"/g, '').trim() === install.verify_token);
    } catch { /* not found */ }
  }
  if (!found) return json({ ok: false, reason: 'token-not-found' }, 200);

  const at = now().toISOString();
  await env.DB.prepare(`UPDATE installs SET verified_at = ? WHERE id = ? AND verified_at IS NULL`).bind(at, id).run();
  forgetInstall(id);
  return json({ ok: true, verified_at: at });
}
