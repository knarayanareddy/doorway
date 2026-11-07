# Doorway — UNICRI, *Stop Before It Starts*

A free, self-serve **response layer** for small platforms. When the platform's own tooling flags a search, Doorway puts a gate in front of it rather than a banner beside it, changes shape with each repeat, and routes the person to the right help service in the right language, without the platform, or anyone else, learning who they are.

**What it is not: a detector.** Doorway does not find anything. A trigger is a *kind* (`search`, `chat`, `nav`) that your platform, a hotline's member list or a moderation queue supplies. Doorway is never told what matched and ships no term list (`docs/02` R4, `docs/08`).

**Status: a tested prototype with a real install path. Not deployed to production, not piloted.** The Door runs in a sandboxed cross-origin iframe, the routes bundle is signed with a development key, the edge counter and the Desk are written and tested locally, and a script-tag install and a WordPress plugin are built. Verified so far: a WordPress 7.1.4 run and one Discourse run in a sandbox (`docs/09`, `docs/14`). The install target (under 15 minutes for a non-developer) has not been measured by a non-developer. What stands between this and a pilot is listed in [`docs/03-the-gap-to-real.md`](docs/03-the-gap-to-real.md). Numbers drift, so they are not written here: run `npm run status`.

## Install

Start with [`INSTALL.md`](INSTALL.md): a quickstart, what you do not have to do, and the install-time protocol.

## Run it locally

```bash
npm ci
npm run verify       # shared modules, safety, lint and privacy tripwire, unit and edge tests, signed routes, copy lint, docs
npm run e2e          # real Chromium (first run: npx playwright install chromium)
npm run demo:app     # builds the app, then serves the Door (http://127.0.0.1:8788) and the platform (http://127.0.0.1:8789)
```

Open **http://127.0.0.1:8789/app/**. The app has two tabs:

- **Live prototype.** Each press calls the real loader, which opens the real Door. The Door is the same code a platform installs.
- **The Desk.** Reads the real `/v1/agg` for the demo install `inst_demo001` through a same-origin proxy. Token: `desk-demo-token`. A synthetic Desk view is also there and is labelled as invented.

Other demo entry points: `npm run demo` (the mock forum with the Door, no app build) and `npm run demo:labs` (adds the labs shapes and the labs page at `http://127.0.0.1:8789/mock-platform/labs.html`).

**The five exposures.** The shipped sequence is gate, card, hallway, hallway, door (`packages/core/src/shift.js`; `docs/12`). A quiet pill appears only after the person has acted. In the demo, the `advance` lab makes every press show the next step, whatever happened on the last one, so all five are visible in one sitting.

**Demo only, not in a shipped Door:**

- the `advance` and `preview` labs (`packages/doorway/src/labs.js`; a preview is never counted);
- `fork` and `wave`, which the demo edge accepts (`LABS_FORMATS` defaults to `fork,wave`; a production edge leaves it unset);
- `routes.demo.json`, whose hours and numbers are marked "Demo data";
- the public Desk token and the seeded install `inst_demo001` (30 days of synthetic data);
- the synthetic Desk view.

---

## Read in this order

| # | Document | What it is |
|---|---|---|
| 1 | [`INSTALL.md`](INSTALL.md) | Quickstart, what you do not have to do, the install-time protocol. |
| 2 | [`DOORWAY-blueprint.html`](DOORWAY-blueprint.html) | **The build blueprint.** Architecture, state machine, install paths, build order, acceptance tests. Sections 03–06 and 11–17 are Doorway-specific; the rest is general background. It is a historical spec: where it differs from the code, the code and `docs/07-review-response.md` win. |
| 3 | [`research/unicri-research.html`](research/unicri-research.html) | **The evidence dossier.** The sources behind the numbers in this repo. §13 is the source list. |
| 4 | [`research/03-dataset-ping-app.html`](research/03-dataset-ping-app.html) | The Nurmi dataset question: what is and is not released, and the app-versus-PWA decision. |
| 5 | [`docs/01-one-pager.md`](docs/01-one-pager.md) | The submission one-pager. |
| 6 | [`docs/02-threat-model.md`](docs/02-threat-model.md) | What Doorway refuses to do, and why each refusal is load-bearing. |
| 7 | [`docs/03-the-gap-to-real.md`](docs/03-the-gap-to-real.md) | **Read this before pitching it as a product.** The gap to a pilot, with owners. |
| 8 | [`docs/04-open-verifications.md`](docs/04-open-verifications.md) | Every claim still unverified, with the question to ask and who to ask. |
| 9 | [`docs/16-claims-ledger.md`](docs/16-claims-ledger.md) | Every number a juror could check, with its source and status. |
| 10 | [`docs/05-adoption-review.md`](docs/05-adoption-review.md) | What competitors do better, and what we borrow. |
| 11 | [`CHANGELOG.md`](CHANGELOG.md) | What changed, release by release. |

---

## The thesis, with its sources

Full list, with the exact quote for each figure: [`docs/16-claims-ledger.md`](docs/16-claims-ledger.md).

- In a survey (Insoll et al. 2024, n = 4,493), **55%** said they wanted to stop. Of the 266 who had tried to get help, **70.2%** struggled to find an anonymous route. Another survey (Nurmi et al. 2024, a Tor population, self-selected) found **73.9%** of those who sought help could not get it.
- Seven free tools exist to find illegal images on a small platform. Zero exist to interrupt the person looking (quoted from the dossier).
- Help-click rates across four deployments range from **0.0175%** (Pornhub, reThink) to **12.44%** (Ahmia): about 700 times. The dossier reads this as tracking how many alternatives were on screen. The four deployments differ in many ways, so that reading is a hypothesis, not a controlled result.
- Nobody has shown that a warning reduces searching beyond the next few minutes. Ahmia randomised over 3 million warnings across 140 days and found no detectable reduction in searching.

---

## The five things that must be true

1. A non-developer can install it in under fifteen minutes, on camera, without documentation. **Target. Not yet measured by a non-developer** (`INSTALL.md`, "Time to install").
2. The network panel shows the seven fields and no cookie (`test/e2e/network.spec.js`; the privacy gate flags cookie use).
3. Five exposures produce a sequence of shapes, not a repeated banner: gate, card, hallway, hallway, door. A retry inside the re-warning window escalates in place as an inline card and never answers with a pill unless the person has already acted (`packages/doorway/test/shift.test.js` asserts the spaced and the burst sequence).
4. Confidentiality and legal wording renders only from a structured record that names who confirmed it and when. Until a service confirms its own wording, copy is neutral. One predicate, `isRenderableConfidence`, is checked in CI.
5. Somebody can answer "does it work?" without flinching. The answer is *not proven, and nobody's is.*

---

## What this is not

- Not a detector and not a classifier. There is no model, no score and no term list.
- Not proven to work. The Desk shows only what each install's own page reported, and says so.
- Not deployed to production. The edge has been run locally against the real schema and Worker code, and the demo has run on a temporary sandbox (`docs/14`). It is not on Cloudflare.
- Not endorsed by any help service. Each route needs a written OK from its service before a pilot (`docs/04` V13).

---

*Hackathon for Good #8 · UNICRI · Stop Before It Starts · 6–8 November 2026*
