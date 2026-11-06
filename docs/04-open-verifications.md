# Open verifications

*Every claim in the Doorway materials that is not yet sourced from a document I have read. Each has the exact question to ask and who can answer it. Nothing here should ship as fact until it moves to "closed."*

**Rule: any confidentiality claim in shipped copy must cite a source named in this file, or it does not render.**

---

## Blocking — must close before any copy ships

### V1 · Dutch confidentiality: what Offlimits actually promises

**The claim.** The organisers' `data/legal-confidentiality.json` block `confidentiality-nl-1` asserts that nothing is reported to police or justice. I have not verified this.

**Why it matters.** The brief lists *"be honest about … what is confidential"* as a **Should**, and explicitly warns that fear of being reported keeps people from seeking help. This is the single line most likely to be challenged by a juror from the sector, and getting it wrong would be worse than saying nothing.

**Ask:** Emma Persson (UNICRI, on site) or the Offlimits prevention line directly. Precisely: *under what circumstances does the preventielijn share information with police or justice, and how is that stated to a caller?*

**Status:** still open, but **downgraded from blocker to confirm-on-site**, 6 Nov.

The organisers' own `data/legal-confidentiality.json` block `confidentiality-nl-1`
asserts: *"Callers do not need to identify themselves and nothing is reported to
law enforcement"*, with the basis given as a service-level confidentiality
guarantee by Offlimits, and exceptions noted as *"No mandatory reporting
obligation for the prevention line. General duty to report acute danger to
children applies to all citizens under Dutch law, but this does not extend to
anonymous helpline conversations."*

That is their assertion with their own source, not ours — which satisfies this
file's rule that a confidentiality claim must cite a named source, provided our
copy says **who** asserts it rather than presenting it as established fact. Still
worth one question to Emma Persson on site, because the phrase "general duty to
report acute danger" is doing real work and a Dutch juror will know exactly how
load-bearing it is.

**Ask (unchanged):** Emma Persson (UNICRI, on site) or the preventielijn directly —
*under what circumstances does the preventielijn share information with police or
justice, and how is that stated to a caller?*

### V2 · Whether the prevention line serves English

**The claim.** The routes table sends non-Dutch browsers to ReDirection and Stop It Now UK rather than to Offlimits in English.

**Why it matters.** If Offlimits does serve English, Dutch forums route their English members away from the nearest and best service for no reason.

**Ask:** same contact. *Do you take contacts in English?*

**Status:** still open, but **downgraded from blocker to confirm-on-site**, 6 Nov.

The organisers' own `data/legal-confidentiality.json` block `confidentiality-nl-1`
asserts: *"Callers do not need to identify themselves and nothing is reported to
law enforcement"*, with the basis given as a service-level confidentiality
guarantee by Offlimits, and exceptions noted as *"No mandatory reporting
obligation for the prevention line. General duty to report acute danger to
children applies to all citizens under Dutch law, but this does not extend to
anonymous helpline conversations."*

That is their assertion with their own source, not ours — which satisfies this
file's rule that a confidentiality claim must cite a named source, provided our
copy says **who** asserts it rather than presenting it as established fact. Still
worth one question to Emma Persson on site, because the phrase "general duty to
report acute danger" is doing real work and a Dutch juror will know exactly how
load-bearing it is.

**Ask (unchanged):** Emma Persson (UNICRI, on site) or the preventielijn directly —
*under what circumstances does the preventielijn share information with police or
justice, and how is that stated to a caller?*

---

## High — affects a claim we want to make

### V3 · What the 4.5% redirect figure counts

**The claim.** Nurmi et al. (2026, SSRN preprint) report that 4.5% of search sessions redirected users to therapy resources.

**The ambiguity.** A click-through rate, or an automatic redirect? These are different numbers and only one is comparable to Ó Ciardha's 12.44%, which is a share of warnings *triggered*.

**Ask:** Dr Juha Nurmi, mentor, at the Discord Q&A or in person.

**Status:** open · high

### V4 · Whether the 2018→2024 decline is real or definitional

**The claim.** CSAM search volume on Ahmia fell from 27.2% in 2018 to 6.0% in 2024.

**The ambiguity.** The filter was expanded in November 2023 to block all sexual queries, and the denominator changed. The decline may be partly arithmetic.

