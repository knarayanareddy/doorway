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

/**
 * The Hallway — "what happens if I reach out?". Rehearse the contact before making it.
 * Nothing here says anything about a service's confidentiality or hours; those appear only
 * through the verified-record predicates (panels.js).
 */
export const HALLWAY = {
  nl: [
    { h: 'Voordat je contact opneemt', b: 'Veel mensen haken af bij het onbekende. Hier staat wat je kunt verwachten, en een eerste zin.' },
    { h: 'Je hebt geen verhaal nodig', b: 'Je kunt beginnen met één zin. Jij bepaalt hoe ver je gaat.' },
    { h: 'Contact kan klein beginnen', b: 'Een eerste bericht mag uit een paar woorden bestaan. Je kunt het rustig voorbereiden.' },
  ],
  en: [
    { h: 'Before you reach out', b: 'Many people stop at the unknown. Here is what to expect, and a first sentence you can use.' },
    { h: 'You do not need a story', b: 'You can begin with one sentence. You decide how far to take it.' },
    { h: 'Contact can start small', b: 'A first message can be a few words. You can prepare it at your own pace.' },
  ],
  de: [
    { h: 'Bevor du Kontakt aufnimmst', b: 'Viele Menschen scheuen das Unbekannte. Hier steht, was dich erwartet, und ein erster Satz.' },
    { h: 'Du brauchst keine Geschichte', b: 'Du kannst mit einem Satz beginnen. Du entscheidest, wie weit du gehst.' },
    { h: 'Kontakt kann klein anfangen', b: 'Eine erste Nachricht darf aus wenigen Wörtern bestehen. Du kannst sie in Ruhe vorbereiten.' },
  ],
};

/** First sentences a person can copy. They are options, never assumptions about the visitor. */
export const HALLWAY_PHRASES = {
  heading: { nl: 'Als een van deze klopt, kun je hem kopiëren', en: 'If one of these is true, you can copy it', de: 'Wenn einer davon stimmt, kannst du ihn kopieren' },
  items: {
    nl: ['Ik weet niet waar ik moet beginnen.', 'Ik heb dingen bekeken die ik niet had moeten bekijken.', 'Ik maak me zorgen over mezelf.'],
    en: ['I do not know where to start.', 'I looked at things I should not have.', 'I am worried about myself.'],
    de: ['Ich weiß nicht, wo ich anfangen soll.', 'Ich habe Dinge angesehen, die ich nicht hätte ansehen sollen.', 'Ich mache mir Sorgen um mich selbst.'],
  },
  copy: { nl: 'Kopieer', en: 'Copy', de: 'Kopieren' },
  copied: { nl: 'Gekopieerd', en: 'Copied', de: 'Kopiert' },
};

export const HALLWAY_FAQ = {
  privacyQ: { nl: 'Wat zegt de dienst zelf over privacy?', en: 'What does the service itself say about privacy?', de: 'Was sagt der Dienst selbst zum Datenschutz?' },
  privacyBy: {
    nl: (who, date) => `Bevestigd door ${who} op ${date}.`,
    en: (who, date) => `Confirmed by ${who} on ${date}.`,
    de: (who, date) => `Bestätigt von ${who} am ${date}.`,
  },
  nocallQ: { nl: 'Ik durf niet te bellen', en: 'I do not dare to call', de: 'Ich traue mich nicht anzurufen' },
  nocallA: {
    nl: 'Er is ook een zelfhulpprogramma online. Daarvoor hoef je met niemand te praten.',
    en: 'There is also a self-help programme online. For that, you do not need to talk to anyone.',
    de: 'Es gibt auch ein Selbsthilfeprogramm online. Dafür musst du mit niemandem sprechen.',
  },
  altLabel: { nl: 'Begin liever met zelfhulp', en: 'Start with self-help instead', de: 'Beginne lieber mit Selbsthilfe' },
  openUntil: { nl: (t) => `Nu open, tot ${t}`, en: (t) => `Open now, until ${t}`, de: (t) => `Jetzt geöffnet, bis ${t}` },
  closedOpens: { nl: (t) => `Nu gesloten, opent om ${t}`, en: (t) => `Closed now, opens at ${t}`, de: (t) => `Jetzt geschlossen, öffnet um ${t}` },
  closedTip: { nl: 'De lijn is dicht. Je kunt nu met zelfhulp beginnen.', en: 'The line is closed. You can start with self-help now.', de: 'Die Leitung ist geschlossen. Du kannst jetzt mit Selbsthilfe beginnen.' },
};

/**
 * The Glass Door — the person can check what the Door sends, at the moment they decide
 * whether to trust it. These strings describe DOORWAY's own data handling (which the panel
 * itself lets the person verify), not any service's confidentiality, so the claim lint
 * exempts them; every other lint rule still applies.
 */
