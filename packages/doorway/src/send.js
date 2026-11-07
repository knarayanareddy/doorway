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
import { build, buildHeartbeat, buildReport } from '../../core/src/counter.js';
import { VERSION } from './version.js';

export function createSender({ origin = '', extraFormats = [], fetchImpl = globalThis.fetch, beaconImpl = globalThis.navigator?.sendBeacon?.bind(globalThis.navigator), onDrop = () => {} } = {}) {
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
    /**
     * @param {object} raw
     * @param {{unloading?: boolean}} [opts]  true while the page is going away: a keepalive
     *   fetch can be cancelled there (observed in WebKit), so the browser's beacon queue
     *   is used. Same endpoint, same validated payload — only the transport differs.
     * @returns {Promise<boolean>} true when the event was accepted (or, for a beacon, queued).
     */
    async event(raw, { unloading = false } = {}) {
      const res = build(raw, { extraFormats });
      if (!res.ok) { onDrop('invalid', res.errors); return false; }
      if (unloading && beaconImpl) {
        try {
          if (beaconImpl(origin + '/v1/c', new Blob([JSON.stringify(res.payload)], { type: 'application/json' }))) return true;
        } catch { /* fall back to fetch keepalive */ }
      }
      try { await post('/v1/c', res.payload); return true; }
      catch (e) { onDrop('network', [String(e?.message || e)]); return false; }
    },
    /** A visitor's "this warning was a mistake": install, pack version, trigger kind, closed-list reason. */
    async report(raw) {
      const res = buildReport(raw);
      if (!res.ok) { onDrop('invalid', res.errors); return false; }
      try { await post('/v1/report', res.payload); return true; }
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
