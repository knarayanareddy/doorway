# Which parts of the organisers' repos we take, and why

*Written 6 November 2026, after reading both starter repositories file by file.*

---

## The short answer

**Do not clone either repo to build in. Do take four things from them by hand.**

Cloning gives you a working tree you will inevitably push with your own work
mixed into somebody else's scaffold. Neither challenge asks for that, both
repos are MIT, and both organisers say the same thing in their own words: use
it as a **starter kit**, and deliver **your fork**. A fork carries the history
of the thing you did not write, and a juror who opens the commit log sees
`Initial repo setup` under your name.

What you actually need from them is small, specific, and copyable in minutes.

---

## What is worth taking

| # | Asset | From | Why | How |
|---|---|---|---|---|
| 1 | **`mock-platform/`** | UNICRI | The deliverable is *"a working prototype, shown in the mock platform."* It is the only way to demonstrate install in front of a jury without a live platform. | Vendor it, unmodified, into `vendor/mock-platform/`. |
| 2 | **`contract/`** (7 JSON schemas + `PLUGIN_CONTRACT.md`) | UNICRI | We wrote an adapter to a contract without the contract ever being in our repo — which is exactly how a contract gets silently violated. | Vendor `vendor/contract/` and assert against the schemas. |
| 3 | **`references/acaps-risk-methodology.pdf`** | ACAPS | One page, and it is the document that defines the 5×5 we score the export against. We had been citing the matrix from a markdown transcription. | Copy into `docs/`; cite it directly. |
| 4 | **`docs/data-dictionary.md`** | ACAPS | Field-by-field coverage percentages, plus the organisers' own published rates (84% of High materialised, 32/38). Our numbers must reconcile with theirs, and now they do. | Read once; cite it. Do not vendor — it would drift. |

Everything else in both repos is already in ours, better or equivalent. See the
audit at the bottom.

---

## What not to take, and the specific reason

**UNICRI's `data/*.json`** — we already have the same facts, and in three places
ours are stronger. Their `help-services.json` gives Offlimits' channel as
`["phone","chat"]`; ours resolves `chat` for the human-capacity route and falls
back correctly. Their `stoppen-is-mogelijk` URL is `stoppen-is-mogelijk.eu`;
ours says `stoppenismogelijk.nl`, which redirects to `stoppenismogelijk.eu` but
not the other way around. Their file is right and ours has a dead-ish path. **Fix
ours; do not adopt theirs wholesale**, because ours also carries the
language-first alternatives the brief asks for.

**ACAPS' `notebooks/data-exploration.ipynb`** — its trigger parser is the
200-character version that our `scripts/ingest.py` supersedes. Adopting it would
be a regression. This is worth saying out loud in the pitch: the starter
notebook stops where most teams will stop.

**ACAPS' `risk-radar-export.xlsx`** — 2.4 MB duplicate of the CSV, with
`_x000D_` artefacts. No.

**Both `CLAUDE.md` files** — context files for a different assistant. Noise.

---

## The one real gap this exposed

The ACAPS evaluation criteria list exactly three **Must Have** items:

1. Easy to use
2. **Expert-controlled anonymity** — each expert chooses their level (known to
   ACAPS, pseudonymous to peers, or fully anonymous)
3. Public anonymity

We had **none of the second one.** `grep` for `pseudonym` across our whole build
returned a single hit, in a lint rule that *forbids* claiming anonymity. Our
design had experts as identified accounts, full stop — and anonymity is a
**Must**, not a Could, in the organisers' own rubric.

That is a bigger finding than "should we clone the repo", and it came from
reading the repo we were deciding whether to clone. It is now the top item in
`BUILD.md`'s not-built list.

---

## What the repos proved we got right

Worth recording, because it is evidence for the pitch rather than for us:

- **Our privacy design matches theirs on every substantive point.** Their contract
  says: no query text, no persistent user IDs, no cookies, no fingerprinting, no
  IP logging, aggregate-only metrics, suppress counts below 10. Our counter: seven
  fields, no session id, hour-of-day rather than timestamp, `5+` bucket, k=10
  suppression, and a strict whitelist that *rejects* unknown keys rather than
  stripping them. Two independent designs converged.
