/**
 * The Shift — pure scheduling function.
 * No DOM, no network, no side effects. Fully unit-testable.
 *
 * Ordering rationale (see docs/05-adoption-review.md §A1):
 *   entry endpoint  -> LEGAL  (Prichard 2022 OR 2.99, 2024 OR 5.02)
 *   help endpoint   -> HARM   (Ó Ciardha 2026, Ahmia)
 *   exhaustion      -> CONTROL (threat has failed 4x; offer the exit)
 */

/** After the person acts, repeat exposures are quiet for this long. */
export const QUIET_HOURS = 72;

export const BUCKETS = ['1', '2', '3', '4', '5+'];

export const DEFAULT_CONFIG = Object.freeze({
  // Interval widens with the count: 10 minutes between the 1st and 2nd
  // exposure, 6 hours between 2nd and 3rd, then 72 hours — the original value.
  //
  // Why this and not a flat 72: the Shift's whole argument is that the FORM
  // should change as repetition continues (gate -> card -> chat). A flat 72h
  // window returns `quiet` before the counter is ever consulted, so the first
  // form repeats and the argument never runs. That showed up only in a real
  // browser — five triggers in two seconds produced gate,quiet,quiet,quiet,quiet
  // (docs/06-organiser-repos.md).
  //
  // Why it is safe: a person who opens a platform twice in ten minutes gets the
  // second form, which is the behaviour we want. A daily user still sees one
  // intervention every three days after the third exposure — the anti-nagging
  // rule is unchanged where nagging would actually happen. See docs/07.
  intervalHours: Object.freeze([0, 10 / 60, 6, 72]),
  minIntervalHours: 72,
  // One SHAPE per exposure, each answering a different question the person may be
  // silently asking. The last shape repeats once the sequence runs out.
  //   gate      "What is this?"                  the plain fact
  //   card      "Why does it matter?"            the harm, in a human voice
  //   hallway   "What happens if I reach out?"   rehearse the contact before making it
  //   door      "Is it still open?"              presence instead of pressure
  // `fork` ("Where do I stand?") and `wave` ("What do I do with this urge?") are
  // reserved names. They are NOT in the shipped sequence until the open decisions on
  // self-identification and clinical review are made (docs/11).
  sequence: Object.freeze(['gate', 'card', 'hallway', 'hallway', 'door']),
  // Family of copy per shape; `quiet` is the pill inside the re-warning window.
  families: Object.freeze({
    gate: 'legal',
    card: 'harm',
    fork: 'harm',
    wave: 'control',
    hallway: 'control',
    door: 'control',
    quiet: 'harm',
  }),
});

/** The shape for exposure number `next` (1-based). */
export function shapeFor(next, cfg = DEFAULT_CONFIG) {
  const seq = cfg.sequence;
  return seq[Math.min(Math.max(1, Math.floor(next)), seq.length) - 1];
}

/** A shape re-shown inside the window must never be a modal gate (H1): the gate becomes an inline card. */
export const inlineShape = (shape) => (shape === 'gate' ? 'card' : shape);

/** Hours that must pass before exposure n+1 is shown at full strength. */
export function intervalFor(n, cfg = DEFAULT_CONFIG) {
  const table = cfg.intervalHours;
  if (!Array.isArray(table) || table.length === 0) return cfg.minIntervalHours;
  // After the table runs out, hold at its final value.
  return Number(table[Math.min(Math.max(0, Math.floor(n)), table.length - 1)]);
}

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
    // Without localStorage we cannot track exposure count, so we cannot
    // escalate or go quiet. Returning the legal gate on every visit would
    // show the heaviest intervention to privacy-conscious users (private
    // mode) forever. Show a card/harm instead — still an intervention, but
    // not a criminal-law claim repeated indefinitely.
    return {
      state: 'DEGRADED',
      format: 'card',
      family: cfg.families.card,
      bucket: '1',
      reason: 'storage unavailable — card instead of the legal gate',
    };
  }

  const n = Number.isFinite(state.n) ? state.n : 0;
  const last = Number.isFinite(state.last) ? state.last : 0;
  const hours = last ? (now - last) / 3.6e6 : Infinity;

  // Anti-nagging, narrowed (review H1). The re-warning clock exists to stop a
  // daily user being nagged — not to answer a second search inside the first
  // minute with a one-line strip. Re-searching right after a warning is the
  // strongest behavioural signal the system sees.
  //
  //   * Person has already clicked help / dismissed / continued, and that was
  //     under QUIET_HOURS ago  -> true quiet.
  //   * Otherwise, inside the window -> escalate IN PLACE: the next format as an
  //     inline card (never a modal), and the clock is NOT reset (keepClock).
  const window = intervalFor(n, cfg);
  if (hours < window) {
    const acted = Number.isFinite(state.acted) ? state.acted : 0;
    if (acted && (now - acted) / 3.6e6 < QUIET_HOURS) {
      return {
        state: 'HABITUATED',
        format: 'quiet',
        family: cfg.families.quiet,
        bucket: bucketOf(n),
        keepClock: true,
        reason: `person already acted ${Math.round((now - acted) / 6e4)} min ago; quiet for ${QUIET_HOURS}h`,
      };
    }
    const upNext = n + 1;
    const shape = shapeFor(upNext, cfg);
    return {
      state: 'ESCALATING',
      format: inlineShape(shape),
      family: cfg.families[shape],
      bucket: bucketOf(upNext),
      keepClock: true,
      reason: `retry inside the ${window}h window — escalate in place, clock not reset`,
    };
  }

  const next = n + 1;
  const shape = shapeFor(next, cfg);
  return {
    state: next === 1 ? 'FIRST' : next < cfg.sequence.length ? 'RETURNING' : 'PERSISTENT',
    format: shape,
    family: cfg.families[shape],
    bucket: bucketOf(next),
  };
}

/**
 * Advance local state after an exposure. Never transmitted.
 * `keepClock` counts the exposure but leaves the re-warning clock where it was,
 * so an in-place escalation cannot postpone the next full-strength warning.
 */
export function advance(state = {}, variant, now = Date.now(), opts = {}) {
  const seen = Array.isArray(state.seen) ? state.seen.slice(-4) : [];
  let filtered = seen;
  if (variant) {
    // Dedupe so the rotation window never traps on a single variant.
    filtered = seen.filter((v) => v !== variant);
    filtered.push(variant);
  }
  const last = opts.keepClock && Number.isFinite(state.last) && state.last ? state.last : now;
  const next = { n: (state.n || 0) + 1, last, seen: filtered };
  if (Number.isFinite(state.acted)) next.acted = state.acted;
  return next;
}

/** Record that the person clicked help, dismissed or continued. Local only. */
export function markActed(state = {}, now = Date.now()) {
  return { ...state, acted: now };
}

/** Choose the variant id for a family, avoiding the last few already seen. */
export function variantFor(family, seen = []) {
  const pool = [`${family}-01`, `${family}-02`, `${family}-03`];
  const fresh = pool.filter((v) => !seen.includes(v));
  if (fresh.length) return fresh[0];
  // All variants are in the recent window; rotate by returning the oldest seen.
  return seen[0] || pool[0];
}
