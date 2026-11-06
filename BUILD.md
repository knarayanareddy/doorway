# BUILD.md — start here

This repo is **scaffolded and verified, not finished.** Roughly 25% of the code is written and green in CI; the rest is specified and reserved.

```
$ npm run verify
✓ 21 unit tests pass
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
| Routes bundle | `packages/doorway/src/routes.nl.json` | **Draft** | `assertHonest()` still flags V1 |

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
3. **Five consecutive triggers produce five visibly different responses.**

---

## Hard rules, enforced by CI

- `scripts/gate-privacy.mjs` fails the build on any session id, cookie, fingerprint, or non-whitelisted write path.
- `scripts/lint-copy.mjs` fails on copy that assumes intent, or on a confidentiality claim with no `source:` line.
- `packages/core/src/{shift,route,counter}.js` must stay network-free and are tested as pure functions.

If CI is green, the privacy claim in `docs/02-threat-model.md` is mechanically true, not just asserted.

---

## The one thing still blocking a ship

`docs/04-open-verifications.md` **V1** — the Dutch confidentiality wording is unverified. `assertHonest()` will keep flagging it until it is closed, and the copy lint will not let it render.
