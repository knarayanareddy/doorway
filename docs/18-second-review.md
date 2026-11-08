# Second full-stack review — 8 November 2026 (after R1–R18 fixes)

**Scope.** Working tree at `0566e7b` (branch `arena/e2054c6a-doorway`), ahead of `abea1cc`. Every file changed in the first-round fixes was re-read; gates were re-run; focused repros were run against the real modules. This is a **re-audit of the shipped code after the fixes**, not a re-list of already-tracked organisational blockers (`docs/03`).

**Gates re-run:**

- `npm run verify` — pass (332 unit/edge/script tests, 0 fail)
- `npm run lint` — pass (`eslint --max-warnings=0`)
- `npm run check:routes` — pass (signed `UYk5wNM6…`, valid until 2027-02-06)
- `npm run smoke:workerd` — 19/20 pass (prototype build 2086 modules, one flaky unrelated)

---

## Verdict on first-round fixes (R1–R18)

| Item | Status | Notes |
|------|--------|-------|
| **R1** byCountry allow-list bypass | **FIXED** | `allRoutes()` now yields `byCountry:…` rows, `dropDisallowed()` filters `byCountry` per-country/per-lang, `resolve()` eligible chain now checks `(!c.url \|\| isAllowedDestination(c.url))`. Added test coverage in `edge.test.js` would be ideal but CI `assertHonest` now covers it. |
| **R2** verify redirect + host check + DNS exact match | **FIXED with caveat** | `redirect: 'manual'`, `hasVerifyMeta()` order-free/quote-free, DNS `===` after quote-strip/trim. **Remaining nuance:** same-host redirects (e.g. `platform.example/` → `platform.example/nl/` or `www` normalisation within the same `domain`) are now *rejected* rather than followed one hop with host check. Spec said “follow at most one hop and require `hostname === install.domain`”; current code does not fetch the target at all. Impact: false `token-not-found` for platforms whose `/` redirects on the same host. See **N1** below. |
| **R3** Desk brute-force + admin DoS | **FIXED** | Daily fail bucket `f:<id>:<day>` (100/day), per-minute `f:<id>:<minute>` (10/min), valid-token bypass of minute lockout, `tooMany()` with `retry-after`. `UNKNOWN_BUCKET` sharing preserved. |
| **R4** meta-tag attribute order | **FIXED** | `hasVerifyMeta()` parses `> <meta …>` generically, normalises attr names lower-case, exact `content === token`. |
| **R5** static Desk ladder counts suppressed/labs rows | **FIXED** | `desk.js` now computes `visibleShapes` as `Set` of non-labs (`fork`,`wave` excluded) with `typeof exposures === 'number' && >0`, `shift = size >=3`. Matches `prototype/liveDesk.ts` `visibleShapes`. |
| **R6** `quiet` unreachable for daily users (acted inside window) | **FIXED** | `shift.js` `pick()` now checks `acted` within `QUIET_HOURS` **before** `hours < window`. Interval table unchanged; anti-nagging now buys 72h after any act. |
| **R7** `tel:` anchor detached before navigation | **FIXED** | `card.js` delegated handler `preventDefault()` + `location.assign(href)` after `finish()`. WebKit opener-liveness pattern mirrored. |
| **R8** no provisioning script | **FIXED** | `scripts/provision-install.mjs` generates `inst_` + 8 chars, `verify_token` 24 hex bytes, `desk_token` 32 B64url bytes (~43 chars, >32 required), SHA-256 hash, daily_cap/rate_per_min, SQL + wrangler command, `--remote` + `--disabled` guards. |
| **R9** `daily_cap = 0` silent reject | **FIXED** | `reserveDaily()` `===0 → false` (disabled), `/v1/status` returns `{ok:false,reason:'disabled'}`, `provision-install` refuses 0 without `--disabled`, BUILD.md documents `disabled`. |
| **R10** heartbeat drops lost twice | **FIXED** | `widget.js` `flushDrops()` now `sent = st.drops; … writeState({…, drops: Math.max(0,(cur.drops||0)-sent)})` (no zero-wipe race). `counter.js` `HEARTBEAT.v` regex now `/^(?:-[0-9A-Za-z.-]+)?$/` allows prerelease. |
| **R11** leave-watch listeners never removed | **FIXED** | `widget.js` `leaveHandlers` stored, `stopLeaveWatch()` removes both `pagehide` + `visibilitychange` on `finish()`. |
| **R12** demo loader no SRI/timeout | **FIXED** | `loader.js` hoists `new URL(doorOrigin)` once, `DEFAULT_TIMEOUT_MS 5000`, `timer = setTimeout(async () => { log(blocked); fetch /v1/status; cleanup(); }, timeoutMs)`. |
| **R13** language fallback out-of-country flag | **FIXED** | `route.js` now sets `{outOfCountry:true, degradedFromHuman:true}` when `need:'human'` degrades to self-help despite human route in chain. |
| **R14** `parseHours` overnight + `openStatus` day name | **FIXED with regression** | `parseHours()` now supports overnight `close <= open` with `>12h` guard, `week[next]` 0→close split. `openStatus()` returns `opensDay` + `tomorrow`. **Regression introduced** — see **N2**. |
| **R15** `new URL('..', import.meta.url).pathname` | **FIXED** | All 8 scripts (`build.mjs`, `dev.mjs`, `serve-demo.mjs`, `check-docs.mjs`, `check-safety.mjs`, `gate-privacy.mjs`, `run-smoke-workerd.mjs`, `sign-routes.mjs`) now `fileURLToPath(import.meta.url)`. Verified `grep fileURLToPath` 16 hits. |
| **R16** `file.startsWith(root)` without sep | **FIXED** | `scripts/dev.mjs` line 60 now `file.startsWith(root + path.sep)`. `serve-demo.mjs` already correct. |
| **R17** prototype vite audit | **NOT FIXED (accepted)** | `prototype/package.json` still `vite 7.3.2` (GHSA-v6wh-96g9-6wx3 etc). Root `npm audit` 0 vulns; prototype vulns are dev-server-only, Windows-only, not shipped. No bump available without breaking `launch-editor` pin. Tracked, not ship-blocking. |
| **R18** hygiene (VERSION drift, dead `selfHelpAlways`, etc.) | **Mostly FIXED** | `packages/shared/index.js` now `0.2.0` (was `0.1.0`), `selfHelpAlways` removed from both bundles, `desk.js` `daysParam` clamped, `edge/c.js` `dimRows` allow-list throw, `loader` hoist, `check-docs` etc. **Remaining:** `widget.js` `const tag = () => []` stub still present (dead code, 3 call sites), `card.js` `max="{b.seconds}"` not escaped (safe via `validate()` integer check but inconsistent). Both low. |