export const GLASS = {
  label: { nl: 'Wat verstuurt dit?', en: 'What does this send?', de: 'Was sendet das?' },
  lead: {
    nl: 'Alles hieronder kun je controleren. Dit is precies wat de browser verstuurt als je iets doet.',
    en: 'Everything below can be checked. This is exactly what the browser sends when you act.',
    de: 'Alles hier kannst du prüfen. Das ist genau, was der Browser sendet, wenn du etwas tust.',
  },
  leavesHeading: { nl: 'Verlaat jouw browser', en: 'Leaves your browser', de: 'Verlässt deinen Browser' },
  pending: { nl: 'wordt pas ingevuld als je iets kiest', en: 'filled in only when you act', de: 'wird erst ausgefüllt, wenn du etwas tust' },
  fields: {
    i: { nl: 'Welke site dit heeft geïnstalleerd, niet wie jij bent.', en: 'Which site installed this, not who you are.', de: 'Welche Website das eingebaut hat, nicht wer du bist.' },
    v: { nl: 'Welke tekstvariant je zag.', en: 'Which wording you saw.', de: 'Welche Textvariante du gesehen hast.' },
    f: { nl: 'Welke vorm je zag.', en: 'Which shape you saw.', de: 'Welche Form du gesehen hast.' },
    t: { nl: 'De soort trigger (zoeken, chat, navigatie), nooit de tekst.', en: 'The kind of trigger (search, chat, navigation), never the text.', de: 'Die Art des Auslösers (Suche, Chat, Navigation), nie der Text.' },
    o: { nl: 'Wat je deed.', en: 'What you did.', de: 'Was du getan hast.' },
    r: { nl: 'Welke hulproute je te zien kreeg.', en: 'Which help service was shown.', de: 'Welcher Hilfsdienst angezeigt wurde.' },
    e: { nl: 'Een emmer (1, 2, 3, 4, 5+), geen exact aantal.', en: 'A bucket (1, 2, 3, 4, 5+), not an exact count.', de: 'Ein Bereich (1, 2, 3, 4, 5+), keine genaue Zahl.' },
  },
  neverHeading: { nl: 'Wordt nooit verstuurd', en: 'Never sent', de: 'Wird nie gesendet' },
  never: {
    nl: ['Wat je typte of zocht.', 'Je naam, e-mailadres of een account.', 'Een nummer dat je van bezoek naar bezoek volgt.', 'De exacte tijd of het exacte aantal keren.'],
    en: ['What you typed or searched.', 'Your name, email or any account.', 'An identifier that follows you from one visit to the next.', 'The exact time, or the exact number of times.'],
    de: ['Was du getippt oder gesucht hast.', 'Dein Name, deine E-Mail oder ein Konto.', 'Eine Kennung, die dir von Besuch zu Besuch folgt.', 'Die genaue Uhrzeit oder die genaue Anzahl.'],
  },
  honest: {
    nl: 'Zoals bij elke website ziet de server je netwerkadres als je verbindt. Het wordt niet bij deze cijfers opgeslagen: de tabel heeft er geen kolom voor.',
    en: 'Like any website, the server can see your network address when you connect. It is not stored with these numbers: the table has no column for it.',
    de: 'Wie bei jeder Website sieht der Server deine Netzwerkadresse beim Verbinden. Sie wird nicht bei diesen Zahlen gespeichert: Die Tabelle hat keine Spalte dafür.',
  },
  localHeading: { nl: 'Blijft op dit apparaat', en: 'Stays on this device', de: 'Bleibt auf diesem Gerät' },
  local: {
    nl: (n) => `Dit apparaat onthoudt alleen hoe vaak dit hier verscheen (${n}), wanneer voor het laatst en welke teksten je zag. Ook of je iets deed. Het wordt nergens verstuurd.`,
    en: (n) => `This device remembers only how many times this appeared here (${n}), when it last did and which wordings you saw. Also whether you acted. It is never sent.`,
    de: (n) => `Dieses Gerät merkt sich nur, wie oft das hier erschien (${n}), wann zuletzt und welche Texte du sahst. Auch, ob du etwas getan hast. Es wird nie gesendet.`,
  },
  wipe: { nl: 'Wis wat dit apparaat onthoudt', en: 'Wipe what this device remembers', de: 'Lösche, was dieses Gerät sich merkt' },
  wiped: { nl: 'Gewist.', en: 'Wiped.', de: 'Gelöscht.' },
  verifyHeading: { nl: 'Controleer het zelf', en: 'Check it yourself', de: 'Prüfe es selbst' },
  verify: {
    nl: 'Open de ontwikkelaarstools van je browser, kies Netwerk en vergelijk. Je ziet dezelfde zeven velden.',
    en: 'Open your browser developer tools, choose Network and compare. You will see the same seven fields.',
    de: 'Öffne die Entwicklertools deines Browsers, wähle Netzwerk und vergleiche. Du siehst dieselben sieben Felder.',
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
  if (format === 'hallway') return HALLWAY[L];
  if (format === 'door') return CONTROL[controlKind(route)][L];
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
  // A one-click, content-free report (review H4). It never asks who the visitor is.
  closeDialog: { nl: 'Dialoog sluiten', en: 'Close dialog', de: 'Dialog schließen' },
  report: { nl: 'Deze waarschuwing is onterecht', en: 'This warning was a mistake', de: 'Diese Warnung war ein Irrtum' },
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
  walk(QUIET, 'QUIET'); walk(LABELS, 'LABELS'); walk(HALLWAY, 'HALLWAY');
  walk(HALLWAY_PHRASES, 'HALLWAY_PHRASES');
  for (const k of ['privacyQ', 'nocallQ', 'nocallA', 'altLabel', 'closedTip']) walk(HALLWAY_FAQ[k], 'HALLWAY_FAQ.' + k);
  for (const [k, v] of Object.entries(GLASS)) {
    if (typeof v === 'object' && v && !Array.isArray(v) && Object.values(v).some((x) => typeof x === 'function')) {
      for (const L of LANGS) out.push({ path: `GLASS.${k}.${L}`, text: v[L](3) });
    } else walk(v, 'GLASS.' + k);
  }
  for (const L of LANGS) {
    out.push({ path: `attribution.${L}`, text: attributionFor({ name: 'X' }, L) });
    for (const kind of ['selfhelp', 'programme']) out.push({ path: `footnote.${kind}.${L}`, text: footnoteFor({ channel: kind }, L) });
    out.push({ path: `footnote.neutral.${L}`, text: footnoteFor({ channel: 'phone' }, L) });
  }
  return out;
}
