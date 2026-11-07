# Doorway — UNICRI, *Stop Before It Starts*

A free, self-serve **response layer** for small platforms. When the platform's own tooling flags a search, Doorway puts a gate in front of it rather than a banner beside it, changes shape every time it fires, and hands the person to the right help service in the right language — without the platform, or anyone else, learning who they are.

**What it is not: a detector.** Doorway does not find anything. A trigger is a *kind* (`search`, `chat`, `nav`) that your platform, a hotline's member list or a moderation queue supplies; Doorway is never told what matched and never ships a term list (`docs/02` R4, `docs/08`).

**Status: a working response layer with a real install path, not yet a pilot.** The Door runs in a sandboxed cross-origin iframe, the routes bundle is signed, the edge counter and a minimal Desk are written and tested, and a script-tag install is built. What stands between this and a pilot is listed, honestly, in [`docs/07-review-response.md`](docs/07-review-response.md): external confirmations (service wording, Dutch counsel, written OKs), a production signing key, a deployed edge, and the recorded non-developer install. Numbers drift, so they are not written here: run `npm run status`.

```bash
npm ci
npm run verify     # shared modules, safety, ESLint privacy tripwire, unit + edge tests, signed routes, privacy gate, copy lint, docs
npm run e2e        # real Chromium: hostile host page, network record, installer errors, Desk (needs: npx playwright install chromium)
npm run demo       # mock platform on :8789, the real edge Worker on :8788
```

---

## Read in this order

| # | Document | What it is | Read time |
|---|---|---|---|
| 1 | [`DOORWAY-blueprint.html`](DOORWAY-blueprint.html) | **The build blueprint.** Architecture, schemas, the Shift state machine, install paths, repo tree, hour-by-hour build order, acceptance tests, rubric map, kill list, pitch script. Sections 03–06, 11–17 are Doorway-specific; 00–02 and 07–10 are general background written when this was planned alongside a second challenge, and can be skipped. The blueprint is a historical spec: where it differs from the code, the code and `docs/07-review-response.md` win. | 45 min |
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
2. The network panel shows seven fields and zero cookies.
3. Five consecutive triggers produce five visibly different responses. A retry inside the re-warning window escalates in place as an inline card (`gate → card → card → card → chat`) and never answers with a pill unless the person has already acted; `packages/doorway/test/shift.test.js` asserts both the spaced and the burst sequence.
4. Confidentiality and legal wording renders only from a structured record naming who confirmed it and when; until a service confirms its own wording, copy is neutral. This is enforced by one predicate (`isRenderableConfidence`) and checked in CI.
5. Somebody can answer "does it work?" without flinching. The answer is *not proven, and nobody's is.*

---

## What this is not

- Not a detector, and not a classifier. There is no model, no score and no term list.
- Not proven to work. Nobody's is: see `research/` and `docs/03-the-gap-to-real.md`. The Desk shows only what each install's own page reported and says so.
- Not deployed. The edge has been run against the real schema and Worker code locally; it has not been deployed to Cloudflare.

---

*Compiled 6 November 2026 · Hackathon for Good #8 · The Hague · submitted Friday evening, before the 26-hour build clock.*
