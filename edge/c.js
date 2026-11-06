/**
 * POST /v1/c — the only write path in the system.
 *
 * Runs on Cloudflare Workers. Validates the eight-field contract, strips all
 * connection metadata, and writes a single aggregate row. It never logs, and
 * it never stores anything that could be joined back to a person.
 */
import { build, aggregateKey } from '../packages/core/src/counter.js';

const ALLOWED_ORIGIN = /^https?:\/\/([\w-]+\.)?(localhost|127\.0\.0\.1)(:\d+)?$|^https:\/\/[\w.-]+$/;

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));

    if (request.method !== 'POST') return json({ error: 'method' }, 405);

    // We do not require an origin header, and we do not store it.
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return json({ error: 'content-type' }, 415);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'json' }, 400); }

    const res = build(body);
    if (!res.ok) return json({ error: 'invalid payload', details: res.errors }, 400);

    const p = res.payload;
    const key = aggregateKey(p);
    const hour = new Date().toISOString().slice(0, 13); // date+HOUR only

    // Increment an hourly aggregate. No row corresponds to a person.
    await env.DB.prepare(
      `INSERT INTO agg (install, variant, format, trigger, bucket, hour, key, count)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(key, hour) DO UPDATE SET count = count + 1`
    ).bind(p.i, p.v, p.f, p.t, p.e, hour, key).run();

    // Deliberately no logging of the request, the IP, or the user agent.
    return cors(new Response(null, { status: 204 }));
  },
};

function json(o, status) {
  return cors(new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } }));
}
function cors(r) {
  r.headers.set('access-control-allow-origin', '*');       // read-only writes, no credentials
  r.headers.set('access-control-allow-methods', 'POST, OPTIONS');
  r.headers.set('access-control-allow-headers', 'content-type');
  r.headers.set('cache-control', 'no-store');
  return r;
}
