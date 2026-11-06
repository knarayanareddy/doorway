/**
 * The Counter — eight aggregate fields, and nothing else.
 * No session id. No timestamp. No exact exposure count. No query text.
 * Those three omissions are the entire privacy argument.
 */

export const ALLOWED = Object.freeze({
  i: (v) => typeof v === 'string' && /^inst_[a-z0-9]{6,}$/.test(v),
  v: (v) => typeof v === 'string' && /^(legal|harm|control|ai|selfhelp)-\d{2}$/.test(v),
  f: (v) => ['gate', 'blur', 'card', 'chat', 'quiet'].includes(v),
  t: (v) => ['search', 'chat', 'nav', 'upload'].includes(v),
  o: (v) => ['clicked_help', 'left_page', 'dismissed', 'continued', 'timeout'].includes(v),
  r: (v) => typeof v === 'string' && /^[a-z]{2}-[a-z0-9-]{2,}$/.test(v),
  e: (v) => ['1', '2', '3', '4', '5+'].includes(v),
  b: (v) => Number.isInteger(v) && v >= 0 && v <= 23,
});

export const FIELDS = Object.keys(ALLOWED);

/** Whitelist build. Unknown or extra keys are rejected, not stripped. */
export function build(input = {}) {
  const errors = [];
  for (const k of Object.keys(input)) {
    if (!(k in ALLOWED)) errors.push(`unknown field: ${k}`);
  }
  for (const [k, ok] of Object.entries(ALLOWED)) {
    if (input[k] === undefined) errors.push(`missing field: ${k}`);
    else if (!ok(input[k])) errors.push(`invalid ${k}: ${String(input[k]).slice(0, 40)}`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, payload: Object.fromEntries(FIELDS.map((k) => [k, input[k]])) };
}

/** Deterministic aggregate key. Nothing here identifies a person. */
export function aggregateKey(p) {
  return [p.i, p.v, p.f, p.t, p.e, p.b, p.o, p.r].join('|');
}

/** k-anonymity: cells below k are suppressed before display. */
export function suppress(rows, k = 10) {
  return rows.map((r) => (r.count < k ? { ...r, count: null, suppressed: true } : r));
}

/** Honest click-through rate: numerator over real denominator, never a rate alone. */
export function ctr(clicked, shown) {
  if (!shown) return { rate: null, clicked, shown, note: 'no exposures' };
  return {
    rate: clicked / shown,
    clicked,
    shown,
    note: shown < 100 ? 'small denominator — treat as indicative' : null,
  };
}
