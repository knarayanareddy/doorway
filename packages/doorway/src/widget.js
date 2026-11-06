/**
 * The Door — shadow-DOM mounted so no platform CSS can break it and it cannot
 * break theirs. Renders five formats from the Shift's decision.
 *
 * NOT unit-tested in CI (needs a DOM). Logic lives in core/ where it IS tested.
 * Manual acceptance tests: keyboard-only pass, screen-reader pass, 320px width.
 */
import { pick, advance, variantFor } from '../../core/src/shift.js';
import { resolve } from '../../core/src/route.js';
import { build } from '../../core/src/counter.js';
import { buildCard, mount } from '../../shared/card.js';

const STORAGE_KEY = 'doorway:v1';

/* presentation lives in packages/shared/card.js */

const copy = {
  legal: {
    nl: [
      { h: 'Dit is strafbaar', b: 'Sinds 1 juli 2024 valt dit onder artikel 252 van het Wetboek van Strafrecht. Zoeken en bekijken is strafbaar. Een veroordeling betekent een strafblad, een taakstraf tot 240 uur en een proeftijd die tot tien jaar kan duren.' },
      { h: 'Dit is strafbaar', b: 'Artikel 252 van het Wetboek van Strafrecht: opzettelijk zoeken naar of bekijken van dit materiaal is een misdrijf. De maximale taakstraf is 240 uur, en een strafblad blijft staan.' },
      { h: 'Dit is strafbaar', b: 'Sinds 1 juli 2024 is dit een misdrijf in Nederland. Het Openbaar Ministerie vervolgt het, en de straffen zijn in 2024 verhoogd. Wat je nu doet, is strafbaar.' },
    ],
    en: [
      { h: 'This is a criminal offence', b: 'Since 1 July 2024 this falls under article 252 of the Dutch Criminal Code. Searching for and viewing this material is an offence. A conviction means a criminal record, up to 240 hours of community service, and a probation period of up to ten years.' },
      { h: 'This is a criminal offence', b: 'Article 252 of the Dutch Criminal Code: deliberately searching for or viewing this material is a crime. The maximum community service order is 240 hours and a criminal record is permanent.' },
      { h: 'This is a criminal offence', b: 'Since 1 July 2024 this is a criminal offence in the Netherlands, and the public prosecutor does pursue it. Sentences were raised in 2024. What you are doing now is criminal.' },
    ],
  },
  harm: {
    nl: [
      { h: 'Elke foto is een kind', b: 'Elke afbeelding laat misbruik van een echt kind zien, en elke keer dat ernaar wordt gezocht, is er vraag naar meer.' },
      { h: 'Elke foto is een kind', b: 'Achter elke afbeelding staat een kind dat misbruikt is, vaak jarenlang. Elke zoekopdracht maakt de vraag groter.' },
      { h: 'Elke foto is een kind', b: 'Dit materiaal is een opname van misbruik. Het kind bestaat, het misbruik is echt, en het is nooit met instemming gebeurd.' },
    ],
    en: [
      { h: 'Every image is a child', b: 'Each image records abuse of a real child, and every search is a signal that more should be made.' },
      { h: 'Every image is a child', b: 'Behind every image is a child who was abused, often over years. Each search makes the demand larger.' },
      { h: 'Every image is a child', b: 'This material is a recording of abuse. The child exists, the abuse was real, and it never happened with consent.' },
    ],
  },
  control: {
    nl: [
      { h: 'Je kunt hier stoppen', b: 'Mensen die dit gebruiken stoppen vaak met hulp. Dat kan anoniem, en je hoeft je naam niet te geven.' },
      { h: 'Je kunt hier stoppen', b: 'Stoppen lukt vaker met iemand erbij dan alleen. De preventielijn is er voor precies dit, en je hoeft niets te bekennen.' },
      { h: 'Je kunt hier stoppen', b: 'Je bent niet de enige die dit meemaakt, en er is hulp die werkt. Een eerste gesprek verplicht tot niets.' },
    ],
    en: [
      { h: 'You can stop here', b: 'People who use this often stop, with help. It can be anonymous, and you never have to give your name.' },
      { h: 'You can stop here', b: 'Stopping works better with someone alongside you than alone. That is what the prevention line is for, and you do not have to admit anything.' },
      { h: 'You can stop here', b: 'You are not the only person this happens to, and there is help that works. A first conversation commits you to nothing.' },
    ],
  },
  quiet: {
    nl: [
      { h: '', b: 'Hulp is er, anoniem.' },
      { h: '', b: 'De preventielijn is er nog steeds, anoniem.' },
      { h: '', b: 'Hulp blijft beschikbaar, zonder naam.' },
    ],
    en: [
      { h: '', b: 'Help exists, anonymously.' },
      { h: '', b: 'The prevention line is still there, anonymously.' },
      { h: '', b: 'Help stays available, no name needed.' },
    ],
  },
};


