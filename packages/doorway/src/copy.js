/**
 * Every string a visitor can read. Pure data and pure functions, so CI can lint
 * it in every language (review H7, M5) and the widget cannot drift from it.
 *
 * Rules enforced in scripts/lint-copy.mjs:
 *   - no sentence over 20 words, in any language
 *   - no confidentiality words here at all — a service's own confidentiality
 *     wording appears ONLY through footnoteFor(), and only when
 *     isRenderableConfidence() says the record is verified (review B3)
 *   - no number followed by a unit of time — penalties live in reviewed legal
 *     records, not in this file (review B8)
 */
import { isRenderableConfidence, isHuman } from '../../core/src/route.js';
import { legalRecordFor } from '../../core/src/legal.js';
import { LEGAL_RECORDS } from './legal-records.js';

export const LANGS = Object.freeze(['nl', 'en', 'de']);
export const langOf = (tag) => {
  const b = String(tag || 'en').toLowerCase().split(/[-_]/)[0];
  return LANGS.includes(b) ? b : 'en';
};

export const HARM = {
  nl: [
    { h: 'Elke foto is een kind', b: 'Elke afbeelding laat misbruik van een echt kind zien. Elke zoekopdracht maakt de vraag naar meer groter.' },
    { h: 'Een kind op elke foto', b: 'Achter elke afbeelding staat een kind dat misbruikt is, vaak jarenlang. Toegang creëert vraag.' },
    { h: 'Dit is kindermisbruik', b: 'Dit materiaal is een opname van misbruik. Het kind bestaat, het misbruik is echt, en het gebeurde nooit met instemming.' },
  ],
  en: [
    { h: 'Every image is a child', b: 'Each image records abuse of a real child. Every access creates demand for more.' },
    { h: 'A child in every image', b: 'Behind every image is a child who was abused, often over years. Access drives demand.' },
    { h: 'This records child abuse', b: 'This material is a recording of abuse. The child exists, the abuse was real, and it never happened with consent.' },
  ],
  de: [
    { h: 'Jedes Bild ist ein Kind', b: 'Jedes Bild dokumentiert den Missbrauch eines echten Kindes. Jeder Zugriff schafft Nachfrage.' },
    { h: 'Ein Kind in jedem Bild', b: 'Hinter jedem Bild steht ein missbrauchtes Kind, oft über Jahre. Zugriff treibt die Nachfrage an.' },
    { h: 'Dies dokumentiert Kindesmissbrauch', b: 'Dieses Material dokumentiert Missbrauch. Das Kind existiert, der Missbrauch war real, und es geschah nie mit Einwilligung.' },
  ],
};

/** Shown when no reviewed legal record applies. Same gravity, no legal claim. */
export const NEUTRAL_LEGAL = {
  nl: [
    { h: 'Dit materiaal is misbruik van een kind', b: 'Elke afbeelding is een opname van echt misbruik. Er is hulp voor wie wil stoppen.' },
    { h: 'Dit materiaal is misbruik van een kind', b: 'Achter elke afbeelding staat een kind dat misbruikt is. Stoppen kan, met hulp.' },
    { h: 'Dit materiaal is misbruik van een kind', b: 'Dit is een opname van misbruik van een echt kind. Er is hulp die werkt.' },
  ],
  en: [
    { h: 'This material records the abuse of a child', b: 'Every image is a recording of real abuse. There is help for anyone who wants to stop.' },
    { h: 'This material records the abuse of a child', b: 'Behind every image is a child who was abused. Stopping is possible, with help.' },
    { h: 'This material records the abuse of a child', b: 'This material is a recording of a real child being abused. There is help that works.' },
  ],
  de: [
    { h: 'Dieses Material dokumentiert den Missbrauch eines Kindes', b: 'Jedes Bild ist eine Aufzeichnung von echtem Missbrauch. Es gibt Hilfe für alle, die aufhören wollen.' },
    { h: 'Dieses Material dokumentiert den Missbrauch eines Kindes', b: 'Hinter jedem Bild steht ein missbrauchtes Kind. Aufhören ist möglich, mit Hilfe.' },
    { h: 'Dieses Material dokumentiert den Missbrauch eines Kindes', b: 'Dieses Material dokumentiert den Missbrauch eines echten Kindes. Es gibt Hilfe, die funktioniert.' },
  ],
};

/**
 * The "stopping is possible" copy depends on what the button actually opens
 * (review M6): a person to talk to, an intake programme, a web page, or nothing.
 */
