/**
 * Legal claim records. Every record is a DRAFT until `reviewedBy`, `reviewedAt`
 * and `expiresAt` are filled in by counsel for that jurisdiction — until then
 * isRenderableLegal() is false and the Door shows neutral harm copy instead.
 *
 * The citations below come from docs/04-open-verifications.md ("Closed" table).
 * They have NOT had Dutch counsel sign-off, in particular on the verb
 * ("searching" vs "deliberately accessing") and on every number.
 */
export const LEGAL_RECORDS = [
  {
    jurisdiction: 'NL',
    claimId: 'nl-art252-sr',
    sourceCitation: 'Wetboek van Strafrecht art. 252 (Wet seksuele misdrijven, in force 2024-07-01); OM Richtlijn 2024R006',
    reviewedBy: null,
    reviewedAt: null,
    expiresAt: null,
    copy: {
      nl: [
        { h: 'Dit is strafbaar', b: 'Dit valt onder artikel 252 van het Wetboek van Strafrecht. Een veroordeling betekent een strafblad.' },
        { h: 'Dit is strafbaar', b: 'Artikel 252 van het Wetboek van Strafrecht: opzettelijk toegang zoeken tot dit materiaal is een misdrijf.' },
        { h: 'Dit is strafbaar', b: 'Dit is een misdrijf in Nederland. Het Openbaar Ministerie vervolgt het.' },
      ],
      en: [
        { h: 'This is a criminal offence', b: 'This falls under article 252 of the Dutch Criminal Code. A conviction means a criminal record.' },
        { h: 'This is a criminal offence', b: 'Article 252 of the Dutch Criminal Code: deliberately seeking access to this material is a crime.' },
        { h: 'This is a criminal offence', b: 'This is a criminal offence in the Netherlands. The public prosecutor pursues it.' },
      ],
      de: [
        { h: 'Dies ist eine Straftat', b: 'Dies fällt unter Artikel 252 des niederländischen Strafgesetzbuchs. Eine Verurteilung bedeutet einen Eintrag im Strafregister.' },
        { h: 'Dies ist eine Straftat', b: 'Artikel 252 des niederländischen Strafgesetzbuchs: der vorsätzliche Zugang zu diesem Material ist ein Verbrechen.' },
        { h: 'Dies ist eine Straftat', b: 'Dies ist in den Niederlanden eine Straftat. Die Staatsanwaltschaft verfolgt sie.' },
      ],
    },
  },
];
