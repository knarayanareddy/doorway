# Response to the review (B1–B8, H1–H7, M1–M6, L1–L3)

Status of every finding at this commit, with the evidence and what is still open. "Done" means fixed in code **and** covered by a test that fails without the fix. Anything that needs an outside party is listed as open, not as done.

Run `npm run verify` and `npm run e2e` to reproduce. `npm run status` prints live counts.

## Blockers

| # | Status | What changed | Evidence | Still open |
|---|---|---|---|---|
| **B1** host runs the widget | **Done** | The Door runs in a sandboxed cross-origin iframe. State and the counter `POST` live inside it. The seam is `postMessage`: `{trigger,type}` in, `{ready}` / `{settled}` out. Threat model R9 rewritten with the residuals. | `host-adversary.spec.js` (hostile host wraps fetch, XHR, sendBeacon, Storage, postMessage, a DOM observer, and probes the frame; asserts only `{ready}`/`{settled}` crossed). `loader.test.js`. | Now also run in Firefox and WebKit (Playwright builds), not real Safari or mobile. Real-Safari third-party storage behaviour is still unverified (V15). Cross-browser runs found and fixed two real defects (`docs/09`). Deviations from the review's sketch are listed in `docs/02` R9: `allow-same-origin` is required, and a content-free `{ready}` was added. |
| **B2** anyone can write | **Done** | Exact-match Door origin only (no regex); 512-byte cap before any DB read; per-install per-minute limiter and daily cap; install lookups cached 60 s; Door page served with `frame-ancestors <install domain>`; Desk labels every number unauthenticated, flags anomalous days, applies k-suppression with secondary suppression. | `edge.test.js`: foreign origin, platform origin, suffix tricks, flood (70 forged → 20 accepted), daily cap, oversize, pruning; `door.spec.js`: a site that is not the install's domain cannot embed the Door. | Origin is still only a hint: a non-browser can forge it. The limiter bounds the damage; it does not authenticate. This is stated in the Desk and in R12. The review's patched check (`host === install.domain`) does not apply as written, because writes now come from the Door origin; the domain binding is `frame-ancestors`. |
| **B3** unverified wording passes | **Done in code** | One predicate, `isRenderableConfidence()`, used by the widget, `assertHonest()` and CI. Free-text `conf` is rejected; the record is `{text, basis, sourceUrl, verifiedBy, verifiedAt, expiresAt}`. No shipped route has a verified record, so all copy is neutral. All visitor copy was rewritten to carry no confidentiality or anonymity wording; a service's own words appear only through the verified record. | `copy.test.js`, `lint-copy.mjs`, `route.test.js`. | **External:** V1 and V1b (service confirmation, with date and contact). V2 now has its own question. |
| **B4** unsigned bundle | **Done, dev key** | Ed25519 over canonical JSON; public key pinned in the Door; WebCrypto verification before any route is used; `validUntil`; exact-host destination allow-list that drops routes even when signed; `check:routes` in CI. | `bundle.test.js` (tamper, other key, placeholder, expired, off-list host). | **Production key** (V14). There is no remote-fetch path for a fresh bundle yet, so "fall back to last-known-good" has nothing to fall back *from*: the embedded bundle is the only one. |
| **B5** nothing installable | **Partly done** | `npm run build` → single-file `doorway.min.js` (no import attributes) + SHA-384 SRI + versioned immutable path + generated WordPress plugin and Discourse tag. Script-tag install with data attributes only. Installer error states in the console with one-line fixes. | `install.spec.js` (SRI accepted, tampering refused, trigger via data attribute), `door.spec.js` (unverified, unknown, wrong domain, missing id), **`wordpress.spec.js`: the generated plugin run inside a real WordPress 7.1.4 in three browsers** (`npm run verify:wordpress`). | The 15-minute on-camera install with a non-developer has **not** been run (needs a person). Discourse has **not** been run (needs Docker/Postgres/Redis). The plugin has not been tried on a hosted WordPress or behind a caching/minifying plugin. Installer states are not yet shown in the Desk. |
| **B6** measurement | **Done** | `left_page` on `pagehide`/`visibilitychange` with `keepalive`, once per exposure; one `normaliseType()`; adapter `inst_placeholder` and its dead payload builder deleted, so there is one send path; failed sends increment a local dropped-events counter reported by heartbeat (count only); `/v1/agg` + a Desk page with the real denominator. | `counter.test.js` (every type and outcome through the real send path; drops counted), `door.spec.js` (left_page, nav), `edge.test.js`, `desk.spec.js`. | Whether `left_page` means "did not seek help" is unproven (V11). |
| **B7** detection half | **Reframed** | README, `docs/02` R4 and a new `docs/08` say Doorway is the response layer only. No term list exists; `gate:privacy` fails if one appears. | `gate-privacy.mjs`. | **External:** the three reference adapters are described, not built; partnerships are months. |
| **B8** legal claims | **Done in code** | Legal copy moved into reviewed records (`legal-records.js`). It renders only for an *explicitly declared* `legalJurisdiction` with a record that has a named reviewer, a date inside twelve months and an unexpired `expiresAt`. Otherwise, neutral harm copy. A CI check forbids number-plus-time-unit in copy. | `copy.test.js`, `lint-copy.mjs`. | **External:** Dutch counsel sign-off (V12). Until then no one sees a statute or a penalty. |

