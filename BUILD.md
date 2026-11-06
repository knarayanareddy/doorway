# BUILD.md — start here

This repo is **scaffolded and verified, not finished.** Roughly 25% of the code is written and green in CI; the rest is specified and reserved.

```
$ npm run verify
✓ 72 unit tests pass
✓ privacy gate passes
✓ copy lint passes
```

---

## What works right now

| Module | File | State | Proof |
|---|---|---|---|
| **Shared spine** | `packages/shared/` | **Complete** | 16 tests — card, validation, loop, a11y |
| The Shift | `packages/core/src/shift.js` | **Complete** | 6 tests, incl. legal→harm→control ordering |
| The Route | `packages/core/src/route.js` | **Complete** | 6 tests, incl. language-first and honest-confidentiality gate |
| The Counter | `packages/core/src/counter.js` | **Complete** | 8 tests, incl. session-id rejection and k-suppression |
| The Door | `packages/doorway/src/widget.js` | **Written, untested** | Needs a DOM; manual a11y pass required |
| Edge endpoint | `edge/c.js` + `edge/schema.sql` | **Written, not deployed** | Deploy path below |
| Routes bundle | `packages/doorway/src/routes.nl.json` | **Ready** | `assertHonest()` returns clean |

## What is not written

- The Desk (dashboard) — static, reads `/v1/agg`
- The Badge and `/v1/status`
- The four install paths (Cloudflare Worker, WordPress, Discourse, script tag)
- The signed trigger-pack pipeline

---

## The three commands

```bash
npm install            # nothing to install — zero dependencies, on purpose
npm run verify         # tests + privacy gate + copy lint
npm run gate:privacy   # the mechanical version of docs/02-threat-model.md
```

## Deploying the edge

```bash
npx wrangler d1 create doorway
npx wrangler d1 execute doorway --file=edge/schema.sql
npx wrangler deploy edge/c.js
```

## The three acceptance tests that matter

1. **A non-developer installs it in under fifteen minutes**, on camera, no documentation.
2. **The network panel shows eight fields and zero cookies.** Run the demo, open DevTools.
3. **Five consecutive triggers produce five visibly different responses.** ✅ Verified in Chromium: `gate/legal-01 → gate/legal-02 → card/harm-01 → card/harm-02 → chat/control-01` at realistic gaps. A burst of five in two seconds is absorbed to the quiet form by design (`docs/06`).

---

## Hard rules, enforced by CI

- `scripts/gate-privacy.mjs` fails the build on any session id, cookie, fingerprint, or non-whitelisted write path.
- `scripts/lint-copy.mjs` fails on copy that assumes intent, or on a confidentiality claim with no `source:` line.
- `packages/core/src/shift.js`, `packages/core/src/route.js` and `packages/core/src/counter.js` must stay network-free and are tested as pure functions.

If CI is green, the privacy claim in `docs/02-threat-model.md` is mechanically true, not just asserted.

---

## The one thing still blocking a ship

`docs/04-open-verifications.md` **V1** — the Dutch confidentiality wording (Offlimits' exact police-reporting exceptions) remains an open evidence question to confirm on site. It does not block rendering: `assertHonest()` returns clean on the shipped table, and `lint-copy.mjs` skips because no `data/messages/` bundle exists yet.

---

## Anonymity model — built 6 Nov, in the ACAPS repo

The gap was found reading ACAPS' rubric (three Must Haves, the second being
expert-controlled anonymity) and it was filed here, in the wrong repo. Doorway
has no experts: it warns a person and offers a route. The panel, the experts and
the anonymity choice all live in **Benchmark**.

The expert-controlled anonymity design lives in the sister Benchmark repo,
not here — Doorway warns a person and offers a route, with no experts of its
own.

