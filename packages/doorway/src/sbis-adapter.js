/**
 * The `sbis:` adapter — maps the organisers' plug-in contract onto the loader.
 *
 * The contract gives us a trigger event on document.body and expects an
 * `sbis:result` back. What it must NOT get back is what the person did: the host
 * is an adversary (docs/02 R9), so the result says only that the overlay settled.
 *
 * Departure from contract/PLUGIN_CONTRACT.md, deliberate and documented:
 *   `outcome` is always "continued" — it means "the overlay has settled and the
 *   page may continue", not what the person chose. `helpServiceId` is null,
 *   `variantId` is omitted, `durationMs` is 0. The real outcome travels only from
 *   the Door to the edge counter.
 *
 * Nothing here builds a counter payload: there is one send path and it lives in
 * the Door (send.js).
 */
import { normaliseType } from '../../core/src/counter.js';

export const TRIGGER_EVENT = 'sbis:trigger';
export const RESULT_EVENT = 'sbis:result';

/**
 * severity decides whether we interrupt at all. `low` never gets an interstitial
 * — the contract's own schema says low means "subtle info link".
 */
export function mapTrigger(event = {}) {
  const severity = event.severity === 'high' || event.severity === 'medium' || event.severity === 'low'
    ? event.severity
    : 'medium';
  return {
    severity,
    type: normaliseType(['search', 'chat', 'navigation'].includes(event.type) ? event.type : 'search'),
    country: typeof event.country === 'string' && event.country.length === 2 ? event.country.toUpperCase() : null,
    interrupt: severity !== 'low',
  };
}

/** The five contract outcomes. Anything else is refused rather than guessed. */
export function outcomeFor(contractOutcome) {
  const allowed = ['dismissed', 'clicked_help', 'left_page', 'continued', 'timeout'];
  return allowed.includes(contractOutcome) ? contractOutcome : 'dismissed';
}

/**
 * @param {object} opts
 * @param {Document|object} opts.doc
 * @param {{trigger:(type:string, o?:{country?:string})=>Promise<void>}} opts.loader
 * @returns {() => void} teardown
 */
export function attach({ doc, loader } = {}) {
  if (!doc || !loader) throw new Error('attach() needs a document and a loader');

  const result = (detail) =>
    doc.body.dispatchEvent(new CustomEvent_(RESULT_EVENT, { detail: { ...detail, timestamp: new Date().toISOString() } }));

  function onTrigger(e) {
    const t = mapTrigger(e?.detail || {});
    // The contract's sessionScopedId and timestamp are never read.
    if (!t.interrupt) {
      result({ shown: false, outcome: 'continued', helpServiceId: null });
      return;
    }
    Promise.resolve(loader.trigger(t.type, { country: t.country })).then(() =>
      result({ shown: true, outcome: 'continued', helpServiceId: null, durationMs: 0 }));
  }

  doc.body.addEventListener(TRIGGER_EVENT, onTrigger);
  return () => doc.body.removeEventListener(TRIGGER_EVENT, onTrigger);
}

let CustomEvent_ = typeof CustomEvent !== 'undefined'
  ? CustomEvent
  : class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };

/** Test seam. */
export function __setEventCtor(ctor) { CustomEvent_ = ctor; }
