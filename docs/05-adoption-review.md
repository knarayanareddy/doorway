# Adoption review — Doorway

**What competitors already do better than us, and which parts are safe to borrow.**

The rule you set: adopt only where the alternative is **additive or better with a proven track record** — never to avoid thinking. So every item below is scored on two axes: *does it work better* and *has it actually been proven*. Where the answer is "clever but unproven," it is listed and declined.

---

## The headline

**We should borrow far less here than on the ACAPS side, and for a structural reason: Doorway is not competing with anyone on features. It is competing on installability.** Every incumbent is better than us at something — message research, distribution, clinical handoff — and none of them ships a self-serve module. Copying their features would make us a worse consultancy. Copying their *mechanisms* is where the value is.

**Three adoptions, two partial, four refusals.**

---

## Part 1 · The shortlist

| # | From | What | Works better? | Proven? | Verdict |
|---|---|---|---|---|---|
| 1 | **Project Intercept** | The four-message structure | Yes — research-derived, deployed at scale | Reported at scale by the charity (70M+ warnings; self-reported, not independently evaluated in the dossier) | **ADOPT — already in** ✓ |
| 2 | **Prichard 2022/2024** | IP-trace and illegality framing beat harm framing at point of entry | Yes at the entry endpoint | **Yes, two RCTs** | **ADOPT — high value** |
| 3 | **Best Practice Guide** (CSAM Deterrence Centre / Lucy Faithfull Foundation, v3, April 2026) | Source credibility; message variation; honest legal framing | Yes | Practitioner consensus + Watters review | **PARTIAL — credibility only** |
| 4 | **reThink** | Chatbot as a *bridge* between warning and helpline | Yes — 80% used buttons, 132/1,650 conversations analysable | Field evidence of what *fails* | **ADOPT the pattern, not the chatbot** |
| 5 | **Google Onebox** | Placing the message above the results rather than replacing the page | Works at real scale | Yes — −3.8pp within-session | **PARTIAL — as the third-exposure format** |
| 6 | **Ahmia (2024)** | Turning off the results entirely | Best measured click-through anywhere | Yes — 12.44% | **REFUSE — not available to a plug-in** |
| 7 | **Intercept** | Per-partner bespoke message research | Yes, and we cannot match it | Yes | **REFUSE — it's the model we're replacing** |
| 8 | **Cloudflare / Shield / PhotoDNA** | Detection stack | Yes, free (the dossier's view) | Yes | **ADOPT — already bundled** ✓ |
| 9 | **Offlimits capacity routing** | Self-help first, humans second | Necessary, not better | Operational | **ADOPT — already in** ✓ |

---

## Part 2 · The three real adoptions

### A1 · Put the legal consequence on the first screen. The RCTs say so, and our brief's framing is wrong.

This is the biggest single change and it corrects a mistake in the blueprint.

**What the evidence actually says.** Two randomised trials by Prichard and colleagues, on honeypot sites (2022 and 2024):

| Trial | Finding |
|---|---|
| 2022 (*Sexual Abuse* 34:106) | **IP-trace deterrence OR 2.64** (1.42–4.90); **illegality warning OR 2.99** (1.65–5.41); **harm message OR 1.31 — not significant** |
| 2024 (*Child Abuse & Neglect* 155:106955) | Control entry **75%** → warned **35–47%**; deterrent+image **OR 5.02**; therapeutic text **OR 4.06**; images added nothing |

So at the **entry** endpoint — which is what a gate is — legality and consequence framing is, on the dossier's reading, the best-evidenced finding it reports.

**Meanwhile ACAPS-adjacent framing in our own materials said "harm first."** That came from the Ahmia result, where a harm-focused message produced the most clicks **to help**. Two different endpoints. The original blueprint began with a harm message on first exposure. **The shipped sequence now reverses that order** (gate first; `docs/12`).

### The corrected Shift

| Exposure | Shape (shipped) | Message family | Why |
|---|---|---|---|
| 1 | **Gate** | **Legal — art. 252, and the real consequence** (neutral copy until counsel reviews the record, `docs/04` V12) | The entry endpoint. The RCTs report OR 2.64–5.02. |
| 2 | Card | Harm — what the material is a record of | Once they know the cost and are still here, the belief to answer is "nobody was hurt" |
| 3–4 | Hallway | Control — what reaching out would involve | Rehearse the contact before making it |
| 5 | Door | Control — presence, not pressure | The threat has failed four times; only the way out is left |

**One-line justification for the pitch:** *"We changed the order because the literature has two endpoints and our brief conflates them. Deterrence wins at the door — two RCTs. Harm wins at the exit — one field experiment. So the door says what it costs and the exit says what it is."*

**And the copy fix that comes with it:** name the **actual** consequence, not the headline. "Up to six years" is accurate and nobody believes it. *A criminal record, up to 240 hours of community service, a suspended sentence with conditions, and a probation period of up to ten years* is more deterrent because it is credible. The dossier's reading is that this is what OM guideline 2024R006 sets for a first offender. The copy is not shown to visitors until counsel has reviewed it (`docs/04` V12).

**Cost:** 2 hours (estimate). **Trajectory:** ★★★ (the founder's rating) — this is the highest-value change in either adoption review.

---

### A2 · Attribution, from the Best Practice Guide and Watters et al.

**What they say.** Source credibility is one of the guide's core principles: messages attributed to a credible source outperform anonymous warnings, and Watters' 2026 review lists it as a key distinction in the evidence.

**What we have.** The organisers' starter widget has no attribution at all (the dossier's reading). Our blueprint says "attributed jointly" and never specifies it.

**Adopt:** every message carries a visible, named attribution — **the platform and Offlimits**, with the platform named first. Not "the government," not a generic logo, and never a claim of police authority we do not have.

**Why the platform first:** the person is on that platform, distrusting it slightly, and a joint attribution reads as *"the thing I am using is telling me this and the people who help are agreeing."* Sole charity attribution reads as an ad; sole platform attribution reads as a deflection.

**Cost:** 30 minutes (estimate). **Trajectory:** ★★

---

### A3 · The escalation pattern from reThink, without the chatbot

**What reThink proved.** A warning page alone is a dead end. Their programme worked as **warning → chatbot → live helpline**, with buttons rather than free text — 80% of users chose buttons, and only 132 of ~1,650 conversations were analysable as text. Their own recommendation: be "empathetic without being therapeutic," and connect directly to a live human.

**What we already do.** The shipped sequence is gate → card → hallway → hallway → door. It shows what reaching out would involve, but it does not hand over to a live person. The one-tap live handoff is not built.

**Adopt the missing piece:** the escalation must end in **a real handoff**, not a link to a homepage. The dossier's reading of reThink calls for a live human chat. Specifically: a one-tap route that opens the help service's own chat if it is open, or tells the person honestly when it opens next and offers self-help now.

**Refuse the rest:** no free-text therapy, no AI counselling, no "have you considered" dialogue trees. reThink's failure is instructive — a hackathon chatbot will be worse than theirs, and the harm of a bad therapeutic interaction is not symmetric with the benefit of a good one.

**Cost:** 1 hour (estimate). **Trajectory:** ★★

---

## Part 3 · The two partials

### P1 · Google's placement — borrow the idea, refuse the form

Google's Onebox sits **above** the results, and it worked: −3.8 percentage points of follow-up CSAM queries in-session, −5.6 in Europe, at 0.73% help click-through. Real, measured, at enormous scale.

**What to take:** the finding that **a message adjacent to the results still moves behaviour** — which is the honest ceiling for platforms that will never accept a full gate, and it justifies the Blur and Card formats existing at all.

**What not to take:** the Onebox as the default. It is the weakest-evidenced format we have (0.73% versus Ahmia's 12.44%) and the whole thesis of the product is that placement is the variable. **Google's number is the thing we are trying to beat, not the thing to copy.** Cite it as the floor.

### P2 · Habituation handling — the guide names the principle; we have the only mechanism

The Best Practice Guide lists message variation among its core principles and warns against static deployment. Watters et al. model it. **No deployment implements it.**

So there is nothing to adopt — the principle is universal, and we found no deployment that implements it in the sources we read. **Keep ours, and cite theirs as agreement rather than as a source we borrowed from.** That distinction is worth making explicitly in the pitch, because it is the one place where we are ahead rather than integrating.

---

## Part 4 · What we refuse, and why each refusal is a strength

### R1 · Ahmia's strongest move is not available to us
Turning off the results entirely produced the best number in the field — and a plug-in cannot do it. **Say this out loud.** A team that claims Ahmia-like rates from a module is claiming something a juror from Tampere will immediately know is impossible. *"We cannot remove the platform's alternatives; we can withhold the result until they act. That is the strongest thing an installable module can do, and gate-versus-banner has never been tested."*

### R2 · Intercept's per-partner research model
It is genuinely better than what we can do. It is also the exact model we exist to replace, because it does not scale to the tail. **Position against the model, never against the quality.**

### R3 · A counselling chatbot
Covered above. The asymmetry of harm is the argument.

### R4 · Age verification
Politically live, technically a different product, and it would turn a help-seeking intervention into an identity-requiring one — which the Protect Children data says people actively avoid. **Mention as adjacent; do not build.**

---

## Part 5 · The comparison table to keep in the repository

Because "we avoided reinventing the wheel" is a claim a jury will test, and this is how you pass it.

| Component of Doorway | Built by us | Borrowed | Borrowed from | Why not built |
|---|---|---|---|---|
| The gate format | ✓ | | | Nobody ships one |
| The Shift / rotation | ✓ | | | Principle is universal, implementation is empty |
| Seven fields of the counter | ✓ | | (contract shape) | Kit's contract minus the session ID |
| Language-first routing | ✓ | | | No maintained table exists |
| Legal-consequence copy | | ✓ | Prichard RCTs; OM 2024R006 | Two RCTs is more than we can argue |
| Four-message structure | | ✓ | Project Intercept | Research-derived, deployed at scale |
| Source attribution | | ✓ | Best Practice Guide v3; Watters 2026 | Established, costs 30 minutes |
| Escalation to a human | | ✓ | reThink | Field-tested pattern |
| Detection stack | | ✓ | Cloudflare, Arachnid, PhotoDNA, IWF | Free and solved; reimplementing would be negligent |
| Help-service data | | ✓ | Offlimits; ReDirection | It is their data |
| Message-variant testing harness | ✓ | | | Nothing to borrow |

**Six of eleven components are borrowed outright.** That ratio is the answer to "did you reinvent the wheel."

---

## Part 6 · What changes, in short

| # | Change | Type | Cost | Trajectory |
|---|---|---|---|---|
| 1 | **Reverse the Shift: legal at the door, harm at the exit** | **Correction to our design. Done in the shipped sequence; the legal wording waits on counsel (V12).** | 2 h (estimate) | ★★★ |
| 2 | Name the real consequence, not the six-year headline | Correction | incl. above | ★★★ |
| 3 | Named joint attribution on every message | Adoption | 30 min | ★★ |
| 4 | Chat's third turn ends in a real handoff | Adoption from reThink | 1 h | ★★ |
| 5 | Cite Google's 0.73% as the floor, and Ahmia's 12.44% as the highest of the four deployments | Framing | 0 | ★★ |
| 6 | Publish the built-vs-borrowed table | Framing | 30 min | ★★ |
| 7 | Refuse: counselling chatbot, age verification, Ahmia's move, Intercept's model | Refusals | 0 | — |

**Item 1 is the one that matters.** The blueprint currently opens with a harm message on first exposure, and the two best RCTs in the field say that is the weakest of the three framings at the entry point. Reversing it costs two hours and converts the product's central sequence from a plausible story into a cited one.

---

*Sources: Prichard et al. 2022 (Sexual Abuse 34:106–124); Prichard et al. 2024 (Child Abuse & Neglect 155:106955); Ó Ciardha et al. 2026 (arXiv:2606.06417); Umbach et al. 2026 (arXiv:2606.06126); Scanlan et al. 2024 reThink evaluation; Watters, Scanlan & Jain 2026 (Electronics 15:17, 4045); Watters et al. 2026 (Electronics 15:11, 2281); CSAM Deterrence Centre / Lucy Faithfull Foundation, Best Practice Guide v3 (April 2026); OM Richtlijn voor strafvordering kinderpornografie 2024R006. As cited in `research/unicri-research.html`. Every figure above is in `docs/16-claims-ledger.md`.*