- **Our Shift does something their contract does not attempt.** They pass
  `severity` and expect the module to decide once. We carry state across
  exposures so the fifth contact looks different from the first. The contract has
  no vocabulary for that; our adapter adds it in one mapping function.
- **`art. 252 Sr`, the `254(1)(c)` uplift, the 1 July 2024 date, and the
  "formerly Stop it Now Nederland" rename all check out** against their
  `legal-confidentiality.json`.
- **Offlimits' confidentiality line is now sourced.** Their file states no
  mandatory reporting obligation for the prevention line, with the general
  citizen duty to report acute danger explicitly not extending to anonymous
  helpline conversations. That is their assertion with their source, not ours —
  which is exactly what our open-verification rule requires. See
  `docs/04-open-verifications.md` V1, now downgraded from blocker to
  *attributed claim, still worth one question on site*.

---

## The adapter

`packages/doorway/src/sbis-adapter.js` — maps the contract onto the loader (see `docs/02` R9 for the deliberate `outcome` departure).

It maps the contract's `sbis:trigger` onto the Shift, maps the Shift's format
onto the contract's five outcomes, and hands the trigger to the loader; the counter payload is built inside the Door.
Three deliberate choices:

- **`low` severity never interrupts.** The contract's own schema defines low as
  "subtle info link". A full-screen takeover on a low signal is how a widget gets
  uninstalled.
- **`sessionScopedId` and `timestamp` are never read.** They are present in the
  event; the adapter ignores both. Our counter rejects unknown keys, so they
  could not be forwarded even by accident.
- **`durationMs` is reported as 0, not measured.** Timing the intervention means
  running a timer on a stranger's page. The host can measure it; we will not.

---

## If you still want to run their mock platform

```bash
git clone --depth 1 https://github.com/Hackathon-for-Good-The-Hague/HFG8-UNICRI-Stop-Before-It-Starts.git /tmp/sbis
cd /tmp/sbis && npm install && npm run dev
# in mock-platform/index.html, swap the script tag for our adapter
```

Keep it in `/tmp`. Do not fork, do not push it, do not let it become a
submodule. It is a test harness, not a foundation.

---

## Audit: what is in their repos that we do not have

**UNICRI** — `mock-platform/` (take), `contract/` (take), `tools/generate-traffic.js`
(useful for demoing volume; take if cheap), `tools/dashboard/` (ours is better —
seven fields versus their six aggregate counts), `starter-widget/` (ours is
stronger: shadow DOM, focus trap, five formats), `starter-backend/` (ours is
Cloudflare Workers + D1; theirs is Express — no reason to move),
`integrations/` (WordPress PHP plugin we do not have; our blueprint specifies
install paths but ships no code — worth a look before building ours),
`research/EVIDENCE.md` / `PERSONAS.md` / `READING.md` (already absorbed; our
dossier is longer).