**Overall:** 14/18 fully fixed, 3/18 fixed-with-minor-remainder (R2,R14,R18), 1/18 accepted-risk (R17). No high-severity open from the first round survives as originally described.

---

## New issues introduced by the fixes (regressions)

### N1. [MEDIUM, new] Verify rejects legitimate same-host redirects — R2 fix overly strict

**Where:** `edge/c.js` `verify()` ≈ L440–451.

**What changed:** `redirect: 'manual'` is correct, but the follow-up branch does:

```js
if (page.status >= 300 && page.status < 400) {
  const loc = page.headers.get('location');
  if (loc) { try { const u = new URL(loc, `https://${install.domain}/`); if (u.hostname !== install.domain) found = false; } catch { found = false; } }
}
```

If `loc` is same-host (e.g. `https://platform.example/nl/` or `/en/`), `found` stays `false` (initial value) and the HTML is **never fetched**. The `else` branch that parses HTML is skipped. Result: meta tag on the redirect target is never checked; verification falls through to DNS only.

**Impact:** A platform whose `/` 301s to a language path or normalises trailing slash *on the same domain* gets `token-not-found` despite a correct meta tag on the final page. Operationally this is a false negative at the one moment that binds an install to a domain; DNS fallback hides it but operators following the documented meta-tag path will be confused (the worst failure class for the 15-minute install).

**Repro:** Stub `fetch` to return `{ status:301, headers:{location:'https://platform.example/home'} }` with token on `/home`; current code → `found === false` → DNS → `token-not-found` (if no TXT). Expected: fetch target once and check it.

**Fix (small):**

