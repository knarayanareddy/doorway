# Open verifications

*Every claim in the Doorway materials that is not yet sourced from a document I have read. Each has the exact question to ask and who can answer it. Nothing here should ship as fact until it moves to "closed."*

**Rule: any confidentiality claim in shipped copy must cite a source named in this file, or it does not render.**

---

## Blocking — must close before any copy ships

### V1 · Dutch confidentiality: what Offlimits actually promises

**The claim.** The organisers' `data/legal-confidentiality.json` block `confidentiality-nl-1` asserts that nothing is reported to law enforcement. We have not verified this with the service. The signed routes bundle no longer carries this claim: it sits in `research/route-claims-unverified.json`, which is never shipped or rendered.

**Why it matters.** Whether a caller will be reported is the single most decision-relevant fact for someone considering a call. A wrong or unconfirmed claim is worse than none.

**What ships until this closes:** neutral copy ("Help, free."). The Dutch and German routes carry a *draft* confidentiality record that cannot render: `isRenderableConfidence()` requires a named person at the service, a confirmation date inside twelve months, a source URL and an unexpired record. There is one predicate and no second regex.

**To close it:** quote the service's own words with the date and the contact, then fill `conf.verifiedBy`, `verifiedAt`, `expiresAt` and `sourceUrl` on `nl-offlimits` in `routes.nl.json`, and re-sign (`npm run sign`).

**Ask:** Emma Persson (UNICRI) or the Offlimits prevention line directly. *Under what circumstances does the preventielijn share information with police or justice, and how is that stated to a caller?*

**Status:** open · blocking for any confidentiality wording.

### V1b · The German programme: confidentiality and intake

**The claim.** `de-kein-taeter` is a clinical programme with an intake appointment, not a drop-in helpline (`channel: "programme"`, no phone number). The draft record says treatment is confidential and participants are not reported to police.

**Ask:** the programme's own published statement, confirmed by a named contact. This is a **different** question from V1: Germany's professional-secrecy rules and the Dutch prevention line's guarantee are different mechanisms.

**Status:** open · blocking for any confidentiality wording on this route.

### V2 · Whether the prevention line serves English

**The claim.** Without a declared country, the routes table sends non-Dutch browsers to ReDirection and Stop It Now UK rather than to Offlimits in English. An install that declares country NL does the opposite by the owner's decision: English, German and other-language browsers go to Stoppen is mogelijk (self-help) and Offlimits (a person), with ReDirection kept as an alternative. Both Dutch pages are in Dutch, and whether Offlimits takes contacts in English is still unverified, which is the question below.

**Why it matters.** If Offlimits does serve English, Dutch forums route their English-speaking members away from the nearest and best service for no reason.

**Ask:** Offlimits, same contact as V1. *Do you take contacts in English, by chat or phone, and in which hours?* This question is independent of V1.

**Status:** open · confirm on site.

### V12 · Dutch counsel sign-off on the legal gate

**The claim.** The legal copy asserts article 252 Sr, a 1 July 2024 start date, a penalty range and a verb ("searching and viewing" versus "deliberately seeking access").

**Where it lives now.** `packages/doorway/src/legal-records.js`, as a draft record with `reviewedBy: null`. It cannot render. Without a reviewed record for an **explicitly declared** `legalJurisdiction`, every visitor sees the neutral harm copy. The jurisdiction is never inferred from locale or from the routing country.

**To close it:** Dutch counsel reviews every number and verb; fill `reviewedBy`, `reviewedAt`, `expiresAt`; record the reviewer and date in this file's Closed table.

**Status:** open · blocking for any statute or penalty wording.

### V13 · Written OK from each help service

**The claim.** Naming a service on a platform it never agreed to is a partnership implication. The attribution now says "Shown by this site · help from X, an independent service", but each route should also carry a named contact and a written OK, plus the expected volume shared with the service (the capacity contract in `03-the-gap-to-real.md`).

**To close it:** fill `agreement: { contact, okRef, okAt }` on each route. `npm run check:pilot` lists what is missing and is expected to fail until the outreach is done.

**Status:** open · blocking for a pilot.

### V14 · Production signing key

The pinned public key (`packages/doorway/src/pubkey.js`) is a **dev** key generated for this repo. Before any pilot: generate the production key offline, pin its public half, store the private half where only the release owner can reach it, and re-sign.

**Status:** open · blocking for a pilot.

---

## High — affects a claim we want to make

