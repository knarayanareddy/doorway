/**
 * The Counter — seven aggregate fields, and nothing else.
 * No session id. No timestamp. No exact exposure count. No query text. No
 * local hour (the server stores a calendar day, so the client never needed to
 * send one — review H2).
 * Those omissions are the entire privacy argument.
 */

/** Shapes the Door can show. `fork` and `wave` are reserved: accepted only via build(..., {extraFormats}). */
export const FORMATS = Object.freeze(['gate', 'card', 'hallway', 'door', 'quiet']);

export const ALLOWED = Object.freeze({
  i: (v) => typeof v === 'string' && /^inst_[a-z0-9]{6,}$/.test(v),
  v: (v) => typeof v === 'string' && /^(legal|harm|control)-\d{2}$/.test(v),
  f: (v) => FORMATS.includes(v),
  t: (v) => ['search', 'chat', 'nav'].includes(v),
  o: (v) => ['clicked_help', 'left_page', 'dismissed', 'continued', 'timeout'].includes(v),
  r: (v) => typeof v === 'string' && /^[a-z]{2}-[a-z0-9-]{2,}$/.test(v),
  e: (v) => ['1', '2', '3', '4', '5+'].includes(v),
});

export const FIELDS = Object.keys(ALLOWED);

/** Largest body the edge will read. Seven short fields fit in well under this. */
export const MAX_BODY_BYTES = 512;

/**
 * The one place a platform's trigger type becomes a contract value.
 * The widget and the sbis adapter both call this, so they cannot disagree
 * (review B6: "navigation" was rejected by the counter and the error swallowed).
 */
export function normaliseType(raw) {
  switch (raw) {
    case 'search': return 'search';
    case 'chat': return 'chat';
    case 'nav':
    case 'navigation': return 'nav';
    default: return 'search';
  }
}

/**
 * Whitelist build. Unknown or extra keys are rejected, not stripped.
 * `extraFormats` exists only for prototypes of reserved shapes; the shipped Door and the
 * edge never pass it, so the edge keeps rejecting them.
 */
