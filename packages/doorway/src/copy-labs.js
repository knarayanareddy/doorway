/**
 * Copy for the labs shapes. Same rules as copy.js, enforced by the same lint: no statute or
 * penalty, no promise about any service's confidentiality, no unsourced figures, 20-word sentences.
 * Nobody has reviewed the Dutch or German with a native speaker.
 */
export const LABS_TAG = {
  fork: { nl: 'Labs: gereserveerde vorm, nog niet beoordeeld door een expert.', en: 'Labs: reserved shape, not yet reviewed by an expert.', de: 'Labs: reservierte Form, noch nicht von Fachleuten geprüft.' },
  wave: { nl: 'Labs: gereserveerde vorm, nog niet klinisch beoordeeld.', en: 'Labs: reserved shape, not yet clinically reviewed.', de: 'Labs: reservierte Form, noch nicht klinisch geprüft.' },
};

export const QUICK = { nl: 'Snel weg', en: 'Quick exit', de: 'Schnell weg' };
export const QUICK_HINT = {
  nl: 'Verlaat deze pagina direct en gaat naar een neutrale site.',
  en: 'Leaves this page at once and goes to a neutral site.',
  de: 'Verlässt diese Seite sofort und öffnet eine neutrale Website.',
};

export const BACK = { nl: 'Terug naar het forum', en: 'Back to the forum', de: 'Zurück zum Forum' };

