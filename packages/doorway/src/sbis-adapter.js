/**
 * The `sbis:` adapter — our widget as a module that plugs into the organisers'
 * mock platform, and into any platform that implements `contract/PLUGIN_CONTRACT.md`.
 *
 * WHY THIS EXISTS
 * Doorway was built as a standalone widget with its own `createDoorway()`
 * entry point. The challenge's deliverable is "a working prototype, shown in
 * the mock platform" — and the mock platform knows nothing about our API. It
 * fires `sbis:trigger` on document.body and expects `sbis:result` back.
 *
 * Without this file, our answer to "can I see it running?" is a screen
 * recording. With it, the jury can clone the organisers' repo, swap one script
 * tag, and watch it run. That difference is worth more than any slide.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * The contract passes `sessionScopedId` and a full `timestamp` in the trigger
 * event. We do not read either, and we do not put them in our own payload —
 * our counter rejects unknown keys rather than stripping them, so anything
 * forwarded here would fail loudly. The contract's own privacy rules are
 * satisfied by construction rather than by promise.
 */
import { build as buildCounter } from '../../core/src/counter.js';

export const TRIGGER_EVENT = 'sbis:trigger';
export const RESULT_EVENT = 'sbis:result';

/**
 * Map the contract's trigger event onto the Shift's input.
 *
 * severity decides whether we interrupt at all; the Shift decides *how*.
 * `low` never gets an interstitial — the contract's own schema says low means
 * "subtle info link", and a full-screen takeover on a low signal is how a
 * widget gets uninstalled.
 *
 * @param {{type?:string, severity?:string, country?:string, language?:string}} event
 */
export function mapTrigger(event = {}) {
  const severity = event.severity === 'high' || event.severity === 'medium' || event.severity === 'low'
    ? event.severity
    : 'medium';

  const type = ['search', 'chat', 'navigation'].includes(event.type) ? event.type : 'search';

  return {
    severity,
    type,
    country: typeof event.country === 'string' ? event.country.toUpperCase() : null,
    language: typeof event.language === 'string' ? event.language : 'en',
    // An interstitial is only warranted at medium and above.
    interrupt: severity !== 'low',
  };
}

/**
 * Map the Shift's chosen format onto the contract's outcome vocabulary.
 *
 * The contract has five outcomes: dismissed · clicked_help · left_page ·
 * continued · timeout. Our Shift produces formats, not outcomes — this is the
 * seam, and it is the only place the two vocabularies meet.
 */
export function outcomeFor(contractOutcome) {
  const allowed = ['dismissed', 'clicked_help', 'left_page', 'continued', 'timeout'];
  return allowed.includes(contractOutcome) ? contractOutcome : 'dismissed';
}

/**
 * Build the eight-field counter payload for one exposure.
 *
 * Note what the contract gives us and what we drop:
 *   given:    type, severity, country, language, sessionScopedId, timestamp
 *   used:     type, country, language
 *   dropped:  sessionScopedId (never read), timestamp (we send hour-of-day, b)
 *   invented: none
 *
 * The `e` (exposure bucket) field is the interesting one. A single exposure is
 * always bucket "1" — the bucket becomes meaningful only when a platform
 * passes a cumulative count, which the contract does not do. We send "1" and
 * say so, rather than deriving a bucket from something that is not a count.
 *
 * @param {ReturnType<typeof mapTrigger>} t
 * @param {string} format  gate|blur|card|chat|quiet
 * @param {string} family  legal|harm|control|ai|selfhelp
 * @param {string} variant e.g. legal-01
 * @param {string} outcome one of the contract's five
 * @param {Date} now
 */
export function toCounterPayload(t, format, family, variant, outcome, routeId, bucket, now = new Date()) {
  const allowedTypes = { search: 'search', chat: 'chat', navigation: 'nav' };
  const raw = {
    i: 'inst_placeholder', // replaced by caller with the real install id
    v: variant,
    f: format,
    t: allowedTypes[t.type] || 'search',
    o: outcome,
    r: routeId || 'xx-none',
    e: bucket || '1',
    b: now.getHours(),
  };
  const { ok, errors, payload } = buildCounter(raw);
  return ok ? { ok, payload } : { ok: false, errors };
}

/**
 * Wire a Doorway instance to the document.
 *
 * Returns a teardown function. Everything it needs is injected, so it can be
 * driven from a test with a stub document — which is how the adapter is tested,
 * because jsdom is a dependency and this project has none.
 *
 * @param {object} opts
 * @param {Document|object} opts.doc
 * @param {ReturnType<import('./widget.js').createDoorway>} opts.doorway
 * @param {object} opts.routes
 * @param {(payload:object)=>void} [opts.onCounter]
 */
export function attach({ doc, doorway, routes, onCounter } = {}) {
  if (!doc || !doorway) throw new Error('attach() needs a document and a doorway instance');

  function onTrigger(e) {
    const t = mapTrigger(e?.detail || {});

    // Low severity: log the exposure, show nothing. The platform still gets a
    // result so its aggregate counts reconcile.
    if (!t.interrupt) {
      doc.body.dispatchEvent(
        new CustomEvent_(RESULT_EVENT, {
          detail: { shown: false, outcome: 'continued', timestamp: new Date().toISOString() },
        })
      );
      return;
    }

    // Hand the decision to the widget, which owns the Shift's state, the
    // language resolution and the mounting. The adapter supplies only what the
    // contract gives us and what the host asks for.
    // Tell the widget which country this trigger came from BEFORE it resolves a
    // route. `country` is a required field of the contract and we were dropping
    // it, which routed a German-speaking user to a UK number.
    if (typeof doorway.setCountry === 'function') doorway.setCountry(t.country);

    doorway.onOutcome((contractOutcome) => finish(contractOutcome));
    const shown = doorway.step();
    const { decision, variant } = shown;
    const shownRouteId = shown.handle?.routeId ?? null;

    function finish(contractOutcome) {
      const outcome = outcomeFor(contractOutcome);
      doc.body.dispatchEvent(
        new CustomEvent_(RESULT_EVENT, {
          detail: {
            shown: true,
            variantId: variant,
            outcome,
            helpServiceId: outcome === 'clicked_help' ? shownRouteId : null,
            durationMs: 0, // measured by the host, not by us — we do not run timers on the page
            timestamp: new Date().toISOString(),
          },
        })
      );
      const c = toCounterPayload(t, decision.format, decision.family, variant, outcome, shownRouteId, decision.bucket);
      if (c.ok && typeof onCounter === 'function') onCounter(c.payload);
    }

    return decision;
  }

  doc.body.addEventListener(TRIGGER_EVENT, onTrigger);

  return function teardown() {
    doc.body.removeEventListener(TRIGGER_EVENT, onTrigger);
  };
}

// Pulled out so a test can substitute a plain function without a DOM.
let CustomEvent_ = typeof CustomEvent !== 'undefined'
  ? CustomEvent
  : class { constructor(type, init) { this.type = type; this.detail = init?.detail; } };

/** Test seam. */
export function __setEventCtor(ctor) { CustomEvent_ = ctor; }
