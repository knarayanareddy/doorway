# Is this a full-fledged product?

**Doorway, assessed honestly against a real definition of "product." Updated 7 November 2026.**

*A "full-fledged product" is one that a stranger can adopt, operate and depend on without you in the room. Not a demo that works, not a prototype that impresses — a thing that keeps working when the team goes home.*

This document was first written when only a specification existed. It has been rewritten against the repository as it is now; `BUILD.md` has the live status and `docs/07-review-response.md` has the history.

---

## The short answer

**No. Doorway is a hardened, tested prototype of a response layer. It is not yet a pilot, and nowhere near a product.**

That is a specific and defensible claim, not a put-down. Here is the difference, measured against things you can check.

| Dimension | A full-fledged product needs | Doorway today |
|---|---|---|
| **Runs** | Deployed, monitored, uptime | The Door, the edge Worker, the Desk, a script-tag install and a WordPress plugin are written and tested. Most runs were local: the Worker on `node:sqlite` and on workerd with a local D1, the plugin in a real WordPress. The demo harness and one Discourse install ran on a temporary Maritime sandbox (`docs/14`). **Nothing is deployed to Cloudflare and nothing is monitored.** |
| **Adopts without you** | Docs a stranger can follow to success | `INSTALL.md` has a quickstart and installer error messages that say how to fix each mistake. **The install-time target (under 15 minutes, non-developer) has not been measured by a non-developer.** Discourse has been run once, in a Maritime sandbox with its CSP on, in Chromium (`docs/14`); not on a production Discourse. |
| **Answers to a customer** | SLA, support, an owner | Nobody. A false-positive report mechanism exists (one click for a visitor, categories for a platform admin), but **no named person reads the reports** (`docs/10`). |
| **Sustains itself** | Content maintenance, funding, a legal entity | Every route has a review date and CI fails when it passes, but a human has to do the reviewing, and none exists. The signing key is a development key. No route carries a verified confidentiality record, so copy is neutral. |
| **Proves itself** | Evidence that the intervention works | **No.** No published study we have read shows a warning reduces use beyond minutes. The Desk labels every figure as self-reported by the install's page and unauthenticated. |
| **Survives scrutiny** | Security review, DPIA, licence, governance | The threat model is written and enforced by tests (including a hostile-host page in three browsers). **No DPIA, no external security review, no counsel review of any legal wording.** The repo is MIT-licensed; whether that is the right licence for a UN-hosted artefact is not decided. |

In the taxonomy:

```
idea  →  concept  →  specification  →  prototype  →  pilot  →  product  →  platform
                                            ▲
                                      you are here
```

The prototype is unusually *deep* for this stage and unusually *honest* about what it lacks. The distance to a pilot is mostly not engineering.

---

## Assumption: all the time in the world

The binding constraint on a real product is almost never build time. Remove the clock and the real constraints appear.

### What time does not fix

Two of these are structural, and no amount of time closes them.

1. **Nobody has demonstrated that warnings reduce use beyond minutes.** Ahmia randomised over 3 million warnings across 140 days and found no detectable reduction in searching. Google's −3.8pp is within-session. Time does not change this; only a study does, and it has to be funded by someone who believes it enough to pay first.

2. **Voluntary adoption at the tail of platforms has not been shown to work at scale in the sources we read.** The dossier's example of a platform that changed is the one that did so after Mastercard and Visa suspended payments on 10 December 2020 (`research/unicri-research.html`). There is no payment rail at a 20,000-member Dutch forum, and the EU regulation that would create one is not law (the dossier's reading). Time gives you more outreach, not more leverage.

### What time does fix

These are **planning estimates carried over from the original plan**, not sourced figures and not commitments.

| Phase | Duration (estimate) | What it produces | Who has to exist |
|---|---|---|---|
| **Build** | Largely done; weeks to finish (estimate) | Deploy the edge, a production signing key, a verified Discourse package, a recorded non-developer install, real-Safari checks | An engineer and a release owner |
| **Pilot** | About 6 months (estimate) | A proposed set of Dutch platforms live, including a forum, a marketplace, a file-share, two adult sites and three Discourse communities. The count is to be agreed with a partner. Real volumes. | A part-time community manager |
| **Evaluation** | About 9 months, overlapping (estimate) | A proposed stepped-wedge study, randomised by cohort, of gate against banner. | A research partner with ethics approval |
| **Institutionalisation** | About 18 months (estimate) | Under discussion: Offlimits co-maintenance of the Dutch routes, and hosting of the aggregate feed by the AI for Safer Children hub (as in `docs/01`). Tech Coalition Pathways carrying it to the tail is a proposal. **No written agreement exists yet** (`docs/04` V13). | A fiscal sponsor or an NGO home |

