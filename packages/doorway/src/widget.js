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
    nl: { h: 'Dit is strafbaar', b: 'Sinds 1 juli 2024 valt dit onder artikel 252 van het Wetboek van Strafrecht. Zoeken en bekijken is strafbaar. Een veroordeling betekent een strafblad, een taakstraf tot 240 uur en een proeftijd die tot tien jaar kan duren.' },
    en: { h: 'This is a criminal offence', b: 'Since 1 July 2024 this falls under article 252 of the Dutch Criminal Code. Searching for and viewing this material is an offence. A conviction means a criminal record, up to 240 hours of community service, and a probation period of up to ten years.' },
  },
  harm: {
    nl: { h: 'Elke foto is een kind', b: 'Elke afbeelding laat misbruik van een echt kind zien, en elke keer dat ernaar wordt gezocht, is er vraag naar meer.' },
    en: { h: 'Every image is a child', b: 'Each image records abuse of a real child, and every search is a signal that more should be made.' },
  },
  control: {
    nl: { h: 'Je kunt hier stoppen', b: 'Mensen die dit gebruiken stoppen vaak met hulp. Dat kan anoniem, en je hoeft je naam niet te geven.' },
    en: { h: 'You can stop here', b: 'People who use this often stop, with help. It can be anonymous, and you never have to give your name.' },
  },
  quiet: {
    nl: { h: '', b: 'Hulp is er, anoniem.' },
    en: { h: '', b: 'Help exists, anonymously.' },
  },
};

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

  function mount(decision) {
    const msg = (copy[decision.family] || copy.legal);
    const need = decision.format === 'chat' ? 'human' : 'any';
    const { route } = resolve(langTag, routes, { need });
    const t = msg[L];

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

    let handle;
    handle = mount(descriptor, {
      onOutcome: ({ outcome }) => onEvent({
        outcome,
        format: decision.format,
        family: decision.family,
        routeId: route?.id,
      }),
    });
    return handle;
  }

  let active = null;

  function trigger({ type = 'search' } = {}) {
    if (active?.host?.isConnected) return active;
    const st = readState();
    const blocked = st.__blocked === true;
    const decision = pick(st, config, Date.now(), { storageBlocked: blocked });
    const variant = variantFor(decision.family, st.seen || []);
    active = mount(decision);

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

  return { trigger };
}
