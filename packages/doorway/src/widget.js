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
import { glassSection, hallwaySections } from './panels.js';

export { variantIndex, footnoteFor };

const STORAGE_KEY = 'doorway:v1';

// card.js speaks in actions; the plug-in contract speaks in outcomes. This is
// the only translation point.
const CONTRACT = { primary: 'clicked_help', secondary: 'continued', dismiss: 'dismissed', timeout: 'timeout', 'section:alt': 'clicked_help' };
/** Longest the overlay waits for the outcome to be sent before it settles anyway. */
export const SETTLE_MAX_MS = 1500;
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

  /**
   * @param {object} ctx
   * @param {object|null} ctx.route       the help service offered
   * @param {object|null} ctx.selfhelp    a self-help alternative, if one exists
   * @param {object} ctx.preview          the exact payload this exposure would send (outcome still null)
   * @param {number} ctx.localCount       how many times this device has seen the Door
   */
  function present(decision, variantId, { route, selfhelp, preview, localCount, onWipe, onAlt }) {
    const variants = copyFor({ format: decision.format, family: decision.family, lang: L, route, legalJurisdiction, now: now() });
    const t = variants[variantIndex(variantId)] || variants[0];
    const hasLink = !!route?.url;

    const sections = [];
    if (decision.format === 'hallway') sections.push(...hallwaySections({ lang: L, route, selfhelp, now: now(), onAlt }));
    // The Glass Door is on every shape except the quiet pill: the person can check what is sent
    // at the moment they decide whether to trust it.
    if (decision.format !== 'quiet') sections.push(glassSection({ lang: L, preview, localCount, onWipe }));

    return buildCard({
      variant: decision.format,
      headline: t.h,
      body: t.b,
      lang: L,
      attribution: attributionFor(route, L),
      closeLabel: LABELS.closeDialog[L],
      primary: {
        label: hasLink ? LABELS.primary[L] : LABELS.close[L],
        kind: 'primary',
        onSelect: () => { if (hasLink) openHelp(route.url); },
      },
      secondary: { label: LABELS.secondary[L], kind: 'secondary' },
      tertiary: { label: LABELS.report[L], kind: 'tertiary' },
      sections,
      footnote: footnoteFor(route, L, now()),
    });
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

    // Shapes that invite contact prefer a person; resolve() degrades to self-help, and the
    // copy follows the route's real kind (M6), so nobody is promised a person they will not get.
    const need = decision.format === 'hallway' || decision.format === 'door' ? 'human' : 'any';
    const langTag = w.navigator?.language || L;
    const { route } = resolve(langTag, routes, { need, country: countryCode });
    const selfhelp = decision.format === 'hallway' ? (resolve(langTag, routes, { need: 'selfhelp', country: countryCode }).route || null) : null;

    // Count the exposure before anything can go wrong; the clock is kept for
    // in-place escalations so a retry cannot postpone the next full warning.
    const adv = advance(blocked ? {} : st, variant, now(), { keepClock: decision.keepClock });
    writeState(blocked ? adv : { ...adv, ...(st.drops ? { drops: st.drops } : {}) });

    // Exactly the object that will be sent, minus the outcome that does not exist yet.
    const preview = { i: install, v: variant, f: decision.format, t: normaliseType(type), o: null, r: route?.id || 'xx-none', e: decision.bucket };

    const exposure = { finished: false, handle: null, wiped: false };
    const descriptor = present(decision, variant, {
      route: route || null,
      selfhelp,
      preview,
      localCount: adv.n,
      onWipe: () => {
        // The person asked this device to forget. Nothing may be written back afterwards.
        exposure.wiped = true;
        try { store?.removeItem(STORAGE_KEY); } catch { /* nothing to wipe */ }
      },
      onAlt: () => { if (selfhelp?.url) openHelp(selfhelp.url); },
    });

    exposure.finish = (outcome, extra = null) => {
      if (exposure.finished) return;
      exposure.finished = true;
      exposure.stopRefocus?.();
      if (ACTED.has(outcome) && !exposure.wiped) {
        const cur = readState();
        if (!cur.__blocked) writeState(markActed(cur, now()));
      }
      // Exactly one record per exposure: whichever outcome comes first. A person
      // who looks away and later returns is still ONE exposure, so the
      // click-through denominator equals real exposures.
      const sent = send.event({
        i: install,
        v: variant,
        f: decision.format,
        t: normaliseType(type),
        o: outcome,
        r: (outcome === 'clicked_help' && exposure.altRoute) || route?.id || 'xx-none',
        e: decision.bucket,
      }, { unloading: outcome === 'left_page' });
      // The frame must outlive the request: when the loader removes the iframe,
      // Firefox cancels a fetch still in flight, which silently loses the outcome.
      // So settle once the send is done — bounded, so a hung network never keeps a
      // layer over the page. A page that is already unloading (left_page) cannot wait.
      if (outcome === 'left_page') onSettled();
      else Promise.race([Promise.all([sent, extra]), new Promise((r) => setTimeout(r, SETTLE_MAX_MS))]).finally(onSettled);
    };

    const handle = mount(descriptor, {
      doc,
      onOutcome: ({ outcome }) => {
        // route-less primary is a plain close, never a help click
        if (outcome === 'section:alt') exposure.altRoute = selfhelp?.id;
        const mapped = outcome === 'primary' && !route?.url ? 'continued' : (outcome === 'tertiary' ? 'continued' : (CONTRACT[outcome] || 'timeout'));
        // "This warning was a mistake": counted as the person continuing, plus a
        // content-free report. The reason is always 'other' — the Door never asks a
        // visitor to say who they are; categories come from the platform's admin (Desk).
        const report = outcome === 'tertiary'
          ? send.report({ i: install, p: String(routes?.version || 'unknown').toLowerCase(), t: normaliseType(type), r: 'other' })
          : null;
        exposure.finish(mapped, report);
      },
    });
    exposure.handle = handle;
    // The loader focuses this frame when it reveals it, which can land after the
    // card focused its primary action and leave focus on the frame's body (seen in
    // WebKit). Put focus back into the dialog whenever the window gains it.
    // It must never fight the person: once they press a key or a pointer, they own focus.
    let interacted = false;
    const mark = () => { interacted = true; };
    w.addEventListener?.('keydown', mark, true);
    w.addEventListener?.('pointerdown', mark, true);
    const refocus = () => {
      const root = handle.el?.shadowRoot;
      if (!interacted && root && !root.activeElement) root.querySelector('[data-act="primary"]')?.focus();
    };
    w.addEventListener?.('focus', refocus);
    // The frame is visibility:hidden until the loader reveals it, and an element in a
    // hidden frame cannot take focus — so a focus attempt made before the reveal is lost.
    const retries = [60, 150, 300, 600, 1200].map((ms) => setTimeout(refocus, ms));
    exposure.stopRefocus = () => {
      w.removeEventListener?.('focus', refocus); w.removeEventListener?.('keydown', mark, true); w.removeEventListener?.('pointerdown', mark, true);
      retries.forEach(clearTimeout);
    };
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