**The founder's estimate: about three years to "product" on the line above, and five to "platform."** That is an opinion, not a sourced figure.

---

## What full-fledged Doorway would need that the repository does not yet have

### The trust-and-safety desk

A real product has a support burden nobody budgets for:

- **A response time for breakage.** A forum installs this on a Friday and its flagging rule over-matches. Who answers, in what time, and what happens when nobody does?
- **A named reviewer for false positives.** The mechanism exists: a visitor can say "this warning was a mistake" in one click, a platform admin can file a categorised report, and the Desk shows counts for the chosen period with small cells hidden. Nobody is assigned to read them. **We have not found a deployment in the sources we read that runs this loop, and an unread loop is the most obvious way Doorway does harm.**
- **Trigger-source stewardship, owned by someone who is not Doorway.** Doorway holds no term list and never will (`docs/02` R4, `docs/08`). Slang changes, and the platform, or a hotline supplying a list, must keep its own source current. Doorway's job is to make over-matching visible, through the report counts, not to fix it.

### The legal artefacts

- **A DPIA.** Even with seven aggregate fields, a tool that observes searches in a child-protection context needs one in the Netherlands, and it needs updating when the fields change. *None in the repo.*
- **A data-processing agreement.** The platform's relationship with whoever hosts the counter. Who is the controller, who is the processor, and what happens when a Dutch court asks for the aggregates. *None in the repo.*
- **Counsel review of any legal wording.** Legal copy renders only from a reviewed record for a jurisdiction the platform declares. No record is reviewed yet, so no one sees a statute or a penalty.
- **A licence decision.** MIT is in the repo, and a UN platform may need something else. Decide before outside contributions arrive.

### The maintenance surface

- **Message content owned by someone.** Several message families in three languages, each with a named owner, a review date and a source. This is editorial work and it never stops. Dutch and German copy has had no native-speaker review.
- **Routes that are actually current.** Opening hours, phone numbers, service existence. Offlimits renamed itself in January 2026; services close. A stale route is worse than no route because it looks like help and isn't. Today each route has a review date, and a service's own privacy wording or opening hours is shown only when a named person at that service has confirmed it. None has.
- **A production signing key and a rotation plan** for the routes bundle, plus a cadence for re-signing before it expires.

### The governance question nobody wants

**Who decides what the warning says?** A platform that installs the module hands over its warning copy to a party that is neither the government nor the platform. That is the right design, and it needs a published process: who writes, who reviews, whose veto counts. A product has an answer to "who are you and why do you get to tell my users what is legal."

### The capacity contract

Offlimits took about 2.6 contacts a day in 2022 (943 contacts over the year, for a population of 17.9 million). The current figure is unknown. A full-fledged Doorway **has a formal relationship with every service in its routes table**: a named contact, a written OK, a volume forecast and a review cadence. Without that, the product sends people to a phone that does not ring. Each route has an `agreement` field for this and `npm run check:pilot` lists what is missing. All are missing.

Links carry the same `?src=doorway` for every platform, so a service cannot attribute arrivals to a platform. That is a deliberate privacy choice; the cost is that the "do people actually arrive" number has to come from each service's own reporting.

---

## The honest ranking of what stands in the way

Sorted by how much each one actually blocks a full-fledged product.

| # | Blocker | Fixable with time? | Fixable at all? |
|---|---|---|---|
| 1 | No evidence the intervention works beyond minutes | Only by a funded study | **Yes, eventually** |
| 2 | No adoption mechanism at the tail | Partly, via Tech Coalition, regulation and hotlines | Partly. This is a market problem. |
| 3 | No owner: no legal entity, no support desk, no funding, no named reviewer | **Yes, completely** | Yes. This is the real work. |
| 4 | Capacity of the help services, and no written agreement with any of them | Partly, by routing to self-help first | Partly |
| 5 | Content and route maintenance never stops | Yes, by paying someone | Yes |
| 6 | Not deployed, not piloted, one browser family untested in the wild | Yes, in weeks (estimate) | **Yes, trivially** |

