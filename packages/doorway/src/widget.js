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
  harm: {
    nl: [
      { h: 'Elke foto is een kind', b: 'Elke afbeelding laat misbruik van een echt kind zien, en elke keer dat ernaar wordt gezocht, is er vraag naar meer.' },
      { h: 'Elke foto is een kind', b: 'Achter elke afbeelding staat een kind dat misbruikt is, vaak jarenlang. Toegang creëert vraag.' },
      { h: 'Elke foto is een kind', b: 'Dit materiaal is een opname van misbruik. Het kind bestaat, het misbruik is echt, en het is nooit met instemming gebeurd.' },
    ],
    en: [
      { h: 'Every image is a child', b: 'Each image records abuse of a real child. Every access creates demand for more.' },
      { h: 'Every image is a child', b: 'Behind every image is a child who was abused, often over years. Access drives demand.' },
      { h: 'Every image is a child', b: 'This material is a recording of abuse. The child exists, the abuse was real, and it never happened with consent.' },
    ],
    de: [
      { h: 'Jedes Bild ist ein Kind', b: 'Jedes Bild dokumentiert den Missbrauch eines echten Kindes. Jeder Zugriff schafft Nachfrage.' },
      { h: 'Jedes Bild ist ein Kind', b: 'Hinter jedem Bild steht ein missbrauchtes Kind, oft über Jahre. Zugriff treibt die Nachfrage an.' },
      { h: 'Jedes Bild ist ein Kind', b: 'Dieses Material dokumentiert Missbrauch. Das Kind existiert, der Missbrauch war real, und es geschah nie mit Einwilligung.' },
    ],
  },
  control: {
    nl: [
      { h: 'Je kunt hier stoppen', b: 'Mensen die dit gebruiken stoppen vaak met hulp. Dat kan anoniem, en je hoeft je naam niet te geven.' },
      { h: 'Je kunt hier stoppen', b: 'Stoppen lukt vaker met iemand erbij dan alleen. De preventielijn is er voor precies dit, en je hoeft niets te bekennen.' },
      { h: 'Je kunt hier stoppen', b: 'Veel mensen hebben deze hulp nodig, en er is hulp die werkt. Een eerste gesprek verplicht tot niets.' },
    ],
    en: [
      { h: 'You can stop here', b: 'People who use this often stop, with help. It can be anonymous, and you never have to give your name.' },
      { h: 'You can stop here', b: 'Stopping works better with someone alongside you than alone. That is what the prevention line is for, and you do not have to admit anything.' },
      { h: 'You can stop here', b: 'Many people have needed this kind of help, and help works. A first conversation commits you to nothing.' },
    ],
    de: [
      { h: 'Du kannst hier aufhören', b: 'Menschen, die das nutzen, hören oft mit Hilfe auf. Es kann anonym sein, und du musst deinen Namen nicht nennen.' },
      { h: 'Du kannst hier aufhören', b: 'Aufhören gelingt leichter mit jemand an der Seite als allein. Dafür gibt es die Präventionslinie, und du musst nichts gestehen.' },
      { h: 'Du kannst hier aufhören', b: 'Viele Menschen haben diese Hilfe nötig, und Hilfe wirkt. Ein erstes Gespräch verpflichtet zu nichts.' },
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
    de: [
      { h: '', b: 'Hilfe ist da, anonym.' },
      { h: '', b: 'Die Präventionslinie ist noch da, anonym.' },
      { h: '', b: 'Hilfe bleibt verfügbar, ohne Namen.' },
    ],
  },
};

/**
 * The statute is jurisdiction-specific. We only ship a verified citation for
 * the Netherlands (article 252 Sr, in force 1 July 2024). Asserting it to a
 * person in Germany, Britain or Finland would be a false legal claim made to
 * someone in crisis. Outside NL the card states no offence at all and leads
 * with help — it stays a warning, it stops being a legal claim.
 *
 * Do not add foreign statutes without a named source in routes.nl.json.
 */