export const FORK = {
  intro: {
    nl: { h: 'Welke zin komt nu het dichtst bij de waarheid?', b: 'Je hoeft niets uit te leggen. Wat je kiest wordt niet verstuurd en niet bewaard.' },
    en: { h: 'Which sentence is closest to true right now?', b: 'You do not have to explain anything. What you pick is not sent and not kept.' },
    de: { h: 'Welcher Satz kommt der Wahrheit gerade am nächsten?', b: 'Du musst nichts erklären. Was du wählst, wird weder gesendet noch gespeichert.' },
  },
  options: {
    nl: [['accident', 'Ik kwam hier per ongeluk terecht.'], ['stop', 'Ik heb hiernaar gezocht en ik wil stoppen.'], ['cantstop', 'Ik wil stoppen, maar ik weet niet of dat lukt.'], ['other', 'Ik maak me zorgen over iemand anders.'], ['young', 'Ik ben jonger dan 18.'], ['work', 'Ik ben hier voor werk, onderzoek of zorg.']],
    en: [['accident', 'I ended up here by accident.'], ['stop', 'I searched for this and I want to stop.'], ['cantstop', 'I want to stop, but I am not sure I can.'], ['other', 'I am worried about someone else.'], ['young', 'I am under 18.'], ['work', 'I am here for work, research or care.']],
    de: [['accident', 'Ich bin aus Versehen hier gelandet.'], ['stop', 'Ich habe danach gesucht und möchte aufhören.'], ['cantstop', 'Ich möchte aufhören, weiß aber nicht, ob ich es schaffe.'], ['other', 'Ich mache mir Sorgen um jemand anderen.'], ['young', 'Ich bin unter 18.'], ['work', 'Ich bin beruflich, zur Forschung oder zur Pflege hier.']],
  },
  views: {
    nl: {
      accident: { h: 'Dat kan gebeuren.', b: 'Je kunt rustig teruggaan. Mocht je er later mee zitten, dan is er hulp.', help: 'Toch hulp bekijken' },
      stop: { h: 'Stoppen kan, en je hoeft het niet alleen te doen.', b: 'Een hulpdienst kan met je meedenken over een eerste stap.', help: 'Bekijk hulp' },
      cantstop: { h: 'Twijfelen of het lukt hoort erbij.', b: 'Je hoeft het niet in je eentje uit te zoeken. Een eerste gesprek verplicht tot niets.', help: 'Bekijk hulp' },
      other: { h: 'Je maakt je zorgen om iemand anders.', b: 'Je kunt contact opnemen met een hulpdienst. Zij kunnen met je meedenken.', help: 'Bekijk hulp' },
      young: { h: 'Je zit niet in de problemen omdat je dit vraagt.', b: 'Praat met iemand die je vertrouwt, zoals een ouder, een leraar of een andere volwassene.', youth: 'Hulp voor jongeren' },
      work: { h: 'Begrepen. Voor jou is dit een vals alarm.', b: 'Je kunt verder. Laat het de moderators weten, zodat zij hun regels kunnen bijstellen.', go: 'Verder naar de resultaten' },
    },
    en: {
      accident: { h: 'That can happen.', b: 'You can calmly go back. If it stays on your mind later, there is help.', help: 'Look at help anyway' },
      stop: { h: 'Stopping is possible, and you do not have to do it alone.', b: 'A help service can think with you about a first step.', help: 'See help' },
      cantstop: { h: 'Doubting whether you can is part of it.', b: 'You do not have to work it out alone. A first conversation commits you to nothing.', help: 'See help' },
      other: { h: 'You are worried about someone else.', b: 'You can contact a help service. They can think it through with you.', help: 'See help' },
      young: { h: 'You are not in trouble for asking.', b: 'Talk to someone you trust, such as a parent, a teacher or another adult.', youth: 'Help for young people' },
      work: { h: 'Understood. For you, this is a false alarm.', b: 'You can carry on. Tell the moderators, so they can adjust their rules.', go: 'Continue to the results' },
    },
    de: {
      accident: { h: 'Das kann passieren.', b: 'Du kannst in Ruhe zurückgehen. Wenn es dich später beschäftigt, gibt es Hilfe.', help: 'Trotzdem Hilfe ansehen' },
      stop: { h: 'Aufhören ist möglich, und du musst es nicht allein tun.', b: 'Ein Hilfsdienst kann mit dir über einen ersten Schritt nachdenken.', help: 'Hilfe ansehen' },
      cantstop: { h: 'Zweifel, ob es klappt, gehören dazu.', b: 'Du musst es nicht allein herausfinden. Ein erstes Gespräch verpflichtet zu nichts.', help: 'Hilfe ansehen' },
      other: { h: 'Du machst dir Sorgen um jemand anderen.', b: 'Du kannst einen Hilfsdienst kontaktieren. Dort kann man mit dir überlegen.', help: 'Hilfe ansehen' },
      young: { h: 'Du bekommst keinen Ärger, weil du das fragst.', b: 'Sprich mit jemandem, dem du vertraust, etwa mit einem Elternteil, einer Lehrkraft oder einer anderen erwachsenen Person.', youth: 'Hilfe für junge Menschen' },
      work: { h: 'Verstanden. Für dich ist das ein Fehlalarm.', b: 'Du kannst weitermachen. Sag den Moderatoren Bescheid, damit sie ihre Regeln anpassen können.', go: 'Weiter zu den Ergebnissen' },
    },
  },
};