export const CONTROL = {
  human: {
    nl: [
      { h: 'Stoppen is mogelijk', b: 'Mensen die dit gebruiken stoppen vaak met hulp. Je kunt met iemand praten.' },
      { h: 'Er is hulp', b: 'Stoppen lukt vaker met iemand erbij dan alleen. Er is een persoon om mee te praten.' },
      { h: 'Ondersteuning bestaat', b: 'Veel mensen hebben deze hulp nodig, en hulp werkt. Een eerste gesprek verplicht tot niets.' },
    ],
    en: [
      { h: 'Stopping is possible', b: 'People who use this often stop, with help. You can talk to a person.' },
      { h: 'Help is available', b: 'Stopping works better with someone alongside you than alone. A person is there to talk to.' },
      { h: 'Support exists', b: 'Many people have needed this kind of help, and help works. A first conversation commits you to nothing.' },
    ],
    de: [
      { h: 'Aufhören ist möglich', b: 'Menschen, die das nutzen, hören oft mit Hilfe auf. Du kannst mit jemandem sprechen.' },
      { h: 'Hilfe ist verfügbar', b: 'Aufhören gelingt leichter mit jemand an der Seite als allein. Es gibt eine Person zum Sprechen.' },
      { h: 'Unterstützung existiert', b: 'Viele Menschen haben diese Hilfe nötig, und Hilfe wirkt. Ein erstes Gespräch verpflichtet zu nichts.' },
    ],
  },
  programme: {
    nl: [
      { h: 'Stoppen is mogelijk', b: 'Mensen die dit gebruiken stoppen vaak met hulp. Er is een behandelprogramma met een intakegesprek.' },
      { h: 'Er is hulp', b: 'Stoppen lukt vaker met begeleiding. Het programma begint met een intake.' },
      { h: 'Ondersteuning bestaat', b: 'Veel mensen hebben deze hulp nodig, en hulp werkt. Een intake verplicht tot niets.' },
    ],
    en: [
      { h: 'Stopping is possible', b: 'People who use this often stop, with help. There is a treatment programme that starts with an intake.' },
      { h: 'Help is available', b: 'Stopping works better with guidance than alone. The programme begins with an intake appointment.' },
      { h: 'Support exists', b: 'Many people have needed this kind of help, and help works. An intake commits you to nothing.' },
    ],
    de: [
      { h: 'Aufhören ist möglich', b: 'Menschen, die das nutzen, hören oft mit Hilfe auf. Es gibt ein Behandlungsprogramm mit einem Erstgespräch.' },
      { h: 'Hilfe ist verfügbar', b: 'Aufhören gelingt leichter mit Begleitung als allein. Das Programm beginnt mit einem Erstgespräch.' },
      { h: 'Unterstützung existiert', b: 'Viele Menschen haben diese Hilfe nötig, und Hilfe wirkt. Ein Erstgespräch verpflichtet zu nichts.' },
    ],
  },
  selfhelp: {
    nl: [
      { h: 'Stoppen is mogelijk', b: 'Mensen die dit gebruiken stoppen vaak met hulp. Er is een zelfhulpprogramma online.' },
      { h: 'Er is hulp', b: 'Stoppen lukt vaker met steun dan alleen. Er is een programma dat je zelf kunt volgen.' },
      { h: 'Ondersteuning bestaat', b: 'Veel mensen hebben deze hulp nodig, en hulp werkt. Je begint op je eigen tempo.' },
    ],
    en: [
      { h: 'Stopping is possible', b: 'People who use this often stop, with help. There is a self-help programme online.' },
      { h: 'Help is available', b: 'Stopping works better with support than alone. There is a programme you can follow yourself.' },
      { h: 'Support exists', b: 'Many people have needed this kind of help, and help works. You can start at your own pace.' },
    ],
    de: [
      { h: 'Aufhören ist möglich', b: 'Menschen, die das nutzen, hören oft mit Hilfe auf. Es gibt ein Selbsthilfeprogramm online.' },
      { h: 'Hilfe ist verfügbar', b: 'Aufhören gelingt leichter mit Unterstützung als allein. Es gibt ein Programm, das du selbst nutzen kannst.' },
      { h: 'Unterstützung existiert', b: 'Viele Menschen haben diese Hilfe nötig, und Hilfe wirkt. Du beginnst in deinem eigenen Tempo.' },
    ],
  },
  none: {
    nl: [
      { h: 'Stoppen is mogelijk', b: 'Mensen die dit gebruiken stoppen vaak met hulp.' },
      { h: 'Er is hulp', b: 'Stoppen lukt vaker met steun dan alleen.' },
      { h: 'Ondersteuning bestaat', b: 'Veel mensen hebben deze hulp nodig, en hulp werkt.' },
    ],
    en: [
      { h: 'Stopping is possible', b: 'People who use this often stop, with help.' },
      { h: 'Help is available', b: 'Stopping works better with support than alone.' },
      { h: 'Support exists', b: 'Many people have needed this kind of help, and help works.' },
    ],
    de: [
      { h: 'Aufhören ist möglich', b: 'Menschen, die das nutzen, hören oft mit Hilfe auf.' },
      { h: 'Hilfe ist verfügbar', b: 'Aufhören gelingt leichter mit Unterstützung als allein.' },
      { h: 'Unterstützung existiert', b: 'Viele Menschen haben diese Hilfe nötig, und Hilfe wirkt.' },
    ],
  },
};

