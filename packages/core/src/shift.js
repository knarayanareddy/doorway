/**
 * The Shift — pure scheduling function.
 * No DOM, no network, no side effects. Fully unit-testable.
 *
 * Ordering rationale (see docs/05-adoption-review.md §A1):
 *   entry endpoint  -> LEGAL  (Prichard 2022 OR 2.99, 2024 OR 5.02)
 *   help endpoint   -> HARM   (Ó Ciardha 2026, Ahmia)
 *   exhaustion      -> CONTROL (threat has failed 4x; offer the exit)
 */

export const BUCKETS = ['1', '2', '3', '4', '5+'];

export const DEFAULT_CONFIG = Object.freeze({
  minIntervalHours: 72,
  gateUntil: 2,
  chatFrom: 5,
  // family shown per format; corrected after the RCT review
  families: Object.freeze({
    gate: 'legal',
    card: 'harm',
    chat: 'control',
    quiet: 'harm',
  }),
});

export function bucketOf(n) {
  if (!Number.isFinite(n)) return '1';
  if (n >= 5) return '5+';
  return String(Math.max(1, Math.floor(n)));
}

/**
 * @param {{n?: number, last?: number}} state  local counter + last exposure ts (ms)
 * @param {typeof DEFAULT_CONFIG} cfg
 * @param {number} now  ms epoch
 * @param {{storageBlocked?: boolean}} opts
 */
export function pick(state = {}, cfg = DEFAULT_CONFIG, now = Date.now(), opts = {}) {
  if (opts.storageBlocked) {
    return {
      state: 'DEGRADED',
      format: 'gate',
      family: cfg.families.gate,
      bucket: '1',
      reason: 'storage unavailable — fall back to first-exposure behaviour',
    };
  }

  const n = Number.isFinite(state.n) ? state.n : 0;
  const last = Number.isFinite(state.last) ? state.last : 0;
  const hours = last ? (now - last) / 3.6e6 : Infinity;

  // Anti-nagging: inside the re-warning window, degrade rather than repeat loudly.
  if (hours < cfg.minIntervalHours) {
    return {
      state: 'HABITUATED',
      format: 'quiet',
      family: cfg.families.quiet,
      bucket: bucketOf(n),
      reason: `inside the ${cfg.minIntervalHours}h re-warning interval`,
    };
  }

  const next = n + 1;

  if (next <= cfg.gateUntil) {
    return { state: 'FIRST', format: 'gate', family: cfg.families.gate, bucket: bucketOf(next) };
  }
  if (next < cfg.chatFrom) {
    return { state: 'RETURNING', format: 'card', family: cfg.families.card, bucket: bucketOf(next) };
  }
  return { state: 'PERSISTENT', format: 'chat', family: cfg.families.chat, bucket: bucketOf(next) };
}

/** Advance local state after an exposure. Never transmitted. */
export function advance(state = {}, variant, now = Date.now()) {
  const seen = Array.isArray(state.seen) ? state.seen.slice(-4) : [];
  if (variant) seen.push(variant);
  return { n: (state.n || 0) + 1, last: now, seen };
}

/** Choose the variant id for a family, avoiding the last few already seen. */
export function variantFor(family, seen = []) {
  const pool = [`${family}-01`, `${family}-02`, `${family}-03`];
  const fresh = pool.filter((v) => !seen.includes(v));
  return (fresh.length ? fresh : pool)[0];
}