**ACAPS** — `references/` PDF (take), `docs/*.md` (read, don't vendor),
`notebooks/` (superseded), `data/*.xlsx` (duplicate).

---

## The rule this leaves behind

> Take **harnesses and contracts**, not scaffolds. A mock platform is an asset
> because it is how you demonstrate. A starter repo is a liability because it is
> how you end up presenting somebody else's code as your own.

---

## The test that failed

Once the adapter was wired, the mock platform could be driven by a real browser
engine — Chromium via Playwright, no mocks. Five consecutive `sbis:trigger`
events at `severity: high`, dismissing each time, produced:

```
["gate", "quiet", "quiet", "quiet", "quiet"]
```

**Two distinct forms, not five.** Acceptance test #3 in `README.md` and
`BUILD.md` — *"five consecutive triggers produce five visibly different
responses"* — does not hold, and the reason is not a bug in the widget.

`shift.js` sets `minIntervalHours: 72` and, inside that window, returns
`HABITUATED → quiet` before it ever consults the counter. The unit tests pass
because they call `pick()` with an explicit `now`, stepping time forward between
calls. A browser fires five triggers within two seconds. The interval wins, and
the Shift never gets to show its second, third, fourth or fifth form.

This is exactly the class of defect that only a real integration test finds: the
pure function is correct, the state machine is correct, the test suite is green,
and the product does not do the thing written on the front of the box.

**It is a design decision, not a coding error, and it has to be made explicitly.**
Two coherent resolutions:

1. **The interval is right and the acceptance test is wrong.** A person who sees
   five interstitials in an hour should see the quiet form — that is the
   anti-nagging rule doing its job. Then test #3 must be rewritten as *"five
   exposures over five days produce five different forms"*, and the demo must
   manipulate the stored timestamp, not just fire five events.
2. **The interval is too coarse.** 72 hours may be too long for the first few
   exposures: the Shift's whole argument is that the *form* should change with
   repetition, which presupposes the person is exposed repeatedly. A short
   first-interval (say 10 minutes for exposures 1→2) that widens as the count
   rises would let five exposures in a session show five forms while still
   refusing to nag a daily user.

**RESOLVED, 6 Nov — and the resolution was smaller than this section claimed.**

Two things were wrong, and only one of them was about the interval.

**1. The interval.** `minIntervalHours: 72` is now `intervalHours: [0, 10min, 6h, 72h]`,
indexed by exposure count (`shift.js` → `intervalFor()`). The first gap is
minutes because a person who comes back after ten minutes is a returning user,
not a nag target; by the fourth exposure the window is the original 72 hours, so
nothing about a daily user's experience changed. `npm run e2e` section E now
walks five spaced exposures to `5 / 5 distinct messages`.

**2. The real defect, which this section missed.** `variantFor()` returns
`legal-01`, `legal-02`, `legal-03` — but `widget.js` held **one** message per
family and always rendered index 0. So the beacon reported three variants in use
while a person saw the same paragraph three times. The dashboard would have
shown rotation that never reached anyone: a metric that cannot be falsified,
which is worse than having no metric. There are now three messages per family,
indexed by the variant id (`variantIndex()`), and `copy-variants.test.js` holds
the invariant that the pool size and the copy table agree.

That second one is the lesson worth keeping: the first browser run was read as
"the Shift does not fire", when it was also "the copy table is a lie". Both were
only visible by putting a real trigger through a real browser and reading what a
person would read.

**Still true, and should be said out loud in the pitch:** five triggers *two
seconds* apart produce `gate, quiet, quiet, quiet, quiet`. That is the
anti-nagging rule working. Section E of the e2e asserts that exact sequence, so
it is a stated behaviour rather than a found defect. Acceptance test #3 holds
when "consecutive" means what it means in use — a returning person, not a
pentest.


---

## Found by reading the contract against the code (6 Nov, second pass)

`contract/PLUGIN_CONTRACT.md` lists `country` as a **required** field of every
trigger event, ISO 3166-1 alpha-2. Our adapter normalised it, stored it, and then
never used it: `route.js` resolved on language alone.

That is not a cosmetic gap. A German-speaking user in Germany was offered
`uk-stopitnow` — a UK phone number — because `de` had no entry and the chain fell
through to `en`. Verified in a browser, then fixed.

The fix is in four places and each one matters:

- **`route.js`** — `normaliseCountry`, `servesCountry`, and a four-step
  degradation ladder (in-country service → self-help in your language →
  out-of-country service *labelled as such* → nothing). The last step is
  deliberate: a wrong number is worse than no number.
- **`routes.nl.json`** — Germany added. `kein-taeter-werden` was in the
  organisers' own `data/help-services.json` and we had never wired it.
- **`widget.js`** — `setCountry()` so the adapter can set it per trigger.
- **`sbis-adapter.js`** — passes `t.country` before resolving.

Country filters; it never overrides language. A Turkish speaker in the
Netherlands still does not get a Dutch-only line, and a test holds that.

Seven new tests. The lesson generalises: **a contract field that is read and then
ignored is more dangerous than one that is missing**, because the code looks
correct at every level.

---

## Superseded, 7 Nov

The paragraph above ("five triggers *two seconds* apart produce `gate, quiet, quiet,
quiet, quiet`. That is the anti-nagging rule working") is **no longer true, and was
wrong to call it working.** The review (H1) pointed out that re-searching right after a
warning is the strongest signal the system ever sees, and it was being answered with
the weakest response. Inside the re-warning window the Shift now escalates in place as
an inline card and does not reset the clock; true quiet is reserved for someone who has
already clicked, dismissed or continued, and only for 72 hours. The burst is now
`gate/legal, card/legal, card/harm, card/harm, chat/control` (`shift.test.js`).
