# Doorway — UNICRI, *Stop Before It Starts*

A free, self-serve install that turns on the detection tools a small platform would never find, puts a gate in front of the search rather than a banner beside it, changes shape every time it fires, and hands the person to the right help service in the right language — without the platform, or anyone else, learning who they are.

**Status: runnable scaffold, not a product.** The pure core, the shared spine, the privacy gates, the plug-in adapter and 66 tests are real and green. The interface layer is not built — see `BUILD.md` for exactly what exists and what does not, and `docs/03-the-gap-to-real.md` for what stands between this and a product.

```bash
npm run verify     # 66 tests, spine check, safety check, privacy gate, copy lint — all green
npm run e2e        # the mock platform in a real browser (needs Chromium)
```

---

## Read in this order

| # | Document | What it is | Read time |
|---|---|---|---|
| 1 | [`DOORWAY-blueprint.html`](DOORWAY-blueprint.html) | **The build blueprint.** Architecture, schemas, the Shift state machine, install paths, repo tree, hour-by-hour build order, acceptance tests, rubric map, kill list, pitch script. Sections 03–06, 11–17 are UNICRI-specific; 00–02 and 07–10 are the shared spine. | 45 min |
| 2 | [`research/unicri-research.html`](research/unicri-research.html) | **The evidence dossier.** Nineteen primary sources read in full, six deployments, eleven adjacent fields, eight scored directions. Sections 01–11 are the evidence; §12 compares the two challenges; §13 is the source list. | 40 min |
| 3 | [`research/03-dataset-ping-app.html`](research/03-dataset-ping-app.html) | The Nurmi dataset question, what is and isn't released, why not to train an LLM on it, and the app-versus-PWA decision. | 12 min |
| 4 | [`docs/05-adoption-review.md`](docs/05-adoption-review.md) | **What competitors do better and what we borrow.** Three adoptions, two partials, four refusals, and one correction to our own message ordering. | 12 min |
| 5 | [`docs/01-one-pager.md`](docs/01-one-pager.md) | The submission one-pager. | 2 min |
| 6 | [`docs/02-threat-model.md`](docs/02-threat-model.md) | What Doorway refuses to do, and why each refusal is load-bearing. | 6 min |
| 7 | [`docs/03-the-gap-to-real.md`](docs/03-the-gap-to-real.md) | **Read this before pitching it as a product.** What "full-fledged" would actually require, with time and cost estimates. | 12 min |
| 8 | [`docs/04-open-verifications.md`](docs/04-open-verifications.md) | Every claim still unverified, with the exact question to ask and who to ask. | 5 min |

---

## The thesis in three numbers

- **55%** of people using CSAM want to stop. **70%** who look for help cannot find an anonymous route. **73.9%** who find a service still do not get help.
- **Seven** free tools exist to find an illegal image on a small platform. **Zero** exist to interrupt the person looking.
- Click-through across the four flagship deployments spans **0.018% to 12.4%** — a 700-fold range that tracks how many alternatives were on screen, not what the message said.

---

## The five things that must be true

1. A non-developer can install it in under fifteen minutes, on camera, without documentation.
2. The network panel shows eight fields and zero cookies.
3. Five spaced triggers produce five visibly different responses (a burst inside the doubling interval collapses to gate, quiet, quiet, quiet, quiet by design) — **verified**: five spaced exposures yield `gate/legal-01`, `gate/legal-02`, `card/harm-01`, `card/harm-02`, `chat/control-01` in a real browser; `npm run e2e` asserts both.
4. The confidentiality copy cites a source you can name.
5. Somebody can answer "does it work?" without flinching. The answer is *not proven, and nobody's is.*

---

## What this is not

Nothing here is a working product. There is no `build/` directory with code in it yet — the blueprint specifies the build, it does not contain it. The gap between the two is documented honestly in [`docs/03-the-gap-to-real.md`](docs/03-the-gap-to-real.md).

---

*Compiled 6 November 2026 · Hackathon for Good #8 · The Hague · submitted Friday evening, before the 26-hour build clock.*
