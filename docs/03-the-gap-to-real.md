# Is this a full-fledged product?

**Doorway, assessed honestly against a real definition of "product."**

*Written before the code existed. For the current state see `BUILD.md` and `docs/07-review-response.md`; some "not written" statements below are out of date.*

*A "full-fledged product" is one that a stranger can adopt, operate and depend on without you in the room. Not a demo that works, not a prototype that impresses — a thing that keeps working when the team goes home.*

---

## The short answer

**No. Doorway is not a full-fledged product. It was a complete product *specification* with a prototype-shaped demo path.**

That is a specific and defensible claim, not a put-down. Here is the difference measured against something you can check.

| Dimension | A full-fledged product needs | Doorway today |
|---|---|---|
| **Runs** | Deployed, monitored, uptime | Not written. Blueprint specifies it, ~3,000 lines. |
| **Adopts without you** | Docs a stranger can follow to success | Four install paths specified; `INSTALL.md` unwritten |
| **Answers to a customer** | SLA, support, an owner | Nobody. It is a hackathon entry. |
| **Sustains itself** | Content maintenance, funding, a legal entity | Message bundles and routes need monthly editing by a human who does not exist yet |
| **Proves itself** | Evidence that the intervention works | **No.** No published study shows a warning reduces use beyond minutes. |
| **Survives scrutiny** | Security review, DPIA, licence, governance | Privacy design is strong; DPIA, governance and licence clarity untested |

So: **a spec, not a product.** In the taxonomy:

```
idea  →  concept  →  specification  →  prototype  →  pilot  →  product  →  platform
                          ▲
                    you are here
```

What you have is unusually *deep* for this stage — the specification is complete enough that the build is mechanical — and unusually *honest* about what it does not have. That is worth more than a working demo of a product with no reason to exist.

---

## Assumption: all the time in the world

This is the good version of the question, because the binding constraint on a real product is almost never build time. Remove the clock and the real constraints appear.

### What time does not fix

Three of these are structural and no amount of time closes them. They are the actual answer to *"is this a full-fledged product?"*

1. **Nobody has demonstrated that warnings reduce use beyond minutes.** Ahmia randomised 3.1 million warnings over 140 days and found no detectable reduction in searching. Google's −3.8pp is within-session. Time does not change this — only a study does, and the study has to be funded by someone who believes it enough to pay first.

2. **Voluntary adoption at the tail of platforms has never worked at scale in this field.** The one platform that changed did so because Mastercard and Visa suspended payments. There is no payment rail at a 20,000-member Dutch forum and the EU regulation that would create one is not law. Time gives you more outreach, not more leverage.


### What time does fix

With unlimited time and competent people, Doorway becomes a product on roughly this schedule — and the numbers are the point, because they are the honest answer to "can this be real?"

| Phase | Duration | What it produces | Who has to exist |
|---|---|---|---|
| **Build** | 6–8 weeks, 2 engineers | The module, edge, dashboard, four install paths. All ten acceptance tests green. |
| **Pilot** | 6 months | 15–25 Dutch platforms live: a forum, a marketplace, a file-share, two adult sites, three Discourse communities. Real volumes. |
| **Evaluation** | 9 months, overlapping | The stepped-wedge study: 20 platforms, randomised by cohort. First published platform-level trial of gate-versus-banner. |
| **Institutionalisation** | 18 months | Offlimits co-maintains the Dutch routes; UNICRI hosts the aggregate feed; Tech Coalition Pathways carries it to the tail |

**Call it 3 years from now to "Product" on the line above**, and 5 to "Platform." That is fast by child-protection standards and it is the honest number.

---

## What full-fledged Doorway would need that the blueprint does not specify

Detailed because this is where the product actually lives, and because a jury is allowed to ask.

### The trust-and-safety desk

A real product has a support burden nobody budgets for:

- **A response time for breakage.** A forum installs this on a Friday and their search breaks because the trigger list matched something legal. Who answers, in what time, and what happens when nobody does?
- **A false-positive appeals loop.** The module blocks a search that a journalist, a survivor or a parent legitimately made. There must be a path where a platform reports this, it gets reviewed, and the list changes. **No deployment in the literature has this and it is the most obvious way Doorway does harm.** *(7 Nov: the mechanical half now exists — `POST /v1/report`, a closed reason list, and a Desk table. The human half, a named reviewer who acts on it monthly, does not.)*
- **Term-list stewardship that fires a human.** Slang in Dutch and English changes monthly. Someone has to own that, and it cannot be the same person who built the module.

### The legal artefacts

- **A DPIA.** Even with seven aggregate fields, a tool that observes searches in a child-protection context needs one in the Netherlands, and it needs updating when the fields change.
- **A data-processing agreement.** The platform's relationship with whoever hosts the counter. Who is the controller, who is the processor, and what happens when a Dutch court asks for the aggregates.
- **A licence that says what it means.** MIT is in the repo, and a UN platform may need something else. A product has this settled.

### The maintenance surface

- **Message content owned by someone.** Six message families × two languages × honest legal text per jurisdiction. Every block needs a named owner, a review date, and a source. This is editorial work and it never stops.
- **Routes that are actually current.** Opening hours, phone numbers, service existence. Offlimits renamed itself in January 2026; services close. A stale route is worse than no route because it looks like help and isn't.
- **Versioned, signed trigger bundles** with a monthly cadence — and the standing tension between "frequent enough to work" and "a public list educates people to avoid it."

### The governance question nobody wants

**Who decides what the warning says?** A platform that installs the module hands over its legal copy to a party that is not the government and is not the platform. That is the right design and it needs a published process: who writes, who reviews, whose veto counts. A product has an answer to "who are you and why do you get to tell my users what is legal."

### The capacity contract

Offlimits takes about 2.6 contacts a day for 17.9 million people. Full-fledged Doorway **has a formal relationship with every service in its routes table** — a named contact, a volume forecast, an agreed referral tag and a review cadence. Without that, the product is sending people to a phone that does not ring.

---

## The honest ranking of what stands in the way

Sorted by how much each one actually blocks a full-fledged product.

| # | Blocker | Fixable with time? | Fixable at all? |
|---|---|---|---|
| 1 | No evidence the intervention works beyond minutes | Only by a funded study | **Yes, eventually** |
| 2 | No adoption mechanism at the tail | Partly — via Tech Coalition, SICs, regulation | Partly. This is a market problem. |
| 3 | No owner: no legal entity, no support desk, no funding | **Yes, completely** | Yes — this is the real work |
| 4 | Capacity of the help services | Partly — by routing to self-help first | Partly |
| 5 | Content maintenance never stops | Yes — by paying someone | Yes |
| 6 | The code does not exist yet | Yes — 6–8 weeks | **Yes, trivially** |

Read that list in order and the conclusion is uncomfortable but useful: **the code is the sixth hardest problem.** Everything above it is organisational.

---

## So what should you call it?

Not "product." The accurate and *more* impressive framing:

> **A complete product specification, an unusually deep evidence base, and a design that has already anticipated its own failure modes — taken to the edge of a build.**

If a juror asks "is this a product?", the right answer is not yes and it is not a hedge. It is:

> "No. Nothing that comes out of 26 hours is. What we have is a specification complete enough to build in six weeks, an evidence base that tells us what to test, and a privacy design we can prove in front of you. The rest is a pilot, and a pilot needs a partner — which is the honest ask."

That answer is stronger than an overclaim, it is impossible to catch out, and it happens to be true.
