/**
 * POST /v1/c — the only write path in the system.
 *
 * Runs on Cloudflare Workers. Validates the eight-field contract, strips all
 * connection metadata, and writes a single aggregate row. It never logs, and
 * it never stores anything that could be joined back to a person.
 */
import { build, aggregateKey } from '../packages/core/src/counter.js';

// ALLOWED_ORIGIN matches any https origin by default. For production, this
// should be scoped to the platform's own origins (e.g. via a Workers env var).
// Origin allow-listing is a deployment concern (see U2 in the review).
const ALLOWED_ORIGIN = /^https?:\/\/([\w-]+\.)?(localhost|127\.0\.0\.1)(:\d+)?$|^https:\/\/[\w.-]+$/;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';

    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }), origin);

    if (request.method !== 'POST') return json({ error: 'method' }, 405, origin);

    // Origin check: only accept requests from known origins.
    if (!ALLOWED_ORIGIN.test(origin)) return json({ error: 'origin' }, 403, origin);

    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return json({ error: 'content-type' }, 415, origin);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'json' }, 400, origin); }

    const res = build(body);
    if (!res.ok) return json({ error: 'invalid payload', details: res.errors }, 400, origin);

    const p = res.payload;

    // Only verified installs may write. verified_at is set by DNS/meta verification.
    const install = await env.DB.prepare(
      `SELECT verified_at FROM installs WHERE id = ?`
    ).bind(p.i).first();
    if (!install || !install.verified_at) return json({ error: 'install' }, 403, origin);

    const key = aggregateKey(p);
    const hour = new Date().toISOString().slice(0, 13); // date+HOUR only

    // Increment an hourly aggregate. No row corresponds to a person.
    await env.DB.prepare(
      `INSERT INTO agg (install, variant, format, trigger, bucket, hour, key, outcome, route, count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(key, hour) DO UPDATE SET count = count + 1`
    ).bind(p.i, p.v, p.f, p.t, p.e, hour, key, p.o, p.r).run();

    // Deliberately no logging of the request, the IP, or the user agent.
    return cors(new Response(null, { status: 204 }), origin);
  },
};

function json(o, status, origin) {
  return cors(new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } }), origin);
}
function cors(r, origin) {
  if (ALLOWED_ORIGIN.test(origin || '')) r.headers.set('access-control-allow-origin', origin);
  r.headers.set('access-control-allow-methods', 'POST, OPTIONS');
  r.headers.set('access-control-allow-headers', 'content-type');
  r.headers.set('cache-control', 'no-store');
  return r;
}