/** The quiet pill (review M2): short, and neutral about who the help is for. */
export const QUIET = {
  nl: [{ h: 'Hulp is er.', b: '' }, { h: 'Hulp blijft beschikbaar.', b: '' }, { h: 'Er is steun als je die wilt.', b: '' }],
  en: [{ h: 'Help exists.', b: '' }, { h: 'Help stays available.', b: '' }, { h: 'Support is there if you want it.', b: '' }],
  de: [{ h: 'Hilfe ist da.', b: '' }, { h: 'Hilfe bleibt verfügbar.', b: '' }, { h: 'Unterstützung ist da, wenn du sie willst.', b: '' }],
};

export const controlKind = (route) => {
  if (!route) return 'none';
  if (route.channel === 'selfhelp' || route.capacity === 'selfhelp') return 'selfhelp';
  if (route.channel === 'programme') return 'programme';
  return isHuman(route) ? 'human' : 'none';
};

/**
 * Which three variants to rotate through. Format decides first (a quiet pill is
 * never the harm paragraph), then family.
 *
 * @param {{format:string, family:string, lang:string, route?:object|null,
 *          legalJurisdiction?:string|null, now?:number, legalRecords?:object[]}} a
 */
export function copyFor({ format, family, lang, route = null, legalJurisdiction = null, now = Date.now(), legalRecords = LEGAL_RECORDS }) {
  const L = langOf(lang);
  if (format === 'quiet') return QUIET[L];
  if (family === 'legal') {
    const rec = legalRecordFor(legalJurisdiction, legalRecords, now);
    return (rec ? rec.copy : NEUTRAL_LEGAL)[L] || NEUTRAL_LEGAL[L];
  }
  if (family === 'control') return CONTROL[controlKind(route)][L];
  return HARM[L];
}

export const LABELS = {
  primary: { nl: 'Bekijk hulp', en: 'See help', de: 'Hilfe ansehen' },
  close: { nl: 'Sluiten', en: 'Close', de: 'Schließen' },
  // Equal in weight to the primary action: a person who is here for something
  // else must be able to leave without hunting for the exit (review H4).
  secondary: { nl: 'Ik zoek iets anders', en: 'I am here for something else', de: 'Ich bin aus einem anderen Grund hier' },
};

/**
 * Neutral attribution (review H5). It states who is showing this and that the
 * service is independent — never that the two are partners.
 */
export function attributionFor(route, lang) {
  const L = langOf(lang);
  if (!route) return { nl: 'Getoond door deze site', en: 'Shown by this site', de: 'Angezeigt von dieser Website' }[L];
  return {
    nl: `Getoond door deze site · hulp van ${route.name}, een onafhankelijke dienst`,
    en: `Shown by this site · help from ${route.name}, an independent service`,
    de: `Angezeigt von dieser Website · Hilfe von ${route.name}, einem unabhängigen Dienst`,
  }[L];
}

/**
 * The footnote describes the service the button actually opens. It may quote a
 * confidentiality claim ONLY when isRenderableConfidence() is true — the same
 * predicate assertHonest() and CI use. Otherwise it is neutral.
 */
export function footnoteFor(route, lang, now = Date.now()) {
  const L = langOf(lang);
  if (!route) return { nl: 'Er is hulp.', en: 'There is help.', de: 'Es gibt Hilfe.' }[L];
  if (route.channel === 'selfhelp' || route.capacity === 'selfhelp') {
    return { nl: 'Zelfhulp, gratis en zonder account.', en: 'Self-help, free and without an account.', de: 'Selbsthilfe, kostenlos und ohne Konto.' }[L];
  }
  if (route.channel === 'programme') {
    return { nl: 'Behandelprogramma met een intakegesprek.', en: 'Treatment programme with an intake appointment.', de: 'Behandlungsprogramm mit einem Erstgespräch.' }[L];
  }
  if (isRenderableConfidence(route, now)) return route.conf.text;
  return { nl: 'Hulp, gratis.', en: 'Help, free.', de: 'Hilfe, kostenlos.' }[L];
}

/** The copy index encoded in a variant id like "legal-02" — 0 when absent. */
export function variantIndex(variantId) {
  const m = /-0(\d)$/.exec(String(variantId || ''));
  return m ? Math.max(0, Number(m[1]) - 1) : 0;
}

/** Every user-visible string, for the linter. */
export function allStrings() {
  const out = [];
  const walk = (v, path) => {
    if (typeof v === 'string') out.push({ path, text: v });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  walk(HARM, 'HARM'); walk(NEUTRAL_LEGAL, 'NEUTRAL_LEGAL'); walk(CONTROL, 'CONTROL');
  walk(QUIET, 'QUIET'); walk(LABELS, 'LABELS');
  for (const L of LANGS) {
    out.push({ path: `attribution.${L}`, text: attributionFor({ name: 'X' }, L) });
    for (const kind of ['selfhelp', 'programme']) out.push({ path: `footnote.${kind}.${L}`, text: footnoteFor({ channel: kind }, L) });
    out.push({ path: `footnote.neutral.${L}`, text: footnoteFor({ channel: 'phone' }, L) });
  }
  return out;
}
