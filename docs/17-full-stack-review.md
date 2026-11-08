# Full-stack review — 8 November 2026

**Scope.** Every layer of the repository as it stands at `abea1cc` (branch `arena/e2054c6a-doorway`): core modules, the Door runtime and loader, the edge Worker and schema, the Desk (both versions), the prototype app, build/CI/scripts, CMS integrations, Docker, and the docs as claims about the code.

**Method.** Read every shipped source file; ran the gates and suites that can run here; wrote throwaway repro scripts against the real modules (deleted afterwards, working tree unchanged). This review does not re-list the organisational blockers already tracked in `docs/03` — those are real, but they are known. Everything below is **new**: bugs in code, gaps between code and its own guarantees, and operational risks, each with a suggested fix.

## What was run (and passed)

| Check | Result |
|---|---|
| `npm ci` (root and prototype) | clean install |
| `npm run verify` (shared check, safety, lint, unit+edge tests, routes, privacy gate, copy lint, docs, secrets, prod-key) | **all pass** — 332 unit/edge/script tests, 0 fail |
| `npm run smoke:workerd` (real workerd + local D1, real schema) | **all 20 smoke checks pass** |
| `npm --prefix prototype run typecheck` and `run build` | pass |
| Repro scripts for R1–R4 below | all confirmed against the real code |

Not runnable in this environment: the Playwright suites (no browsers available), `verify:wordpress` (no PHP), a real Cloudflare deploy. Where a finding depends on browser behaviour that could not be exercised here, it is marked **unverified in a browser**.

Severity: **HIGH** = breaks a stated guarantee or a main path; **MEDIUM** = wrong behaviour or data in realistic conditions; **LOW** = hardening, hygiene, small correctness.

---

## High

### R1. `byCountry` routes bypass the destination allow-list, the honesty gate and the copy lint — while `resolve()` prefers them over everything else

**Where:** `packages/core/src/route.js` — `resolve()` (lines 35–41), `allRoutes()` (217), `dropDisallowed()` (227), `assertHonest()` (245); `packages/core/src/bundle.js` line 52.

`resolve()` builds its chain with `byCountry[country][lang]` **first**:

```js
const chain = [ byCountry?.[lang], byLang[lang], byCountry?.en, byLang.en, byLang.generic ]
```

But every guard walks only `byLanguage`:

- `dropDisallowed()` — the allow-list filter that `verifyBundle()` applies even to a correctly signed bundle (review B4's "drops routes even when signed") — rebuilds `byLanguage` and passes `...bundle` through, **keeping `byCountry` untouched**.
- `allRoutes()` enumerates only `byLanguage`, so `assertHonest()` (CI's `check:routes`), the `--pilot` agreement check, and `lint:copy`'s route-footnote pass **never see a `byCountry` route**.
- The degradation paths inside `resolve()` (`selfHelp`, `misfit`) also pick from the unfiltered chain.

**Repro (confirmed):** a bundle whose `byLanguage.en` is allow-listed and honest, plus `byCountry.NL.en.default = { url: "https://evil.example.com/", reviewBy: "2020-01-01", … }`:

```
assertHonest problems:            []            ← CI passes
dropDisallowed keeps byCountry:   https://evil.example.com/
resolve('en', bundle, {country:'NL'}) → evil-nl  https://evil.example.com/
```

**Why it matters today.** The shipped `routes.nl.json` has no `byCountry`, so nothing is exploitable *right now* — this is a loaded trap, not a live leak. But B4's whole point is defence against a **signing-key compromise or an insider signing mistake**: the allow-list is the second lock that holds even when the signature is valid. The first bundle edit that adds a `byCountry` table (the schema and `resolve()` explicitly invite it) silently disables that lock for the highest-priority routes. The widget then opens the URL via `openHelp()` with no further check (`panels.js` re-checks only the Door shape; gate/card/hallway primaries do not).

**Fix (small):**
1. In `dropDisallowed()`, filter `byCountry` with the same `keep` predicate, per country per language, dropping emptied entries.
2. In `allRoutes()`, also yield `byCountry` entries with `where: \`country:${c}/${lang}/…\`` so `assertHonest`, `check:routes --pilot` and `lint:copy` cover them automatically.
3. Belt and braces: in `resolve()`, filter every candidate list with `isAllowedDestination` (or assert it once on the chosen `hit`) so no future table shape can route off-list.
4. Add a `bundle.test.js` / `route.test.js` case: signed bundle with an off-list `byCountry` URL → route dropped; `assertHonest` flags an expired `byCountry` `reviewBy`.

### R2. A domain can be verified from a page the platform does not control — redirects are followed and the host is never re-checked

**Where:** `edge/c.js`, `verify()` (lines ~395–410).

```js
const page = await fetch(`https://${install.domain}/`, { redirect: 'follow', … });
const html = (await page.text()).slice(0, 262_144);
found = new RegExp(…token…).test(html);
```

`redirect: 'follow'` means the token can be found on **any final host**. If `platform.example/` redirects (www-normalisation, a landing-page redirect, a compromised redirect rule, an open redirect on `/`), the check passes based on content served by `www.platform.example`, a CDN, or another host. Verification is the one moment the system binds an install to a domain; afterwards `frame-ancestors` trusts that domain forever. The DNS fallback has the same shape: it accepts the token anywhere in a TXT answer with `includes()`, so a TXT record like `some-other-service=…<token>…` also passes.

**Calibration:** this is a binding/hardening gap, not a trivial takeover — the `verify_token` is a secret, so an attacker still needs to know it *and* control a redirect target that serves it. The realistic failure is the benign one: a platform whose `/` redirects to `www.` or a CDN verifies against the wrong host, and the operator never learns the binding is looser than they think. Worth closing because verification is a security boundary and the fix is two lines.

**Fix:**
- Fetch with `redirect: 'manual'` (or follow at most one hop and require `new URL(page.url).hostname === install.domain`, treating `www.` as a distinct domain the operator must register separately).
- DNS: compare the **whole** TXT value (after quote-stripping and trimming) to the token with `===`, not `includes()`.
- Test: stubbed fetch that 302s to another host carrying the token → must fail.

### R3. The Desk token can be brute-forced at ~10 guesses/minute/install forever, and the lockout is a ready-made denial of service against the real admin

**Where:** `edge/c.js`, `agg()` (lines ~318–330); acknowledged in part in `docs/07` S1.

The fail counter is keyed `f:<install>:<minute>` and **resets every minute**, so an attacker gets 600 guesses/hour, 14,400/day, per install id, with no escalation, no exponential backoff and no global cap. BUILD.md's "at least 32 random characters" is an instruction, not enforceable (only the hash is stored) — an operator who seeds a short token is silently brute-forceable. Meanwhile any attacker who knows the public install id can spend the 10 failures **before** the admin's correct token is checked, locking the legitimate admin out for the rest of every minute, indefinitely (the code comments acknowledge "a lockout can be triggered by anyone who knows an id").

**Fix:**
- Add a second, longer-window fail bucket (e.g. `f:day:<id>` capped at ~100/day) so sustained guessing dies after the first minute; keep the per-minute bucket for burst control.
- On lockout, still allow a **successful** authentication to proceed (check the token first when the caller presents one, count failures only on mismatch) — this keeps the DoS off the real admin while guessing remains bounded. If the current "checked BEFORE the token" order is kept deliberately, document the admin-DoS as accepted and alert on it in the Desk.
- At install provisioning (see R8), generate the token server-side so length is guaranteed, not instructed.

---

## Medium

### R4. Meta-tag verification is attribute-order-sensitive — a semantically identical tag fails

**Where:** `edge/c.js` line 401.

```js
new RegExp(`<meta[^>]+name=["']doorway-verify["'][^>]+content=["']${token}["']`, 'i')
```

Requires `name` **before** `content`, both quoted, no extra attributes between quote and value. Confirmed repro against the real Worker:

```
<meta content="VERIFY123" name="doorway-verify">  → {"ok":false,"reason":"token-not-found"}
<meta name="doorway-verify" content="VERIFY123">  → {"ok":true, …}
```

CMS templating engines and SEO plugins routinely reorder or inject attributes (`data-rh="true"` in React Helmet, theme filters in WordPress). The installer sees `token-not-found` with a tag that is visibly present — the worst class of install failure for the 15-minute target. The same regex also fails on unquoted attribute values, which are valid HTML.

**Fix:** parse meta tags generically, then compare attributes:

```js
const metas = html.match(/<meta\s[^>]*>/gi) || [];
found = metas.some((tag) => {
  const attr = (n) => (tag.match(new RegExp(`${n}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')) || []).slice(2).find((x) => x !== undefined);
  return String(attr('name')).toLowerCase() === 'doorway-verify' && attr('content') === install.verify_token;
});
```

Exact `content === token` (no substring), order-free, quote-style-free. Add the two repro cases to `edge.test.js`.

### R5. The two Desks disagree: the static Desk's "Shift on" rung counts suppressed and labs rows

**Where:** `desk/desk.js` line 64 vs `prototype/src/lib/liveDesk.ts` (`visibleShapes`, `measuredLadder`).

`desk.js`: `const shift = byFormat.length >= 3;` — counts **rows**, including rows whose exposures are `null` (k-suppressed) and labs shapes (`fork`, `wave`). The prototype deliberately fixed this: distinct **production** shapes with a **visible, non-zero** count. Confirmed with the real `deskByFormat`:

```
rows: gate=40, card=null(suppressed), hallway=null(suppressed), fork=25(labs)
desk.js  Shift-on = true   (4 rows)
prototype Shift-on = false (1 visible production shape)
```

The static Desk is the one a real operator opens at `https://door.example/desk`; it can tick "Shift on: done" when the numbers prove no such thing — precisely the overclaim the ladder exists to prevent. Its `installed`/`gate` checks also treat `undefined` (older edge) as a number (`undefined !== null && undefined > 0` is false, so those two happen to be safe — but `shift` is not).

**Fix:** port `visibleShapes()` into `desk.js` (exclude `fork`/`wave`, require `typeof f.exposures === 'number' && f.exposures > 0`, count distinct formats). Better: extract the ladder into `packages/core` and have both Desks import it, the way the prototype imports the real core — the repo's own anti-drift pattern. Add a shared unit test with the repro fixture above.

### R6. `quiet` is never reachable in the shipped configuration for the people it was designed for

**Where:** `packages/core/src/shift.js` — `intervalHours: [0, 10/60, 6, 72]` and `pick()`'s window check; README's "A quiet pill appears only after the person has acted."

Walk the state machine: after exposure *n*, the re-warning window is `intervalFor(n)`. A person who acted gets `quiet` only on a retry **inside** that window. For n ≥ 3 the window is 72 h — fine. But the acted-then-retry path is only tested/meaningful there; for n = 1 the window is **10 minutes** and for n = 2 it is 6 h. A daily user (24 h cadence) is outside the 10-min and 6-h windows, so exposures 2 and 3 arrive at full strength even if they clicked help yesterday — the anti-nagging promise ("quiet for 72 h after acting") is not kept for the first three exposures. `markActed` stores `acted`, but `pick()` consults it **only inside the window**, so "acted 20 h ago, window is 6 h" → full escalation, not quiet.

**Calibration:** the code actually matches the **README** ("A retry *inside the re-warning window* … never answers with a pill unless the person has already acted"). It is the looser `docs/07` H1 summary ("quiet only after the person acted, for 72 h", unqualified) that reads as a broader promise. So this is a **confirm-intent** item, not a clear defect: the two documents describe different scopes and the code implements the narrower one. The practical consequence is real either way — a daily user who clicked help after exposure 1 or 2 is re-warned at full strength on their next-day return, because the 10-min / 6-h window has already elapsed.

**Fix (decide, then encode):** either (a) check `acted` within `QUIET_HOURS` **before** the window check, so acting really buys 72 h of quiet regardless of the interval table (matches H1's wording; keep the in-place escalation for non-acted retries), or (b) keep the code and tighten H1's summary to the README's scope. Add a `shift.test.js` case pinning whichever is chosen: exposure 1, act, retry at +20 h → `quiet` under (a), `card` under (b). Option (a) is three lines: hoist the `acted` branch above `if (!opts.alwaysAdvance && hours < window)`.

### R7. The `tel:` call button reports the outcome and then removes itself from the DOM inside the click — the dial may be cancelled

**Where:** `packages/shared/card.js` lines 190–195; `packages/doorway/src/panels.js` `doorPanel()` (the `href` primary).

The delegated click handler runs `finish(act, a)` **before** the browser's default action. `finish` → `close()` → `host.remove()`. For a button that is harmless; for the Door's only anchor (`<a data-act="primary" href="tel:…">`) the default navigation is pending on an element that has just been detached. Browsers differ on whether a detached anchor's default action still fires; WebKit historically cancels it. The file's own comment says the order is load-bearing for the *beacon*, and `openHelp()` was explicitly restructured for WebKit's opener-liveness — the same reasoning was not applied to the `tel:` anchor. The e2e asserts the `href` attribute exists, never that the navigation survives the click. **Unverified in a browser here** (no browsers in this environment) — but the risk is concrete and the fix is free.

**Fix:** for an anchor primary, don't remove the host synchronously: report the outcome, then defer `close()` to a microtask/`setTimeout(0)` (default action runs first), or `e.preventDefault()` and perform `w.location.assign(href)` explicitly inside the gesture the way `openHelp` does. Add a Playwright assertion that captures the `tel:` navigation request (route interception) rather than only the attribute.

### R8. There is no install-provisioning tool: the operator hand-writes SQL containing a hash they must compute themselves

**Where:** `BUILD.md` "Deploying the edge"; no script in `scripts/`.

The documented path is: invent an id, invent a verify token, run `openssl rand -hex 24`, pipe it through `shasum` **without a trailing newline**, paste three secrets into an `INSERT`. Every step is a footgun (the newline alone silently bricks the Desk login; `inst_` ids must match `^inst_[a-z0-9]{6,}$` but nothing generates them; `daily_cap`/`rate_per_min` sizing is guesswork). This is the operator-side twin of the 15-minute install target and it is currently unmeasured and un-scripted.

**Fix:** `scripts/provision-install.mjs --domain platform.example --traffic 5000 [--remote]` that: generates `inst_` + 8 random chars, a verify token, and a 48-char Desk token; computes the hash; emits the `wrangler d1 execute` command (or runs it with `--remote` behind a confirm flag); prints the token **once**, with the meta tag and the verify curl. ~60 lines, reuses `sha256hex`. Also enforces R3's token length by construction.

### R9. `daily_cap = 0` (or NULL-ish) silently means "reject everything", and the schema invites it

**Where:** `edge/c.js` line 161: `if (!(install.daily_cap > 0)) return false;` → 429 `daily-cap`. Confirmed: cap 0 → every event 429.

`0` is the natural value an operator types for "no cap" (and `reserveDaily`'s comment doesn't say otherwise). The install then looks healthy — `/v1/status` says ok, the Door renders — and **every event is dropped**, visible only as a growing heartbeat counter. Fail-closed is right; silent is not.

**Fix:** treat `0` explicitly as either (a) "uncapped" (skip the reserve) or (b) "disabled" — but document it in `schema.sql` and BUILD.md, and have `/v1/status` return `reason: 'disabled'` for a cap-0 install so the installer console says so. Provisioning (R8) should refuse 0 without a `--disabled` flag.

### R10. Heartbeat drops can be lost twice: the flush race and the invalid-version dead end

**Where:** `packages/doorway/src/widget.js` `flushDrops()` (328–334) and `send.js` `heartbeat()`.

Two small compounding bugs:
1. **Race:** `flushDrops` reads `st.drops`, awaits the send, then writes `{...cur, drops: 0}`. A drop recorded by `onDrop` **during** the await is wiped by the reset (read-modify-write across an await, last writer wins). Under-count, which is the direction the design says must never silently happen ("a pilot cannot silently undercount").
2. **Dead end:** `buildHeartbeat` requires `v` to match `^\d{1,3}\.\d{1,3}\.\d{1,3}$`. `VERSION` is fine today, but any prerelease string (`0.3.0-rc.1`) makes `heartbeat()` return false forever while `drops` keeps growing — the loss counter itself is then lost, silently.

**Fix:** (1) subtract what was sent instead of zeroing: `writeState({...cur, drops: Math.max(0, (cur.drops||0) - sent)})` with `sent` captured before the await. (2) Either widen the version regex to semver-with-prerelease or normalise `VERSION` at the send boundary; add a test that a bad version still surfaces (e.g. falls back to `0.0.0` and counts).

---

## Low

### R11. The leave-watch listeners are never removed, and `left_page` is a coarse proxy

**Where:** `packages/doorway/src/widget.js` `startLeaveWatch()` (201–209).

To be precise about what is **not** a bug: on a primary help click the card calls `finish()` synchronously (setting `exposure.finished = true`) **before** `onSelect → openHelp` runs, so the `visibilitychange → hidden` that a new tab causes is correctly ignored — `clicked_help` wins, no race there. The genuine items are smaller:

- The `pagehide` and `visibilitychange` listeners are added once per Door instance and **never removed**. In production the loader destroys the iframe after settle, so they are GC'd with the window — bounded, not a true leak — but in any reuse of a `createDoorway` instance (tests, or a future host that keeps the frame) they accumulate and keep `active` reachable. Name them and remove them on settle.
- `left_page` records *any* visibility loss (tab switch, app backgrounding), not "abandoned the warning". That is already flagged as unproven in `docs/04` V11; it is a measurement-validity caveat, not a code defect, and the Desk labels it honestly.

**Fix:** name both handlers, remove them in the settle path; keep V11 open as the interpretation question. No urgency.

### R12. The prototype's demo loader is injected without SRI, and `loadDoorway()` never times out

**Where:** `prototype/src/components/demo/doorwayLoader.ts`.

The real install path is SRI-pinned, but the app injects `/dist/latest/doorway.min.js` with no `integrity` (fine for same-origin demo, worth a comment) and `pending` resolves only on `onload`/`onerror`. A script that loads but throws before `window.doorway` is set resolves `true`… no — it resolves `!!window.doorway`, correctly false. The real gap: if neither event fires (server hangs the connection), the promise never settles and the Live tab sits at "Loading the Door…" forever with no error. **Fix:** a 10 s timeout that resolves false and removes the tag; surface the same "not running" alert as `onerror`.

### R13. `resolve()`'s language fallback can route a visitor to a service that does not serve their country, without the `outOfCountry` flag

Confirmed: `resolve('sv', bundle, {country:'NL'})` → `fi-redirection` with reason "direct language match" — correct by design (cross-border service). But `resolve('de', bundle, {need:'human', country:'NL'})` → `fi-redirection` (self-help) with reason "no local human service — self-help offered instead": the **German programme exists** (`de-kein-taeter`) and serves DE only; a German speaker on a Dutch platform is offered Finnish self-help with no indication the German programme exists. The chain's country filter is doing its job, but the copy never says "this service is not confirmed for your country" on this path (`outOfCountry` is only set on the `misfit` branch). **Fix:** when `need:'human'` degrades to self-help and a human route in the visitor's language exists but filters out on country, surface that route's existence in the Hallway's FAQ ("a programme in your language exists in DE") or at least set a flag the copy can use. Product decision as much as a bug; flagging it so it is decided, not defaulted.

### R14. `parseHours` rejects overnight spans and `openStatus` says "opens at 09:00" on a day that is not tomorrow

Confirmed: `Mo-Su 22:00-06:00` → `null` (treated as unknown — safe, but a 24/7 chat line written `00:00-24:00` works while a night line cannot be expressed). `openStatus('Su 09:00-17:00', Monday)` → `{opensAt:'09:00', tomorrow:false}` and the copy renders "Closed now, opens at 09:00" — on a Monday, for a Sunday-only line, that reads as *today* 09:00 (already past). **Fix:** when the next open day is not tomorrow, include the day name in `opensAt` rendering (`closedOpens` copy takes only a time today); either extend the format to overnight spans or document the subset and validate it in `assertHonest` so an unrepresentable route fails CI rather than silently showing no hours.

### R15. `new URL('..', import.meta.url).pathname` breaks on paths with spaces or non-ASCII, and on Windows

Eight scripts (`build.mjs`, `dev.mjs`, `serve-demo.mjs`, `check-docs.mjs`, `check-safety.mjs`, `gate-privacy.mjs`, `run-smoke-workerd.mjs`, `sign-routes.mjs`) use `.pathname`, which percent-encodes (`My%20Dir`) and carries a leading slash on Windows (`/C:/…`). `gen-prod-key.mjs` already does it right with `fileURLToPath`. **Fix:** the same one-line change in all eight; CI never catches it because CI checks out to a clean path.

### R16. `scripts/dev.mjs` static server: `file.startsWith(root)` without a separator

Line 59. `/home/user/doorway-evil` passes `startsWith('/home/user/doorway')`. The URL parser normalises `..` before this check so it is not reachable over HTTP today, but the guard is one refactor away from being load-bearing. `serve-demo.mjs` already does it correctly (`d + path.sep`). **Fix:** `file.startsWith(root + path.sep)`.

### R17. Prototype dev dependencies carry advisories; root is clean

`npm audit` (prototype): **high** — `vite@7.3.2` via `launch-editor` (Windows dev-server command injection / NTLM disclosure, GHSA-v6wh-96g9-6wx3 and siblings); **low** — `esbuild` transitive (Windows dev-server file read). Both are dev-server-only and Windows-only, neither ships in the built single file. **Fix:** bump `vite` to the patched 7.3.x line when available and re-run `typecheck`/`build`; add `npm audit --omit=dev` (root) and a prototype audit step to CI so this is tracked rather than discovered.

### R18. Small hygiene items (each one line)

- `packages/shared/index.js` exports `VERSION = '0.1.0'` while everything else is `0.2.0`; nothing imports it — delete it or derive it, before someone trusts it.
- `routes.nl.json` / `routes.demo.json` carry a `selfHelpAlways` array that **no code reads** (confirmed by grep). Either wire it into `resolve()` (it looks like an intended "always offer self-help" list) or delete it from the bundle and re-sign; dead signed data is attack surface (see R1) and doc drift.
- `desk/desk.js` `load()`: `session.days` is the raw `<select>` value interpolated into the query string — fine, but `$('days')` has no validation if the DOM is edited; the edge clamps it, so this is defence-in-depth only.
- `widget.js` `present()`: `const tag = () => [];` is a no-op stub called in three places — remove.
- `edge/c.js` `agg()`: `dimRows` interpolates a column name into SQL. It is a fixed literal at every call site today; a one-line `if (!['trigger','route','bucket','variant'].includes(col)) throw` makes the invariant local and future-proof.
- `loader.js`: `new URL(doorOrigin)` is constructed on every message and every load; hoist it once in `createLoader` (also gives one place to throw a clear installer error on a malformed origin).
- `card.js` `renderBlock('timer')`: `b.seconds` is interpolated into `max="…"` unescaped — validated as an integer by `validate()`, so safe, but escape it like everything else for uniformity.
- CI: the `verify` job installs all three browsers and runs four Playwright suites serially in one job; matrix-splitting per browser would cut wall-clock roughly in half and isolate engine-specific flakes (the repo's own "quarantine by name" policy becomes easier to apply).

---

## Blockers to a real deployment (engineering, not organisation)

These are the items from `docs/03`/`docs/04` that are *code-adjacent* and have no workaround in the repo today, listed so the engineering plan is complete:

1. **No production signing key exists** (V14). `gen-prod-key.mjs` is ready and tested; the pinned key is the dev key and `DOORWAY_PRODUCTION=1` refuses it. Until this is run and `pubkey.js` re-pinned, no build is shippable. *Fix is mechanical; the blocker is custody of the key.*
2. **The edge has never been deployed to Cloudflare D1.** The workerd smoke passes, but D1's remote behaviour (binding limits, `RETURNING` semantics under real concurrency, asset routing with `run_worker_first`) is unverified. First deploy is a risk event; schedule it with the smoke script pointed at a staging Worker.
3. **No bundle rotation path.** The embedded bundle is the only one; `validUntil` is 2027-02-06 and `check:routes` starts failing two weeks before. Re-signing requires a rebuild + redeploy of the Worker **and** every cached loader. Document the rotation runbook now (re-sign → build → deploy → bump `VERSION` → new SRI tag) and put a calendar reminder at `validUntil − 30 d`.
4. **Real Safari/iOS third-party storage is untested** (V15). The DEGRADED path exists and is tested in Playwright WebKit, which is not Safari. If ITP blocks the iframe's `localStorage`, every Safari visitor gets the card forever — acceptable, but measure it before a pilot rather than after.
5. **`verify` has never run against a live DNS resolver or a real platform's HTML** (M4) — R2 and R4 are exactly the kind of thing that first real run will hit.

## Suggested order of work

| Step | Items | Why first |
|---|---|---|
| 1 | R1, R2, R4 | Security guarantees and the install path; all small, all testable here |
| 2 | R5, R6, R9, R10 | Measurement honesty — the product's core claim is its numbers |
| 3 | R8, R3 | Operator tooling makes the token policy enforceable |
| 4 | R7, R12, R13, R14 | Browser-behaviour fixes, verified in the Playwright suites |
| 5 | R11, R15–R18 | Hygiene; batch into one PR |

Every fix above should land with the test that fails without it, per the repo's own rule in `docs/07`.

---

*Review performed against the working tree at `abea1cc`; no files were modified. Repro scripts were run and deleted. Gates re-run after the review: `npm run verify` — all pass.*