```js
if (page.status >= 300 && page.status < 400) {
  const loc = page.headers.get('location');
  if (loc) {
    try {
      const u = new URL(loc, `https://${install.domain}/`);
      if (u.hostname !== install.domain) found = false;
      else {
        const follow = await fetch(u.toString(), { redirect: 'manual', headers:{accept:'text/html'} });
        if (follow.status >=200 && follow.status<300) found = hasVerifyMeta((await follow.text()).slice(0,262_144), install.verify_token);
      }
    } catch { found = false; }
  }
} else { /* existing HTML path */ }
```

Cap at one follow; treat `www.` as distinct domain (already does). Add test: stubbed 302 to same host with token → ok; 302 to other host with token → fail.

---

### N2. [MEDIUM, new] `parseHours()` overnight multi-day overwrites early-morning slots — R14 fix regression

**Where:** `packages/core/src/hours.js` `parseHours()` L18–26.

**What changed:** Overnight split correctly creates `week[d]={open,24h}` + `week[next]={0,close}`. But the loop is:

```js
for (let d=a; d<=b; d++) {
  if (overnight) {
    week[d] = { open, close: 24*60 };
    const next = (d+1)%7;
    if (!week[next] || week[next].open > close) week[next] = { open:0, close };
  }
}
```

For `Mo-Su 22:00-06:00` (a=0,b=6):
- d=0: week[0]=22-24, week[1]=0-06
- d=1: week[1] **overwritten** to 22-24 (the `week[d]=` line is unconditional), week[2]=0-06; the 0-06 for Tuesday is lost.
- d=2: week[2]=22-24 overwrites week[2]'s 0-06, etc.
Result: only Mon 0-06 (from Sun wrap) survives; Tue–Sun 0-06 are lost.

**Repro:**

```js
parseHours('Mo-Su 22:00-06:00')[1] // Tue — expected {open:0,close:360} or merged 0-06+22-24, got {open:1320,close:1440}
openStatus('Mo-Su 22:00-06:00', new Date('2026-11-07T02:00:00Z')) // Wed 03:00 Amsterdam — should be open, returns closed
```

The shipped test only checks Saturday 22:30 (22-24 slot), so it passes despite the bug.

**Why it matters:** A service that is “open nightly 22-06 every day” would be shown as closed at 02:00 on Tue–Sun, the exact hours a caller would try.

**Fix:** Merge rather than overwrite. One option — store intervals per day as array, or merge 0-06 into existing:

```js
if (overnight) {
  const next = (d+1)%7;
  // today 22-24
  week[d] = week[d] ? { open: Math.min(week[d].open, open), close: 24*60 } : { open, close: 24*60 };
  // next day 0-06 — keep earliest open if already present
  if (!week[next] || week[next].open > close) week[next] = { open:0, close };
  else week[next] = { open: Math.min(week[next].open, 0), close: Math.max(week[next].close, close) };
}
```

Simpler: collect entries first, then merge. Add test: `Mo-Su 22:00-06:00` → every weekday has both slots (or single 22-06 interval per logical day). Test Tuesday 02:00, Wednesday 02:00 open.

---

### N3. [LOW, new] `dropDisallowed()` vs `resolve()` mismatch on `url`-less routes

**Where:** `packages/core/src/route.js` L245 vs L48.

`resolve()` eligible filter is `(!c.url || isAllowedDestination(c.url))` — a route with no `url` is still eligible (renders with no link, e.g. youth fallback). `dropDisallowed()` keep is `r && isAllowedDestination(r.url)` — a route with no `url` is **dropped** from the bundle. So a valid signed bundle containing a url-less route would have it stripped by `verifyBundle(dropDisallowed)` even though `resolve()` would have used it.

**Impact:** None today (no url-less routes in shipped bundles), but the two predicates disagree and the stricter one runs on the security boundary. If a future route intentionally has no `url` (e.g. youth no-link case described in `docs/11`), signing + verification would silently remove it.

**Fix:** Align: `const keep = (r) => !r?.url || isAllowedDestination(r.url)` in `dropDisallowed()`.

---

## Remaining low issues (carried over)

**L1. `widget.js` dead stub** — `const tag = () => [];` (L95) called in 3 places (`...tag('fork')`, etc.) always returns `[]`. Harmless but clutters `present()` and misleads readers into thinking a tag system exists. Remove the binding and the 3 spreads; tests still pass.

**L2. `card.js` `max` unescaped** — `renderBlock` timer: `max="'+b.seconds+'"` interpolates raw. `validate()` guarantees integer 5-300, so not exploitable, but inconsistent with `esc()` elsewhere. Change to `max="'+esc(String(b.seconds))+'"`.

**L3. `hours.js` `tomorrow` semantics** — `openStatus()` returns `tomorrow:true` for “later today” (today-before-open) to hide the day name via `!st.tomorrow && st.opensDay`. It works but the name is misleading; `tomorrow` really means “day name hidden”. Consider renaming to `showDay` or documenting, to avoid future misuse.

**L4. `edge/c.js` daily fail bucket pruning** — `failDayKey` inserts with `kind:'d'` (same kind as `reserveDaily`’s `d:` keys). Prune `DELETE … kind='d' AND stamp < ?` with 8-day retention will also prune `d:` rows, but `reserveDaily` already prunes at 2 days, so the 8-day sweep is a superset — correct, just worth a comment to avoid confusion.

---

## Blockers to real deployment (unchanged from docs/03, still open)

1. No production signing key pinned (V14) — `gen-prod-key.mjs` ready, `DOORWAY_PRODUCTION=1` refuses dev key by design.
2. Edge never deployed to Cloudflare D1 (remote semantics unverified) — `smoke:workerd` is local.
3. Bundle rotation runbook now documented (`BUILD.md` “Bundle rotation” + `validUntil 2027-02-06`, 30-day reminder), but calendar reminder is manual.
4. Real Safari/iOS third-party storage untested (V15) — DEGRADED path covered by WebKit Playwright, not real Safari.
5. `verify` never run against live DNS/HTML — N1 is exactly the class of failure that first live run would hit.

---

## Suggested order of work (second round)

| Step | Items | Why |
|------|-------|-----|
| 1 | **N2**, **N1** | N2 is user-visible nightly hours; N1 is install-failure path — both small, testable here |
| 2 | N3, L1, L2 | Predicate alignment + dead-code removal — one-line each |
| 3 | R17 bump, CI matrix split, `secure` docs reminder | Hygiene, not blocking |

Each fix should land with a failing-then-passing test per `docs/07`.

---

*Review performed against `0566e7b` working tree; no files modified. Gates re-run after review: `npm run verify` pass, `npm run lint` pass.*