## High

| # | Status | Notes |
|---|---|---|
| **H1** immediate retry | **Done** | In-window retries escalate in place as an inline card and keep the clock; quiet only after the person acted, for 72 h. `shift.test.js` (burst), `door.spec.js`. |
| **H2** field the server discards | **Done** | `b` removed from contract, widget, adapter, docs. Seven fields. `edge-contract-width`. |
| **H3** privacy gate | **Done** | ESLint AST rules + AST identifier scan + endpoint↔handler check; Door CSP; Playwright network record. `gate.test.js` appends each leak the review used (XHR, Image, sendBeacon, cookie, WebSocket, off-domain fetch, eval, stray storage) and asserts it is caught. BUILD.md now says the gate is a tripwire and the e2e is the evidence. It still cannot see dynamic property access. |
| **H4** false-positive path | **Mechanism done; owner missing** | `POST /v1/report` (closed reason list, no text); a one-click visitor control on every card ("This warning was a mistake", nl/en/de, reason always `other` so the Door never asks who the visitor is); Desk table and an admin form with categories; the exit button is visually equal to the primary action. Process and the unfilled owner table: `docs/10-false-positive-review.md`. **Open:** a named human reviewer (nobody is assigned, deliberately not invented here). "Keyboard-reachable first" for the exit was not changed: it would move focus off the help button, a product decision. Both are one Tab apart and Escape exits. |
| **H5** implied partnership | **Done in code** | "Shown by this site · help from X, an independent service". Routes have an `agreement` field; `npm run check:pilot` lists what is missing. **External:** the written OKs (V13). |
| **H6** dead tables and endpoints | **Done** | `arrivals` and `trigger_packs` deleted; `heartbeats` now has a writer; whitelist consistency is checked in CI. Decision: `?src=doorway` stays identical on every link (no per-platform tag), so the arrivals number is **not** attributable per platform and relies on each service's own reporting. This is the privacy-preserving choice; revisit only with the services' agreement. |
| **H7** untested rendering layer | **Done** | Playwright suite (gate, card, quiet, keyboard-only, 320 px, reduced motion, blocked storage, hostile host, network, installer errors, Desk, script tag/SRI); the real edge Worker tested against the real schema; one test command; copy lint per language over the real strings. **Open:** native-speaker review of nl/de. |

## Medium and Low

