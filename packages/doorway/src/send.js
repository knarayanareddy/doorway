/**
 * The one send path (review B6). The Door's exposure outcomes, the abandon
 * (left_page) beacon and the heartbeat all go through here, so there is exactly
 * one place that validates, one place that fails, and one place that counts what
 * was lost.
 *
 * A failed send never throws and never buffers an identifier. It increments a
 * local dropped-events counter; the Door reports that count — a number, nothing
 * else — in a heartbeat, so a pilot cannot silently undercount.
 */
import { build, buildHeartbeat } from '../../core/src/counter.js';
import { VERSION } from './version.js';

export function createSender({ origin = '', fetchImpl = globalThis.fetch, onDrop = () => {} } = {}) {
  const post = (path, payload) =>
    fetchImpl(origin + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    }).then((r) => { if (!r.ok) throw new Error('status ' + r.status); });

  return {
    /** @returns {Promise<boolean>} true when the edge accepted the event. */
    async event(raw) {
      const res = build(raw);
      if (!res.ok) { onDrop('invalid', res.errors); return false; }
      try { await post('/v1/c', res.payload); return true; }
      catch (e) { onDrop('network', [String(e?.message || e)]); return false; }
    },
    /** Sends a drop count and returns true on success so the caller can reset it. */
    async heartbeat(install, dropped) {
      const res = buildHeartbeat({ i: install, v: VERSION, d: dropped });
      if (!res.ok) return false;
      try { await post('/v1/heartbeat', res.payload); return true; } catch { return false; }
    },
  };
}