export function legalCopy(country) {
  if (country === 'NL') {
    return {
      nl: [
        { h: 'Dit is strafbaar', b: 'Sinds 1 juli 2024 valt dit onder artikel 252 van het Wetboek van Strafrecht. Zoeken en bekijken is strafbaar. Een veroordeling betekent een strafblad, een taakstraf tot 240 uur, een proeftijd die tot tien jaar kan duren, of gevangenisstraf.' },
        { h: 'Dit is strafbaar', b: 'Artikel 252 van het Wetboek van Strafrecht: opzettelijk zoeken naar of bekijken van dit materiaal is een misdrijf. De maximale taakstraf is 240 uur, en een strafblad blijft staan.' },
        { h: 'Dit is strafbaar', b: 'Sinds 1 juli 2024 is dit een misdrijf in Nederland. Het Openbaar Ministerie vervolgt het, en de straffen zijn in 2024 verhoogd.' },
      ],
      en: [
        { h: 'This is a criminal offence', b: 'Since 1 July 2024 this falls under article 252 of the Dutch Criminal Code. Searching for and viewing this material is an offence. A conviction means a criminal record, up to 240 hours of community service, a probation period of up to ten years, or imprisonment.' },
        { h: 'This is a criminal offence', b: 'Article 252 of the Dutch Criminal Code: deliberately searching for or viewing this material is a crime. The maximum community service order is 240 hours and a criminal record is permanent.' },
        { h: 'This is a criminal offence', b: 'Since 1 July 2024 this is a criminal offence in the Netherlands, and the public prosecutor does pursue it. Sentences were raised in 2024.' },
      ],
      de: [
        { h: 'Dies ist eine Straftat', b: 'Seit dem 1. Juli 2024 fällt dies unter Artikel 252 des niederländischen Strafgesetzbuchs. Das Aufsuchen und Betrachten dieses Materials ist eine Straftat. Eine Verurteilung bedeutet ein Strafregister, bis zu 240 Stunden gemeinnützige Arbeit, eine Bewährungszeit von bis zu zehn Jahren oder Freiheitsstrafe.' },
        { h: 'Dies ist eine Straftat', b: 'Artikel 252 des niederländischen Strafgesetzbuchs: das vorsätzliche Aufsuchen oder Betrachten dieses Materials ist ein Verbrechen. Die maximale gemeinnützige Arbeit beträgt 240 Stunden und ein Strafregistereintrag ist dauerhaft.' },
        { h: 'Dies ist eine Straftat', b: 'Seit dem 1. Juli 2024 ist dies in den Niederlanden eine Straftat, und die Staatsanwaltschaft verfolgt sie. Die Strafen wurden 2024 erhöht.' },
      ],
    };
  }
  // Elsewhere: same gravity, no legal claim. States what the material is and
  // that help exists — never what a foreign court would do.
  return {
    nl: [
      { h: 'Dit materiaal is misbruik van een kind', b: 'Elke afbeelding is een opname van echt misbruik. Er is hulp voor wie wil stoppen, en je hoeft je naam niet te geven.' },
      { h: 'Dit materiaal is misbruik van een kind', b: 'Achter elke afbeelding staat een kind dat misbruikt is. Stoppen kan, met hulp, en anoniem als je dat wil.' },
      { h: 'Dit materiaal is misbruik van een kind', b: 'Dit is een opname van misbruik van een echt kind. Er is hulp die werkt.' },
    ],
    en: [
      { h: 'This material records the abuse of a child', b: 'Every image is a recording of real abuse. There is help for anyone who wants to stop, and you do not have to give your name.' },
      { h: 'This material records the abuse of a child', b: 'Behind every image is a child who was abused. Stopping is possible, with help, and anonymously if you prefer.' },
      { h: 'This material records the abuse of a child', b: 'This material is a recording of a real child being abused. There is help that works.' },
    ],
    de: [
      { h: 'Dieses Material dokumentiert den Missbrauch eines Kindes', b: 'Jedes Bild ist eine Aufzeichnung von echtem Missbrauch. Es gibt Hilfe für alle, die aufhören wollen, ohne den Namen nennen zu müssen.' },
      { h: 'Dieses Material dokumentiert den Missbrauch eines Kindes', b: 'Hinter jedem Bild steht ein missbrauchtes Kind. Aufhören ist möglich, mit Hilfe, und anonym, wenn man möchte.' },
      { h: 'Dieses Material dokumentiert den Missbrauch eines Kindes', b: 'Dieses Material dokumentiert den Missbrauch eines echten Kindes. Es gibt Hilfe, die funktioniert.' },
    ],
  };
}

/**
 * The footnote must describe the service the button actually opens. It may only
 * promise confidentiality when the route carries a verified `conf` basis, which
 * is the same condition assertHonest() enforces for human routes.
 */
export function footnoteFor(route, L) {
  if (!route) {
    return L === 'nl'
      ? 'Er is hulp. Je hoeft je naam niet te geven.'
      : L === 'de'
        ? 'Es gibt Hilfe. Sie müssen Ihren Namen nicht nennen.'
        : 'There is help. You do not have to give your name.';
  }
  if (route.capacity === 'selfhelp' || route.channel === 'selfhelp') {
    return L === 'nl'
      ? 'Zelfhulp, gratis en zonder account.'
      : L === 'de'
        ? 'Selbsthilfe, kostenlos und ohne Konto.'
        : 'Self-help, free and without an account.';
  }
  if (!route.conf || /verify|todo|unknown|confirm|site/i.test(route.conf)) {
    return L === 'nl'
      ? 'Hulp, gratis en anoniem.'
      : L === 'de'
        ? 'Hilfe, kostenlos und anonym.'
        : 'Help, free and anonymous.';
  }
  return L === 'nl'
    ? 'Hulp, gratis en vertrouwelijk.'
    : L === 'de'
      ? 'Hilfe, kostenlos und vertraulich.'
      : 'Help, free and confidential.';
}