**Ask:** Nurmi. *Does the decline survive controlling for the filter expansions and the change in total query volume?*

**Status:** open · high

### V5 · The Ahmia click-through confound

**The claim.** Platform CTR rose from 8.73% to 15.67% when redesigned messages launched.

**The ambiguity.** The interface was redesigned at the same time — several stacked panels consolidated into one page. The paper concedes this and reports the neutral control message at 12.17%, well above the 8.73% baseline. **The defensible claim is the within-campaign randomised comparison, not the before-and-after.**

**Ask:** Nurmi. *How much of the lift do you attribute to the layout change?*

**Status:** open · high · **affects how we describe the 700× finding**

---

## Medium — affects a supporting detail

### V6 · The Crime and Policing Act 2026 guidance

**The claim.** England created a reporting duty for people in regulated activity with children; guidance is pending. The organisers' own file flags this `[VERIFY]`.

**Why it matters.** It is the contrast case in the confidentiality story — Germany protects, England is moving the other way. If the guidance has landed, the contrast is sharper.

**Status:** open · medium

### V7 · Whether ReDirection and Kein Täter werden are correctly flagged `verified: false`

Both appear live and functioning in the repo's `help-services.json`, so the flag may be stale. If it is, a route we ship may be flagged for no reason.

**Status:** open · medium

### V8 · Current Offlimits capacity

**The figure I have.** 943 contacts in 2022, ~2.6 per day for 17.9 million people.

**What I need.** Current monthly volume and their own view of growth headroom. A product that succeeds breaks this service, and the pitch should carry their number rather than mine.

**Ask:** Offlimits, or Emma Persson.

**Status:** open · medium

---

## Low — worth knowing, not worth blocking

### V9 · UNICRI's preferred licence and hosting for anything going on the hub

MIT is in the repo. A UN platform may have its own requirements. Ask before claiming the artifact is reusable.

### V10 · How the check-safety tooling treats a modified contract

The kit ships `tools/check-safety.js` and a seven-schema contract. Removing `sessionScopedId` — which we do deliberately — may fail its own validation. **Test this early; if it fails, document the departure rather than patching around it silently.**

### V11 · The exact semantics of the `timeout` outcome

Whether a user who closes the tab is distinguishable from one who navigates away. This affects whether the arrival numbers are honest.

---

## Closed

| Claim | Source |
|---|---|
| Art. 252 Sr in force 1 July 2024, max 6 years, habit/profession 9 years, "zich de toegang verschaffen" criminalised, viewing without downloading suffices | Wet seksuele misdrijven; OM Richtlijn 2024R006 |
| Base offence: short unconditional sentence + 240 h community service + suspended sentence; 12 months where repeated; ten-year probation from 1 July 2024; art. 22b Sr task-penalty prohibition | OM Richtlijn 2024R006 |
| Offlimits preventielijn renamed from Stop it Now in January 2026; 0800 266 64 36; founded 2012 with De Waag | Offlimits own pages |
| Ahmia: 19,611,744 searches, 15.84% triggered, 12.44% CTR, no detectable reduction in searching | Ó Ciardha et al. 2026, arXiv:2606.06417 |
| Google: −3.8pp (−5.6pp Europe), 0.73% help CTR, within-session only | Umbach et al. 2026, arXiv:2606.06126 |
| reThink: 4.4M warnings, 490 click-throughs, ~68 helpline contacts, 82% not searching again is session-level with no baseline | Scanlan et al. 2024, IWF evaluation |
| Prichard 2024: 75% → 35–47% entry; deterrence+image OR 5.02; images added nothing | *Child Abuse & Neglect* 155:106955 |
| Prichard 2022: IP-trace OR 2.64, illegality OR 2.99, harm OR 1.31 not significant | *Sexual Abuse* 34:106 |
| Insoll 2024: 55.0% want to stop, 70.2% could not find anonymous help, 73.9% (Nurmi) could not get help | *JOTS* 2(4); *Sci Rep* 14:7849 |
| Ahmia search logs are withheld; only the 11,470-response survey is released | Nurmi et al. 2024, data availability statement + Zenodo 10457587 |

---

*Last updated 6 November 2026. Closed items moved here with the source that closed them.*
