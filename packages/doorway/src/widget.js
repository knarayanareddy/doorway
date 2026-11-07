/**
 * The Door runtime. It runs INSIDE the Doorway-origin iframe (see door.js), never
 * in the host page's realm — so the host cannot read its storage, wrap its fetch
 * or receive its callbacks (review B1). Nothing here accepts a host callback.
 *
 * Logic that does not need a DOM lives in core/ and copy.js and is unit-tested.
 * This file is exercised end to end by test/e2e (Playwright), including a
 * hostile-host page.
 */
import { pick, advance, variantFor, markActed } from '../../core/src/shift.js';
import { resolve } from '../../core/src/route.js';
import { normaliseType } from '../../core/src/counter.js';
import { buildCard, mount } from '../../shared/card.js';
import { copyFor, attributionFor, footnoteFor, variantIndex, langOf, LABELS } from './copy.js';
import { createSender } from './send.js';

export { variantIndex, footnoteFor };

const STORAGE_KEY = 'doorway:v1';

// card.js speaks in actions; the plug-in contract speaks in outcomes. This is
// the only translation point.
const CONTRACT = { primary: 'clicked_help', secondary: 'continued', dismiss: 'dismissed', timeout: 'timeout' };
const ACTED = new Set(['clicked_help', 'dismissed', 'continued']);

/**
 * @param {object} o
 * @param {object} o.routes             verified routes bundle ({byLanguage})
 * @param {string} o.install            inst_xxxxxx
 * @param {string} [o.lang]
 * @param {string} [o.country]          routing filter, declared by the platform
 * @param {string} [o.legalJurisdiction] explicit platform declaration; never inferred
 * @param {() => void} [o.onSettled]    the only thing that leaves the Door
 */
export function createDoorway({
  routes, install, lang, country, legalJurisdiction, config,
  onSettled = () => {}, storage, doc, win, sender, now = () => Date.now(),
} = {}) {
  const w = win || globalThis;
  const store = storage ?? (() => { try { return w.localStorage; } catch { return null; } })();
  const L = langOf(lang || w.navigator?.language);
  const countryCode = typeof country === 'string' && country.length === 2 ? country.toUpperCase() : null;

  const readState = () => {
    if (!store) return { __blocked: true };
    try { return JSON.parse(store.getItem(STORAGE_KEY) || '{}'); }
    catch { return { __blocked: true }; }
  };
  const writeState = (s) => {
    try { store?.setItem(STORAGE_KEY, JSON.stringify(s)); }
    catch { /* private mode — the DEGRADED path in shift.js already handles this */ }
  };

  const send = sender || createSender({
    origin: '',
    onDrop: () => { const s = readState(); if (!s.__blocked) writeState({ ...s, drops: (s.drops || 0) + 1 }); },
  });

  let active = null;      // { handle, finished }
  let leaveListenersOn = false;

  function present(decision, variantId, route) {
    const variants = copyFor({ format: decision.format, family: decision.family, lang: L, route, legalJurisdiction, now: now() });
    const t = variants[variantIndex(variantId)] || variants[0];
    const hasLink = !!route?.url;

    const descriptor = buildCard({
      variant: decision.format,
      headline: t.h,
      body: t.b,
      lang: L,
      attribution: attributionFor(route, L),
      primary: {
        label: hasLink ? LABELS.primary[L] : LABELS.close[L],
        kind: 'primary',
        onSelect: () => { if (hasLink) openHelp(route.url); },
      },
      secondary: { label: LABELS.secondary[L], kind: 'secondary' },
      footnote: footnoteFor(route, L, now()),
    });
    return descriptor;
  }

  // noreferrer+noopener: the host page's URL (which may hold the search query)
  // is never sent to the help service, and the new tab cannot reach back.
  function openHelp(url) {
    try {
      const a = (doc || w.document).createElement('a');
      a.href = url; a.rel = 'noreferrer noopener'; a.target = '_blank';
      a.click();
    } catch { w.location?.assign(url); }
  }

  function startLeaveWatch() {
    if (leaveListenersOn) return;
    leaveListenersOn = true;
    const onLeave = () => { if (active && !active.finished) active.finish('left_page'); };
    w.addEventListener?.('pagehide', onLeave);
    w.document?.addEventListener?.('visibilitychange', () => {
      if (w.document.visibilityState === 'hidden') onLeave();
    });
  }

  function trigger({ type = 'search' } = {}) {
    if (active && !active.finished && active.handle?.el?.isConnected) return active;

    const st = readState();
    const blocked = st.__blocked === true;
    const decision = pick(st, config, now(), { storageBlocked: blocked });
    const variant = variantFor(decision.family, st.seen || []);

    const need = decision.format === 'chat' ? 'human' : 'any';
    const { route } = resolve(w.navigator?.language || L, routes, { need, country: countryCode });
    const descriptor = present(decision, variant, route || null);

    // Count the exposure before anything can go wrong; the clock is kept for
    // in-place escalations so a retry cannot postpone the next full warning.
    const adv = advance(blocked ? {} : st, variant, now(), { keepClock: decision.keepClock });
    writeState(blocked ? adv : { ...adv, ...(st.drops ? { drops: st.drops } : {}) });

    const exposure = { finished: false, handle: null };
    exposure.finish = (outcome) => {
      if (exposure.finished) return;
      exposure.finished = true;
      if (ACTED.has(outcome)) {
        const cur = readState();
        if (!cur.__blocked) writeState(markActed(cur, now()));
      }
      // Exactly one record per exposure: whichever outcome comes first. A person
      // who looks away and later returns is still ONE exposure, so the
      // click-through denominator equals real exposures.
      send.event({
        i: install,
        v: variant,
        f: decision.format,
        t: normaliseType(type),
        o: outcome,
        r: route?.id || 'xx-none',
        e: decision.bucket,
      });
      onSettled();   // the overlay never waits on the network
    };

    const handle = mount(descriptor, {
      doc,
      onOutcome: ({ outcome }) => {
        // route-less primary is a plain close, never a help click
        const mapped = outcome === 'primary' && !route?.url ? 'continued' : (CONTRACT[outcome] || 'timeout');
        exposure.finish(mapped);
      },
    });
    exposure.handle = handle;
    active = exposure;
    startLeaveWatch();
    flushDrops();
    return exposure;
  }

  /** Report how many events were lost, as a number only, then reset it. */
  async function flushDrops() {
    const st = readState();
    if (st.drops > 0 && await send.heartbeat(install, st.drops)) {
      const cur = readState();
      if (!cur.__blocked) writeState({ ...cur, drops: 0 });
    }
  }

  return { trigger };
}