Read that list in order and the conclusion is uncomfortable but useful: **the remaining engineering is the sixth hardest problem.** Everything above it is organisational.

---

## What stands between this and a real pilot

Ordered by what blocks a pilot first. Each item is open today. Items 1–11 and 13 come from the open items in `docs/04-open-verifications.md` and `docs/07-review-response.md`. Items 12 and 14 come from this file's own gap list above, because neither docs/04 nor docs/07 lists them. Nothing in this list is a new claim: the status column is what the repo records. Whether a DPIA is needed is the founder's reading, for counsel to confirm.

| # | Item | Who must act | Status (as recorded) | Source |
|---|---|---|---|---|
| 1 | A written OK from each help service, with a named contact and expected volume | **Founder**, then each **service owner** | Open. No `agreement` field is filled. `npm run check:pilot` fails. | `docs/04` V13; `docs/07` H5 |
| 2 | Confirmation of confidentiality wording, quoted with date and contact, from Offlimits (and separately the German programme) | **Service owner** (Offlimits prevention line; the German programme) | Open. The draft record cannot render. | `docs/04` V1, V1b |
| 3 | Dutch counsel sign-off on every legal number and verb | **Counsel** | Open. No reviewed record. Neutral copy only. | `docs/04` V12; `docs/07` B8 |
| 4 | Whether Offlimits serves English (routing depends on it) | **Service owner** | Open. | `docs/04` V2 |
| 5 | Production signing key, generated offline, public half pinned, re-signed | **Founder** (release owner) | Open. The pinned key is a development key. | `docs/04` V14; `docs/07` B4 |
| 6 | Deploy the edge to Cloudflare and run the first deploy against D1 | **Founder** (needs the Cloudflare account) | Open. Never deployed. | `docs/07` "Edge not deployed"; `BUILD.md` |
| 7 | A named human reviewer for false-positive reports | **Founder** (names the person) | Open. Deliberately not invented in the repo. | `docs/07` H4; `docs/10` |
| 8 | The recorded non-developer install under 15 minutes, using `scripts/measure-install.mjs` | **A non-developer** (a participant), with the **founder** | Open. Measured so far: none. | `docs/07` B5; `INSTALL.md` |
| 9 | Native-speaker review of the Dutch and German copy | **Founder** (finds the reviewer) | Open. | `docs/07` H7 |
| 10 | Human verification of each route (`verifiedAt` is null everywhere) and a monthly review | **Founder**, with each service | Open. | `docs/07` M3 |
| 11 | A real Safari (macOS and iOS) pass on third-party storage | **Founder** or a tester with Apple hardware | Open. Playwright's WebKit is not Safari. | `docs/07` V15 |
| 12 | A DPIA and a data-processing agreement for the counter | **Counsel** and **founder** (controller decision) | None in the repo. | `docs/03` (this file); not listed in `docs/04` or `docs/07` |
| 13 | A licence decision for any UN-hosted artefact | **Founder** with the fiscal sponsor | Open. MIT in the repo. | `docs/07` L3; `docs/04` V9 |
| 14 | A pilot partner: a platform that agrees to run it, and the pilot's size | **Founder** | Open. None named in the repo. | `docs/03` (this file) |

Items that do not block a pilot but are on the record: the research questions to Dr Nurmi (`docs/04` V3–V5), the Crime and Policing Act 2026 guidance (V6), the stale-flag question on two routes (V7), the current Offlimits volume (V8), and the claim that a left-page outcome means "did not seek help" (V11).

---

## So what should you call it?

Not "product." The accurate framing:

> **A working, tested response layer with its privacy claims enforced in code and its limits written down, ready for a pilot partner but not yet piloted.**

If a juror asks "is this a product?", the right answer is not yes and it is not a hedge. It is:

> "No. What we have runs, is tested in three browsers against a hostile host page, and can be installed with one script tag. It has not been deployed or piloted, nobody has confirmed what the help services say about themselves, and we cannot yet say it works. The next step is a pilot, and a pilot needs a partner. That is the honest ask."

That answer is stronger than an overclaim, it is hard to catch out, and it happens to be true.