/** The copy index encoded in a variant id like "legal-02" — 0 when absent. */
export function variantIndex(variantId) {
  const m = /-0(\d)$/.exec(String(variantId || ''));
  return m ? Math.max(0, Number(m[1]) - 1) : 0;
}

export function createDoorway({ config, routes, endpoint, lang, onEvent } = {}) {
  const langTag = lang || navigator.language || 'en';
  const base = (langTag.split('-')[0] || 'en').toLowerCase();
  const L = copy.legal[base] ? base : 'en';

  const readState = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return { __blocked: true }; }
  };
  const writeState = (s) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
    catch { /* private mode — DEGRADED path already handles this */ }
  };

  function present(decision, variantId) {
    const family = copy[decision.family] || copy.legal;
    const need = decision.format === 'chat' ? 'human' : 'any';
    const { route } = resolve(langTag, routes, { need });
    const variants = family[L] || family.en;
    const t = variants[variantIndex(variantId)] || variants[0];

    const descriptor = buildCard({
      variant: decision.format,
      headline: t.h,
      body: t.b,
      lang: L,
      attribution: L === 'nl' ? 'Deze site & Offlimits' : 'This site & Offlimits',
      primary: {
        label: L === 'nl' ? 'Bekijk anonieme hulp' : 'See anonymous help',
        kind: 'primary',
        onSelect: () => { if (route?.url) window.location.assign(route.url); },
      },
      secondary: {
        label: L === 'nl' ? 'Ik zoek iets anders' : 'I am here for something else',
        kind: 'secondary',
      },
      footnote: L === 'nl'
        ? 'Hulp via de preventielijn. Wat je deelt blijft vertrouwelijk.'
        : 'Help is via the prevention line. What you share stays confidential.',
    });

    return mount(descriptor, {
      onOutcome: ({ outcome }) => {
        // card.js speaks in actions (primary/secondary/dismiss); the plug-in
        // contract speaks in outcomes. This is the only translation point.
        const CONTRACT = {
          primary: 'clicked_help',
          secondary: 'continued',
          dismiss: 'dismissed',
          timeout: 'timeout',
        };
        const mapped = CONTRACT[outcome] || 'timeout';
        if (outcomeSink) outcomeSink(mapped);
        else if (typeof onEvent === 'function') {
          onEvent({ outcome, format: decision.format, family: decision.family, routeId: route?.id });
        }
      },
    });
  }

  /**
   * Step the Shift and mount whatever it picks. This is the entry point the
   * sbis adapter uses: the platform has already decided a trigger fired, and
   * severity says whether to interrupt at all — the Shift decides the form, and
   * the local counter decides how many times this person has been spoken to.
   */
  function step() {
    const st = readState();
    const blocked = st.__blocked === true;
    const decision = pick(st, config, Date.now(), { storageBlocked: blocked });
    const variant = variantFor(decision.family, st.seen || []);
    const handle = present(decision, variant);
    writeState(advance(blocked ? {} : st, variant, Date.now()));
    return { decision, variant, handle };
  }

  let active = null;

  function trigger({ type = 'search' } = {}) {
    if (active?.host?.isConnected) return active;
    const st = readState();
    const blocked = st.__blocked === true;
    const decision = pick(st, config, Date.now(), { storageBlocked: blocked });
    const variant = variantFor(decision.family, st.seen || []);
    active = present(decision, variant);

    writeState(advance(blocked ? {} : st, variant, Date.now()));

    const emit = onEvent || ((e) => {
      if (!endpoint) return;
      const payload = { i: endpoint.install, v: variant, f: e.format, t: type, o: e.outcome, r: e.routeId || 'none', e: decision.bucket, b: new Date().getHours() };
      const res = build(payload);
      if (!res.ok) return;                       // never send an invalid payload
      fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(res.payload),
        keepalive: true,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      }).catch(() => { /* lost count beats a buffered identifier */ });
    });
    active.onEvent = emit;
    return active;
  }

  /** The adapter registers here to learn what the person did. */
  let outcomeSink = typeof onEvent === 'function' ? onEvent : null;
  function onOutcome(fn) { outcomeSink = fn; }

  return { trigger, step, onOutcome };
}