export function build(input = {}, { extraFormats = [] } = {}) {
  const errors = [];
  for (const k of Object.keys(input)) {
    if (!(k in ALLOWED)) errors.push(`unknown field: ${k}`);
  }
  for (const [k, ok] of Object.entries(ALLOWED)) {
    if (input[k] === undefined) errors.push(`missing field: ${k}`);
    else if (!ok(input[k]) && !(k === 'f' && extraFormats.includes(input[k]))) errors.push(`invalid ${k}: ${String(input[k]).slice(0, 40)}`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, payload: Object.fromEntries(FIELDS.map((k) => [k, input[k]])) };
}

/** Deterministic aggregate key. Nothing here identifies a person. */
export function aggregateKey(p) {
  return [p.i, p.v, p.f, p.t, p.e, p.o, p.r].join('|');
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

/**
 * Desk read model (review B6).
 *
 * Rows are aggregated per outcome over the requested period. Cells below k are
 * suppressed, and when exactly one cell is suppressed a second (the smallest
 * visible one) is suppressed too — otherwise it could be recovered by
 * subtracting from the total (secondary suppression).
 *
 * The click-through denominator is every exposure, left_page included. Every
 * figure carries the label the review requires: it is what the install's own
 * page reported, not measured ground truth.
 */
export const UNAUTHENTICATED_LABEL = "Self-reported by the install's page, unauthenticated.";

export function deskSummary(rows, { k = 10, flaggedDays = [] } = {}) {
  const byOutcome = {};
  for (const r of rows) byOutcome[r.outcome] = (byOutcome[r.outcome] || 0) + r.count;
  const total = Object.values(byOutcome).reduce((a, b) => a + b, 0);

  const cells = Object.entries(byOutcome).map(([outcome, count]) => ({ outcome, count }));
  let out = suppress(cells, k);
  if (out.filter((c) => c.suppressed).length === 1) {
    // Prefer to hide something other than the help-click cell: it is the number the
    // Desk exists to show, and hiding any second cell is enough to stop subtraction.
    const candidates = out.filter((c) => !c.suppressed).sort((a, b) => a.count - b.count);
    const visible = candidates.find((c) => c.outcome !== 'clicked_help') || candidates[0];
    if (visible) out = out.map((c) => (c === visible ? { ...c, count: null, suppressed: true, secondary: true } : c));
  }

  const clickedCell = out.find((c) => c.outcome === 'clicked_help');
  const clicked = byOutcome.clicked_help || 0;
  let clickThrough;
  if (total < k) clickThrough = { rate: null, note: 'suppressed: fewer than k exposures' };
  else if (clicked === 0 || (clickedCell && clickedCell.suppressed)) {
    clickThrough = { rate: null, note: 'suppressed: help clicks below k' };
  } else clickThrough = ctr(clicked, total);

  return {
    label: UNAUTHENTICATED_LABEL,
    k,
    exposures: total < k ? null : total,
    outcomes: out,
    clickThrough,
    flaggedDays,
  };
}

/**
 * Anomaly flags per day. A flagged day is shown, labelled, and excluded from
 * headline rates — never silently dropped.
 *   - click-through above 40% on at least 50 exposures
 *   - volume more than 10x the mean of the preceding days
 * @param {{day:string,total:number,clicked:number}[]} days  ascending by day
 */
export function flagAnomalies(days) {
  const flagged = [];
  days.forEach((d, i) => {
    const reasons = [];
    if (d.total >= 50 && d.clicked / d.total > 0.4) reasons.push('click-through above 40%');
    const prior = days.slice(0, i).map((x) => x.total);
    if (prior.length >= 2) {
      const mean = prior.reduce((a, b) => a + b, 0) / prior.length;
      if (mean > 0 && d.total > 10 * mean) reasons.push('volume above 10x the previous mean');
    }
    if (reasons.length) flagged.push({ day: d.day, reasons });
  });
  return flagged;
}

/** Heartbeat: install, client version, count of events the Door could not send. Counts only. */
export const HEARTBEAT = Object.freeze({
  i: ALLOWED.i,
  v: (v) => typeof v === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v),
  d: (v) => Number.isInteger(v) && v >= 1 && v <= 1000000,
});

/**
 * False-positive report (review H4). Content-free: which install, which pack
 * version, which trigger type, and a reason from a closed list. No query, no
 * time finer than the day the server stamps.
 */
export const REPORT_REASONS = Object.freeze(['journalist', 'survivor', 'parent', 'researcher', 'accident', 'other']);
export const REPORT = Object.freeze({
  i: ALLOWED.i,
  p: (v) => typeof v === 'string' && /^[0-9a-z.-]{1,24}$/.test(v),
  t: ALLOWED.t,
  r: (v) => REPORT_REASONS.includes(v),
});

function buildFrom(spec, input = {}) {
  const errors = [];
  for (const k of Object.keys(input)) if (!(k in spec)) errors.push(`unknown field: ${k}`);
  for (const [k, ok] of Object.entries(spec)) {
    if (input[k] === undefined) errors.push(`missing field: ${k}`);
    else if (!ok(input[k])) errors.push(`invalid ${k}`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, payload: Object.fromEntries(Object.keys(spec).map((k) => [k, input[k]])) };
}
export const buildHeartbeat = (input) => buildFrom(HEARTBEAT, input);
export const buildReport = (input) => buildFrom(REPORT, input);


/**
 * Per-shape read model for the Desk. Like deskSummary it hides cells under k, and it also hides
 * the smallest remaining visible cell when exactly one is hidden (secondary suppression), for both
 * exposures and help clicks, so a hidden value cannot be recovered by subtracting from a total.
 * Rates are always over every exposure of that shape.
 */
const SHAPE_ORDER = ['gate', 'card', 'fork', 'wave', 'hallway', 'door', 'quiet'];
function hidden(values, k) {
  const h = values.map((v) => v < k);
  if (h.filter(Boolean).length === 1) {
    let best = -1;
    values.forEach((v, i) => { if (!h[i] && (best < 0 || v < values[best])) best = i; });
    if (best >= 0) h[best] = true;
  }
  return h;
}
export function deskByFormat(rows, { k = 10 } = {}) {
  const by = new Map();
  for (const r of rows) {
    const f = by.get(r.format) || { total: 0, clicked: 0 };
    f.total += r.count;
    if (r.outcome === 'clicked_help') f.clicked += r.count;
    by.set(r.format, f);
  }
  const names = [...by.keys()].sort((a, b) => (SHAPE_ORDER.indexOf(a) + 1 || 99) - (SHAPE_ORDER.indexOf(b) + 1 || 99));
  const hideExp = hidden(names.map((n) => by.get(n).total), k);
  const hideClk = hidden(names.map((n) => by.get(n).clicked), k);
  return names.map((format, i) => {
    const f = by.get(format);
    const exposures = hideExp[i] ? null : f.total;
    const clicked = hideClk[i] ? null : f.clicked;
    return { format, exposures, clicked, rate: exposures !== null && clicked !== null ? f.clicked / f.total : null, suppressed: exposures === null || clicked === null };
  });
}
