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
import { build, buildHeartbeat, buildReport, aggregateKey, deskSummary, deskByFormat, flagAnomalies, MAX_BODY_BYTES } from '../packages/core/src/counter.js';
import { edgeLabsFormats } from '../packages/doorway/src/labs.js';

const INSTALL_TTL_MS = 60_000;
const installCache = new Map();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
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

export async function getInstall(env, id) {
  const hit = installCache.get(id);
  if (hit && hit.until > Date.now()) return hit.row;
  const row = (await env.DB.prepare(
    `SELECT id, domain, verified_at, verify_token, desk_token_hash, daily_cap, rate_per_min FROM installs WHERE id = ?`
  ).bind(id).first()) || null;
  installCache.set(id, { row, until: Date.now() + INSTALL_TTL_MS });
  return row;
}
export const forgetInstall = (id) => installCache.delete(id);
export const __clearInstallCache = () => installCache.clear();

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
  const row = await env.DB.prepare(
    `INSERT INTO rate (k, kind, stamp, n) VALUES (?, 'm', ?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n`
  ).bind(`m:${install.id}:${minute}`, minute).first();
  if (row.n === 1) {
    const old = new Date(t.getTime() - 3 * 60_000).toISOString().slice(0, 16);
    await env.DB.prepare(`DELETE FROM rate WHERE kind = 'm' AND stamp < ?`).bind(old).run();
  }
  return row.n > install.rate_per_min;
}
async function dayCapReached(env, install) {
  const day = dayOf(now());
  const row = await env.DB.prepare(`SELECT n FROM rate WHERE k = ?`).bind(`d:${install.id}:${day}`).first();
  return (row?.n || 0) >= install.daily_cap;
}
async function countAccepted(env, install) {
  const day = dayOf(now());
  const row = await env.DB.prepare(
    `INSERT INTO rate (k, kind, stamp, n) VALUES (?, 'd', ?, 1) ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n`
  ).bind(`d:${install.id}:${day}`, day).first();
  if (row.n === 1) {
    const old = dayOf(new Date(Date.now() - 2 * 86_400_000));
    await env.DB.prepare(`DELETE FROM rate WHERE kind = 'd' AND stamp < ?`).bind(old).run();
  }
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
  if (await dayCapReached(env, install)) return json({ error: 'daily-cap' }, 429, { 'retry-after': '3600' });

  const day = dayOf(now());
  await env.DB.prepare(
    `INSERT INTO agg (install, variant, format, trigger, bucket, day, key, outcome, route, count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(key, day) DO UPDATE SET count = count + 1`
  ).bind(p.i, p.v, p.f, p.t, p.e, day, aggregateKey(p), p.o, p.r).run();
  await countAccepted(env, install);
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
  if (!install) return json({ ok: false, reason: 'unknown-install' }, 200, cors);
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
  const install = await authedInstall(request, env, id);
  if (!install) return json({ error: 'unauthorised' }, 401);
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
  const shapeRows = (await env.DB.prepare(
    `SELECT day, format, outcome, SUM(count) AS count FROM agg WHERE install = ? AND day >= ? GROUP BY day, format, outcome`
  ).bind(id, since).all()).results || [];
  const hb = await env.DB.prepare(`SELECT COALESCE(SUM(dropped),0) AS n FROM heartbeats WHERE install = ? AND day >= ?`).bind(id, since).first();
  const reports = (await env.DB.prepare(
    `SELECT reason, SUM(count) AS count FROM reports WHERE install = ? AND day >= ? GROUP BY reason`
  ).bind(id, since).all()).results || [];

  return json({
    label: headline.label,
    periodDays: days,
    summary: headline,
    days: dayList.map((d) => ({ day: d.day, exposures: d.total < K ? null : d.total, flagged: flaggedSet.has(d.day) })),
    byFormat: deskByFormat(shapeRows.filter((r) => !flaggedSet.has(r.day)), { k: K }),
    droppedEvents: hb?.n || 0,
    falsePositiveReports: reports.map((r) => (r.count < K ? { reason: r.reason, count: null, suppressed: true } : r)),
  });
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

  const token = install.verify_token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let found = false;
  try {
    const page = await fetch(`https://${install.domain}/`, { redirect: 'follow', headers: { accept: 'text/html' } });
    const html = (await page.text()).slice(0, 262_144);
    found = new RegExp(`<meta[^>]+name=["']doorway-verify["'][^>]+content=["']${token}["']`, 'i').test(html);
  } catch { /* fall through to DNS */ }
  if (!found) {
    try {
      const dns = await fetch(`https://cloudflare-dns.com/dns-query?name=_doorway.${install.domain}&type=TXT`, { headers: { accept: 'application/dns-json' } });
      const j = await dns.json();
      found = (j.Answer || []).some((a) => String(a.data || '').replace(/"/g, '').includes(install.verify_token));
    } catch { /* not found */ }
  }
  if (!found) return json({ ok: false, reason: 'token-not-found' }, 200);

  const at = now().toISOString();
  await env.DB.prepare(`UPDATE installs SET verified_at = ? WHERE id = ? AND verified_at IS NULL`).bind(at, id).run();
  forgetInstall(id);
  return json({ ok: true, verified_at: at });
}