export const WAVE = {
  h: { nl: 'Een drang komt op, piekt en zakt weer.', en: 'An urge rises, peaks and falls again.', de: 'Ein Drang kommt auf, erreicht einen Höhepunkt und klingt wieder ab.' },
  b: {
    nl: 'Je hoeft er niet naar te handelen terwijl hij op zijn hoogst is. Volg de golf en adem rustig mee.',
    en: 'You do not have to act on it while it is at its highest. Follow the wave and breathe along.',
    de: 'Du musst nicht danach handeln, solange er am stärksten ist. Folge der Welle und atme ruhig mit.',
  },
  note: {
    nl: 'Deze oefening komt uit de verslavings- en terugvalpreventie. Het is een vaardigheid, geen behandeling.',
    en: 'This exercise comes from addiction and relapse prevention. It is a skill, not a treatment.',
    de: 'Diese Übung stammt aus der Sucht- und Rückfallprävention. Sie ist eine Fertigkeit, keine Behandlung.',
  },
  start: { nl: (s) => `Begin (${s} seconden)`, en: (s) => `Begin (${s} seconds)`, de: (s) => `Beginnen (${s} Sekunden)` },
  remaining: { nl: (s) => `Nog ${s} seconden`, en: (s) => `${s} seconds left`, de: (s) => `Noch ${s} Sekunden` },
  phases: {
    nl: [{ until: 0.34, label: 'De golf stijgt. Adem in.' }, { until: 0.67, label: 'De golf is op zijn hoogst. Adem uit.' }, { until: 1.01, label: 'De golf zakt. Adem rustig door.' }],
    en: [{ until: 0.34, label: 'The wave rises. Breathe in.' }, { until: 0.67, label: 'The wave is at its highest. Breathe out.' }, { until: 1.01, label: 'The wave falls. Keep breathing calmly.' }],
    de: [{ until: 0.34, label: 'Die Welle steigt. Atme ein.' }, { until: 0.67, label: 'Die Welle ist am höchsten. Atme aus.' }, { until: 1.01, label: 'Die Welle sinkt. Atme ruhig weiter.' }],
  },
  done: {
    nl: 'De golf is gezakt. Dat deed je zelf. Je kunt dit zo vaak doen als je wilt.',
    en: 'The wave has fallen. You did that yourself. You can do this as often as you like.',
    de: 'Die Welle ist abgeklungen. Das hast du selbst geschafft. Du kannst das so oft tun, wie du willst.',
  },
  planH: { nl: 'Maak een plan voor de volgende keer', en: 'Make a plan for next time', de: 'Mach einen Plan für das nächste Mal' },
  planB: {
    nl: 'Kies een zin. Die blijft alleen in dit tabblad en verdwijnt als je het sluit.',
    en: 'Pick a sentence. It stays in this tab only and disappears when you close it.',
    de: 'Wähle einen Satz. Er bleibt nur in diesem Tab und verschwindet, wenn du ihn schließt.',
  },
  planLead: { nl: 'Als ik die drang voel, dan…', en: 'When I feel that urge, I will…', de: 'Wenn ich diesen Drang spüre, dann…' },
  presets: {
    nl: ['ga ik naar buiten en loop ik een blokje.', 'bel ik iemand die ik vertrouw.', 'leg ik mijn telefoon in een andere kamer.', 'kijk ik naar hulp bij een hulpdienst.'],
    en: ['go outside and take a walk.', 'call someone I trust.', 'put my phone in another room.', 'look at help from a help service.'],
    de: ['gehe ich nach draußen und laufe eine Runde.', 'rufe ich jemanden an, dem ich vertraue.', 'lege ich mein Handy in ein anderes Zimmer.', 'sehe ich mir Hilfe bei einem Hilfsdienst an.'],
  },
  kept: { nl: 'Bewaard tot je dit tabblad sluit.', en: 'Kept until you close this tab.', de: 'Gespeichert, bis du diesen Tab schließt.' },
  localNote: {
    nl: 'Gereserveerde oefening: een gekozen plan staat alleen in dit tabblad. Het is een nummer, geen tekst.',
    en: 'Reserved exercise: a chosen plan lives in this tab only. It is a number, not text.',
    de: 'Reservierte Übung: Ein gewählter Plan liegt nur in diesem Tab. Er ist eine Zahl, kein Text.',
  },
};

/** Every labs string, for the copy lint. */
export function labsStrings() {
  const out = [];
  const walk = (v, path) => {
    if (typeof v === 'string') out.push({ path, text: v });
    else if (typeof v === 'function') out.push({ path, text: v(30) });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  walk(LABS_TAG, 'LABS_TAG'); walk(QUICK, 'QUICK'); walk(QUICK_HINT, 'QUICK_HINT'); walk(BACK, 'BACK');
  walk(FORK, 'FORK'); walk(WAVE, 'WAVE');
  return out;
}