### V3 · What the 4.5% redirect figure counts

**The claim.** Nurmi et al. (2026, SSRN preprint, posted 5 March 2026; not peer reviewed) report that 4.5% of search sessions redirected users to therapy resources. *Source: `research/03-dataset-ping-app.html`. The paper itself is not in the repo.*

**The ambiguity.** A click-through rate, or an automatic redirect? These are different numbers and only one is comparable to Ó Ciardha's 12.44%, which is a share of warnings *triggered*.

**Ask:** Dr Juha Nurmi, mentor, at the Discord Q&A or in person.

**Status:** open · high

### V4 · Whether the 2018→2024 decline is real or definitional

**The claim.** CSAM search volume on Ahmia fell from 27.2% in 2018 to 6.0% in 2024. *Source: `research/03-dataset-ping-app.html` (the same SSRN preprint).*

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

### V9 · UNICRI's preferred licence and hosting for anything going on the hub (review L3)

MIT is in the repo; `organiser/unicri` carries its own LICENSE. A UN platform may need something else. Decide the target licence with the fiscal sponsor **before** outside contributions arrive, and ask before claiming the artifact is reusable. This is a decision, not code.

### V10 · How the check-safety tooling treats a modified contract

The kit ships `tools/check-safety.js` and a seven-schema contract. Removing `sessionScopedId` — which we do deliberately — may fail its own validation. **Test this early; if it fails, document the departure rather than patching around it silently.** Since the iframe change there is a second documented departure: `sbis:result.outcome` is always `"continued"` (see `02-threat-model.md` R9).

### V11 · The exact semantics of the `timeout` outcome

Whether a user who closes the tab is distinguishable from one who navigates away. **Partly closed 7 Nov:** a tab close or navigation while the card is open is now recorded as `left_page` (`pagehide` / `visibilitychange` with `keepalive`), so the denominator is real exposures. A person who looks away and later returns is still one exposure, and a click after that is not recorded. Whether `left_page` can be read as "did not seek help" is still unproven.

---

## Closed

| Claim | Source |
|---|---|
| Art. 252 Sr in force 1 July 2024, max 6 years, habit/profession 9 years, "zich de toegang verschaffen" criminalised, viewing without downloading suffices | Wet seksuele misdrijven; OM Richtlijn 2024R006 (both as cited in `research/unicri-research.html`) |
| Base offence: short unconditional sentence + 240 h community service + suspended sentence; 12 months where repeated; ten-year probation from 1 July 2024; art. 22b Sr task-penalty prohibition | OM Richtlijn 2024R006 (as cited in `research/unicri-research.html`) |
| Offlimits preventielijn renamed from Stop it Now in January 2026; 0800 266 64 36; founded 2012 with De Waag | Offlimits pages (link in `organiser/unicri/BRIEF.md`); also `research/unicri-research.html` |
| Ahmia: almost 20 million searches over 140 days, over 3 million triggered a warning, 12.44% click-through (386,497 clicks / 3,105,800 warnings), no detectable reduction in searching | Ó Ciardha et al. 2026, arXiv:2606.06417 (abstract: "almost 20 million searches", "over 3 million"); `research/unicri-research.html` (the four-deployment table) for the clicks and warnings; the no-reduction finding is in the same dossier |
| Google: −3.8pp (−5.6pp Europe), 0.73% help CTR, within-session only | Umbach et al. 2026, arXiv:2606.06126 |
| reThink: 4.4M warnings, 490 click-throughs, ~68 helpline contacts, 82% not searching again is session-level with no baseline | Scanlan et al. 2024, reThink evaluation (`research/unicri-research.html`) |
| Prichard 2024: 75% → 35–47% entry; deterrence+image OR 5.02; images added nothing | *Child Abuse & Neglect* 155:106955 |
| Prichard 2022: IP-trace OR 2.64, illegality OR 2.99, harm OR 1.31 not significant | *Sexual Abuse* 34:106 |
| Insoll 2024: 55.0% want to stop, 70.2% could not find anonymous help, 73.9% (Nurmi) could not get help | *JOTS* 2(4); *Sci Rep* 14:7849 |
| Ahmia search logs are withheld; only the 11,470-response survey is released (on Zenodo) | Nurmi et al. 2024, data availability statement, as read in `research/03-dataset-ping-app.html` |

---

*Last updated 7 November 2026. Closed items moved here with the source that closed them. Every figure is also listed, with its status, in `docs/16-claims-ledger.md`.*