/** The copy index encoded in a variant id like "legal-02" — 0 when absent. */
export function variantIndex(variantId) {
  const m = /-0(\d)$/.exec(String(variantId || ''));
  return m ? Math.max(0, Number(m[1]) - 1) : 0;
}

export function createDoorway({ config, routes, endpoint, lang, country, onEvent } = {}) {
  const langTag = lang || navigator.language || 'en';
  // `country` comes from the platform's trigger event and is a REQUIRED field
  // of PLUGIN_CONTRACT.md. It filters which help service is offered; it never
  // overrides language. See route.js.
  let countryCode = typeof country === 'string' ? country.toUpperCase() : null;
  const setCountry = (c) => { if (typeof c === 'string' && c.length === 2) countryCode = c.toUpperCase(); };
  const base = (langTag.split('-')[0] || 'en').toLowerCase();
  const L = /\b(nl|en|de)\b/.test(base) ? base : 'en';

  const readState = () => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return { __blocked: true }; }
  };
  const writeState = (s) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
    catch { /* private mode — DEGRADED path already handles this */ }
  };

  function present(decision, variantId) {
    const family = decision.family === 'legal'
      ? legalCopy(countryCode)
      : copy[decision.family];
    const need = decision.format === 'chat' ? 'human' : 'any';
    const { route } = resolve(langTag, routes, { need, country: countryCode });
    const variants = family[L] || family.en;
    const t = variants[variantIndex(variantId)] || variants[0];

    const descriptor = buildCard({
      variant: decision.format,
      headline: t.h,
      body: t.b,
      lang: L,
      attribution: route
        ? L === 'nl'
          ? `Deze site & ${route.name}`
          : `This site & ${route.name}`
        : L === 'nl'
          ? 'Deze site'
          : 'This site',
      primary: {
        label: L === 'nl' ? 'Bekijk anonieme hulp' : 'See anonymous help',
        kind: 'primary',
        onSelect: () => { if (route?.url) window.location.assign(route.url); },
      },
      secondary: {
        label: L === 'nl' ? 'Ik zoek iets anders' : 'I am here for something else',
        kind: 'secondary',
      },
      footnote: footnoteFor(route, L),
    });

    return { ...mount(descriptor, {
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
    }), routeId: route?.id ?? null };
  }

  /**
   * Step the Shift and mount whatever it picks. This is the entry point the
   * sbis adapter uses: the platform has already decided a trigger fired, and
   * severity says whether to interrupt at all — the Shift decides the form, and
   * the local counter decides how many times this person has been spoken to.
   */
  /** Shared logic: read state, run the Shift, present, and advance (unless habituated). */
  function runDecision() {
    const st = readState();
    const blocked = st.__blocked === true;
    const decision = pick(st, config, Date.now(), { storageBlocked: blocked });
    const variant = variantFor(decision.family, st.seen || []);
    const handle = present(decision, variant);
    // A habituated (quiet) exposure must not advance the counter or reset the
    // re-warning clock — that would silence heavy users forever. Only advance
    // when a real intervention was shown.
    if (decision.state !== 'HABITUATED') {
      writeState(advance(blocked ? {} : st, variant, Date.now()));
    }
    return { decision, variant, handle };
  }

  function step() {
    const { decision, variant, handle } = runDecision();
    return { setCountry, decision, variant, handle };
  }

  let active = null;

  function trigger({ type = 'search' } = {}) {
    if (active?.el?.isConnected) return active;
    const { decision, variant, handle } = runDecision();
    active = handle;
    const routeId = active?.routeId ?? null;

    // A habituated (quiet) exposure must not advance the counter or reset the
    // re-warning clock — that would silence heavy users forever. Only advance
    // when a real intervention was shown.
    if (decision.state !== 'HABITUATED') {
      writeState(advance(blocked ? {} : st, variant, Date.now()));
    }

    const onDecision = (mapped) => {
      if (typeof onEvent === 'function') {
        onEvent({ outcome: mapped, format: decision.format, family: decision.family, routeId });
        return;
      }
      if (!endpoint) return;
      const res = build({
        i: endpoint.install,
        v: variant,
        f: decision.format,
        t: type,
        o: mapped,
        r: routeId || 'xx-none',
        e: decision.bucket,
        b: new Date().getHours(),
      });
      if (!res.ok) return;                       // never send an invalid payload
      fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(res.payload),
        keepalive: true,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      }).catch(() => { /* lost count beats a buffered identifier */ });
    };
    outcomeSink = onDecision;
    return active;
  }

  /** The adapter registers here to learn what the person did. */
  let outcomeSink = typeof onEvent === 'function' ? onEvent : null;
  function onOutcome(fn) { outcomeSink = fn; }

  return { trigger, step, onOutcome };
}