| # | Status | Notes |
|---|---|---|
| **M1** doc drift | **Done** | `check-docs.mjs`: links, no hard-coded test counts, no repeated paragraph, every Closed row has a source, no stale field count. V1/V2 rewritten as separate questions. |
| **M2** quiet copy dead | **Done** | Copy keyed by format first (`copyFor`). `copy.test.js`, `door.spec.js`. |
| **M3** route review dates, DE phone | **Done in code** | `reviewBy` on every route (CI fails when passed); `de-kein-taeter` is `channel: "programme"` with no phone; `assertHonest` flags phone/channel mismatch. **Open:** monthly human review, and `verifiedAt` is null on every route until someone verifies it. |
| **M4** install verification | **Done** | `POST /v1/verify` (meta tag or DNS TXT), 60 s cache. Tested with stubbed fetch; not against a live DNS resolver. |
| **M5** plain language | **Done** | Every string in every language is checked at 20 words; offending sentences split. |
| **M6** copy promises a person | **Done** | Control copy keyed by route kind: human, programme, self-help, none. |
| **L1** wide whitelist | **Done** | `blur`, `ai`, `selfhelp`, `upload` removed. |
| **L2** storage-blocked downgrade | **Documented** | Accepted trade, in `docs/02`. Tested. |
| **L3** licence | **Open, a decision** | MIT in the repo; `organiser/unicri` has its own. Decide the target with the fiscal sponsor before outside contributions (V9). |

## What changed in the second pass

Run, rather than assumed: Firefox and WebKit, the Worker on workerd with a local D1, and the plugin inside real WordPress. Details and what each does *not* cover are in [`docs/09-cms-verification.md`](09-cms-verification.md). It found:

- **Lost outcomes in Firefox** (the iframe was removed while the outcome request was in flight): fixed; the Door now settles after the send, bounded at 1.5 s.
- **Unreliable initial focus in WebKit**: fixed, without ever overriding a person who has already pressed a key.
- **An invalid `wrangler.toml`** (`[logpush]` table) that would have failed the first `wrangler deploy`: fixed, and `npm run smoke:workerd` (also in CI) now guards it.
- Three test-harness defects of mine (a dev server that died on an aborted request, a stale beacon polluting the next test, Playwright interception hiding a real beacon in WebKit): fixed, and noted so no one chases them as product bugs.

Still not possible without you: deploying (needs your Cloudflare account), the on-camera install (needs a person), Discourse (needs a heavier stack), and naming the false-positive reviewer.

## Third pass: the levelled-up design

A second reviewer produced a prototype (`Doorway levelled up`) with a stronger idea set and its own review. What was taken, what was fixed, and what is parked:

- **Taken into the real Door:** one shape per exposure (gate, card, hallway, hallway, door) on top of `shift.js` with the H1 in-place escalation kept; the **Glass Door** (the exact payload, what never leaves, what stays local with a wipe button, an honest note about the network address); the **Hallway** (copyable first sentences, a self-help alternative counted against its own route, and a service's privacy wording and opening hours only through verified-record predicates). Tests: `panels.test.js`, `shapes.spec.js` in three browsers. `card.js` gained generic content sections and a focus trap that looks up its controls on each keypress.
- **Fixed in the prototype** (now in `prototype/`, importing the real core): third-party fonts removed; no hard-coded legal or confidentiality claims; routes only from the verified bundle and the allow-list (the Helpwanted link is gone); the seven-field contract; no quiet-right-after-exposure; the Wave has no free text and keeps nothing beyond the tab; the Verdict text re-baselined.
- **Parked behind decisions** (`docs/11-open-decisions.md`): quick exit (cannot navigate the host from a sandbox), holding results (conflicts with treating the host as an adversary), the Fork's self-identification, the Wave's clinical review, and a verified youth route.

## New open items this work surfaced

- **V15 — real Safari and mobile.** The suite now runs in Chromium, Firefox and WebKit, but Playwright's WebKit is not Safari. Safari's Intelligent Tracking Prevention may restrict third-party `localStorage` in ways it does not; in the worst case the Door cannot keep state, and the DEGRADED path (card, not gate) applies. Needs a pass on real Safari (macOS and iOS).
- **Edge not deployed.** The Worker has run on `node:sqlite` (unit tests) and on workerd with a local D1 (`smoke:workerd`), never on Cloudflare's D1 service. A first deploy may still surface differences.
- **Node ≥ 22.13** is now required to run the tests (`node:sqlite`).
- **The quiet pill blocks the page for its few seconds**, because the frame is full-viewport for every format so that its size does not reveal the format. Noted in `docs/02` R9.
