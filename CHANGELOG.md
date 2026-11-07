# Changelog

All notable changes to Doorway. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/) while it is pre-1.0.

Entries are taken from the git history (`git log`) and from `docs/07-review-response.md`. Nothing is listed that the history does not show. Items marked *working tree* are uncommitted at the time of writing.

## [Unreleased]

Branch `wip/one-app`. Not yet verified end to end: the commit message says the three-browser e2e run was not repeated on that snapshot.

### Added

- The `/app/` build (`npm run demo:app`): one app with two tabs, **Live prototype** and **The Desk**. The Live tab drives the real loader and Door. The Desk tab reads the real `/v1/agg` through a same-origin proxy, with the synthetic view kept and labelled (commit `2d6e7ca`).
- A demo-only **advance** lab: every press shows the next step, whatever happened on the last one. Demo builds only (`packages/doorway/src/labs.js`) (commit `2d6e7ca`).
- Previews are never counted. A forced shape for demonstrations sends nothing (commit `2d6e7ca`; `preview.test.js`).
- The hosted app in the Dockerfile (commit `2d6e7ca`).

### Changed

- Per-shape looks in the prototype: each shape has its own silhouette and layout, on one palette (commit `2d6e7ca`, `prototype/src/lib/shapes.ts`).
- The prototype's Desk is split into a live view and a synthetic view with shared panels (commit `2d6e7ca`, `prototype/src/components/desk/`).
- The demo install's limits are set to 600 requests a minute and 20,000 a day (commit `2d6e7ca`, `scripts/serve-demo.mjs`).
- Docs: `README.md` and `INSTALL.md` rewritten. `INSTALL.md` gains a quickstart, a "what you do not have to do" list and a stopwatch protocol for install time. `docs/16-claims-ledger.md` added. (working tree)
- The Review tab is removed from the app. The Verdict component is deleted (working tree).

### Fixed

- The Door's explanation of what the module receives is corrected: a trigger kind (`search`, `chat`, `nav`), not a boolean (`docs/02`, `docs/01`) (working tree).

### Removed

- The Review tab and its Verdict component (working tree).

### CI (working tree, not yet committed)

- A prototype lint step (`npm run lint:prototype`).
- The hosted e2e step is replaced by the demo Door panel e2e (`npm run e2e:demo`).
- A check that a change to `packages/shared/.fingerprint.json` comes with a dated entry in `FINGERPRINT-LOG.md`.

## [0.2.0] - 2026-11-07

Two merged pull requests: **#4** (review remediation) and **#5** (the levelled-up design). Version `0.2.0` is in `package.json`.

### Added (PR #4, review remediation)

- The Door runs in a sandboxed cross-origin iframe. The host page only runs a stateless loader (`ad1d889`; `docs/02` R9).
- Signed routes bundle (Ed25519, development key), structured confidence and legal records. Confidential and legal wording renders only from a reviewed record (`ad1d889`; `docs/07` B3, B4, B8).
- Edge hardening: writes only from the Door's origin, a 512-byte body cap, per-install rate limits and a daily cap, `POST /v1/verify` with a meta tag or DNS TXT, `POST /v1/report`, a heartbeat for events that could not be sent, and the Desk (`1b6947c`; `docs/07` B2, B6, H4, M4, S1).
- Privacy tripwire: ESLint rules, an AST scan, and a Playwright network record (`f0ec686`; `docs/07` H3).
- A script-tag build with SRI and a versioned, immutable URL, plus a generated WordPress plugin and Discourse tag (`docs/07` B5).
- Verified in a real WordPress 7.1.4 in three browsers (`1b992c6`; `npm run verify:wordpress`).
- The Worker runs on workerd with a local D1 in CI (`bedd6c9`; `npm run smoke:workerd`).
- A visitor control to report a mistaken warning (`75f4be3`; `docs/07` H4).
- `docs/08` trigger adapters; `docs/09` what has actually been run; `docs/10` false-positive review process (`2f62346`, `be373d3`).

### Changed (PR #4)

- The counter contract is seven fields. The unused field `b` is removed (`docs/07` H2).

### Fixed (PR #4)

- Lost outcomes in Firefox and WebKit focus (`75f4be3`).
- An invalid `wrangler.toml` (`[logpush]`) that would have failed the first deploy (`bedd6c9`).
- The CI workflow was invalid YAML (`162e613`).

### Added (PR #5, levelled-up design)

- Shapes on one sequence: gate, card, hallway, hallway, door, with the in-place escalation kept (`56ffcb1`; `docs/12`).
- The Glass Door panel: the exact payload, what never leaves, what stays on the device (`5133498`).
- Labs, switched off by default: quick exit, Fork, Wave and a youth-route gate. Each is accepted only by an edge that names it (`d1614df`; `docs/13`).
- A labs demo page, the hold-results pattern, and a per-shape table on the Desk (`fce5d07`).
- The Desk's trigger, route, escalation and wording panels, and an adoption ladder (`6f8d9a2`).
- A hosted demo: a Dockerfile and a two-role server (`5ebdee4`, `a8a9ca5`).
- Maritime sandbox assessment: the demo hosted on public URLs, and Discourse's own installer run with its CSP on (`b5c3bc6`, `b09be07`, `ec18f16`; `docs/14`).

### Fixed (PR #5)

- The loader needs CORS headers on its host. Found when installing in a real Discourse; the server now sends them for the loader only (`0a0e733`).
- A Desk day-subtraction leak (`6f8d9a2`).
- Two accessibility bugs in the shared card: focus lost when a timer button hides itself, and Escape not delivered after a click in Safari (`c22cf1b`).

### Removed (PR #5)

- The unused `loop.js` and `validate.js` modules (`29e06e9`, `c22cf1b`).
- The shared-spine claims. Doorway stands alone (`d4f3fb3`).

## [0.1.0] - 2026-11-07

The baseline: `main` as it was before PR #4 (commit `3fbd10b`).

### Added

- A pure core, privacy gates and CI on GitHub Actions (`84455d3`, `fe2e04f`).
- Routing by language and by country, with fixes for misroutes to the UK and Germany (`786864e`, `dd4a1c7`).
- A mock platform, a plug-in contract, an adapter and the organisers' materials (`b718cd4`).
- Merged from the arena branches: PRs #1, #2 and #3 (`d33edc9`, `4097586`, `090aef7`).

### Fixed

- The P0 to P2 defects from the review: measurement, silencing, jurisdiction, confidentiality, the endpoint, attribution and language coverage (`4097586`).
- Review blockers B1 to B5 and U6, and structural remediations B5 to B8 (`4849546`, `3fbd10b`).
